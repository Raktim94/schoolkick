import { ApiError } from '../kernel.ts';
import type { Ctx, Kernel } from '../kernel.ts';
import { bad, currency, isoDay, minor, str, todayIn, uuid } from '../validate.ts';
import { nextNumber } from './fees.ts';

type Exam = { id: string; name: string; currency: string; subjects: string[]; fee_base_minor: string; fee_per_subject_minor: string; late_fee_minor: string; opens_on: string; closes_on: string; late_closes_on: string | null; exam_date: string | null; min_attendance_pct: number | null };
const num = (v: unknown) => Number(v);
const fee = (e: Exam, n: number, late: boolean) => num(e.fee_base_minor) + num(e.fee_per_subject_minor) * n + (late ? num(e.late_fee_minor) : 0);

/** Registration window: normal, late (extra fee) or closed. Dates are school-local days. */
function windowFor(e: Exam, today: string): 'early' | 'open' | 'late' | 'closed' {
  if (today < e.opens_on) return 'early';
  if (today <= e.closes_on) return 'open';
  return e.late_closes_on && today <= e.late_closes_on ? 'late' : 'closed';
}

/** Share of recorded school days the learner attended (present or late). No records means no evidence, which is reported rather than guessed. */
async function attendancePct(q: Ctx['q'], learnerId: string) {
  const r = (await q.query(
    `with latest as (select distinct on (class_id, learner_id, day) status from attendance_events where learner_id = $1 order by class_id, learner_id, day, id desc)
     select count(*)::int as days, count(*) filter (where status in ('present','late'))::int as attended from latest`, [learnerId])).rows[0];
  return r.days ? { days: r.days, pct: Math.round((r.attended / r.days) * 100) } : null;
}

async function eligibility(q: Ctx['q'], e: Exam, learnerId: string) {
  if (!e.min_attendance_pct) return { ok: true as const };
  const a = await attendancePct(q, learnerId);
  if (!a) return { ok: false as const, reason: `This exam needs ${e.min_attendance_pct}% attendance and none is recorded yet. Ask the school office.` };
  return a.pct >= e.min_attendance_pct ? { ok: true as const } : { ok: false as const, reason: `Attendance is ${a.pct}% over ${a.days} recorded days; this exam needs ${e.min_attendance_pct}%. Ask the school office if this is wrong.` };
}

const STATUS_SQL = `
  case when d.decision is not null then d.decision
       when coalesce((select sum(p.amount_minor) from payments p where p.invoice_id = r.invoice_id and p.status = 'settled'),0)
          - coalesce((select sum(f.amount_minor) from refunds f join payments p on p.id = f.payment_id where p.invoice_id = r.invoice_id),0) >= i.amount_minor then 'in_review'
       when exists (select 1 from payments p where p.invoice_id = r.invoice_id and p.status in ('initiated','processing','needs_reconciliation')) then 'payment_pending'
       else 'awaiting_payment' end`;

export function examsModule(k: Kernel) {
  const staffRoles = ['owner', 'registrar'] as const;

  k.secure('post', '/exams', [...staffRoles], 'Create an exam with its fee, subjects, deadlines and eligibility rule', async (x) => {
    const b = await x.body();
    const subjects = Array.isArray(b.subjects) ? b.subjects.map((s) => str(s, 'subject', 1, 60)) : [];
    if (!subjects.length || new Set(subjects).size !== subjects.length) throw bad('subjects must be a non-empty list without repeats');
    const opens = isoDay(b.opensOn, 'opensOn'), closes = isoDay(b.closesOn, 'closesOn'), lateC = b.lateClosesOn ? isoDay(b.lateClosesOn, 'lateClosesOn') : null;
    if (closes < opens || (lateC && lateC < closes)) throw bad('Dates must run opens, closes, late-closes in order');
    const money = (v: unknown, f: string) => (v === undefined || v === 0 ? 0 : minor(v, f));
    const pct = b.minAttendancePct === undefined || b.minAttendancePct === null ? null : Number(b.minAttendancePct);
    if (pct !== null && (!Number.isInteger(pct) || pct < 1 || pct > 100)) throw bad('minAttendancePct must be a whole number from 1 to 100');
    const base = money(b.feeBaseMinor, 'feeBaseMinor'), per = money(b.feePerSubjectMinor, 'feePerSubjectMinor');
    if (base + per === 0) throw bad('Set a fee, so the exam can be paid for');
    const r = await x.q.query(
      `insert into exams (tenant_id, name, currency, subjects, fee_base_minor, fee_per_subject_minor, late_fee_minor, opens_on, closes_on, late_closes_on, exam_date, min_attendance_pct, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [x.p.tenantId, str(b.name, 'name', 2, 120), b.currency ? currency(b.currency) : x.p.currency, subjects, base, per, money(b.lateFeeMinor, 'lateFeeMinor'), opens, closes, lateC, b.examDate ? isoDay(b.examDate, 'examDate') : null, pct, x.p.userId]);
    await x.audit('exam.create', 'exam', r.rows[0].id);
    return x.c.json({ id: r.rows[0].id }, 201);
  });

  k.secure('get', '/exams', [...staffRoles, 'finance'], 'Exams with registration counts', async (x) => {
    const today = todayIn(x.p.timezone);
    const rows = (await x.q.query(
      `select e.*, (select count(*)::int from exam_registrations r where r.exam_id = e.id) as registered from exams e where e.tenant_id = $1 order by e.closes_on desc`, [x.p.tenantId])).rows as (Exam & { registered: number })[];
    return { exams: rows.map((e) => ({ id: e.id, name: e.name, currency: e.currency, subjects: e.subjects, window: windowFor(e, today), opensOn: e.opens_on, closesOn: e.closes_on, lateClosesOn: e.late_closes_on, examDate: e.exam_date, minAttendancePct: e.min_attendance_pct, registered: e.registered })) };
  });

  /** Register one learner. Used by a guardian (own children) and by staff (with an override reason when ineligible). */
  const register = async (x: Ctx, examId: string, learnerId: string, b: Record<string, unknown>, staff: boolean) => {
    const e = (await x.q.query('select * from exams where id = $1 and tenant_id = $2', [examId, x.p.tenantId])).rows[0] as Exam | undefined;
    if (!e) throw new ApiError(404, 'not_found', 'Exam not found');
    const win = windowFor(e, todayIn(x.p.timezone));
    if (win === 'early') throw new ApiError(409, 'not_open', `Registration opens on ${e.opens_on}`);
    if (win === 'closed') throw new ApiError(409, 'closed', 'Registration for this exam has closed');
    const subjects = Array.isArray(b.subjects) ? b.subjects.map((s) => String(s)) : [];
    if (!subjects.length || new Set(subjects).size !== subjects.length || !subjects.every((s) => e.subjects.includes(s))) throw bad('Choose at least one subject from this exam’s list');
    const el = await eligibility(x.q, e, learnerId);
    let override: string | null = null;
    if (!el.ok) {
      if (!staff) throw new ApiError(409, 'not_eligible', el.reason);
      override = str(b.overrideReason, 'overrideReason', 3, 300);
    }
    if ((await x.q.query('select 1 from exam_registrations where exam_id = $1 and learner_id = $2', [e.id, learnerId])).rowCount) throw new ApiError(409, 'already_registered', 'This learner is already registered for this exam');
    const late = win === 'late', total = fee(e, subjects.length, late);
    const number = await nextNumber(x.q, x.p.tenantId, 'invoice', 'INV');
    const inv = (await x.q.query(
      `insert into invoices (tenant_id, learner_id, number, kind, description, currency, amount_minor, due_date, created_by) values ($1,$2,$3,'exam',$4,$5,$6,$7,$8) returning id`,
      [x.p.tenantId, learnerId, number, `${e.name} exam fee${late ? ' (late)' : ''}`, e.currency, total, late ? e.late_closes_on : e.closes_on, x.p.userId])).rows[0];
    const reg = (await x.q.query(
      `insert into exam_registrations (tenant_id, exam_id, learner_id, invoice_id, subjects, accommodations, late, override_reason, registered_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [x.p.tenantId, e.id, learnerId, inv.id, subjects, b.accommodations ? str(b.accommodations, 'accommodations', 1, 500) : null, late, override, x.p.userId])).rows[0];
    await x.audit('exam.register', 'exam_registration', reg.id, { exam: e.id, learnerId, late, override: !!override });
    return x.c.json({ id: reg.id, invoiceId: inv.id, invoiceNumber: number, amountMinor: total, late }, 201);
  };

  k.secure('post', '/exams/:id/register', [...staffRoles], 'Register a learner on their behalf (override reason needed if not eligible)', async (x) => {
    const b = await x.body();
    return register(x, uuid(x.param('id'), 'id'), uuid(b.learnerId, 'learnerId'), b, true);
  });

  k.secure('get', '/exams/:id/registrations', [...staffRoles], 'Registrations for an exam with payment and review status', async (x) => {
    const rows = (await x.q.query(
      `select r.id, l.name as learner, l.external_id as "studentId", r.subjects, r.accommodations, r.late, r.override_reason as "overrideReason", i.number as invoice, i.amount_minor::float8 as "amountMinor", i.currency,
              ${STATUS_SQL} as status, d.note as "decisionNote", d.hall_ticket as "hallTicket"
         from exam_registrations r join learners l on l.id = r.learner_id join invoices i on i.id = r.invoice_id left join exam_decisions d on d.registration_id = r.id
        where r.exam_id = $1 and r.tenant_id = $2 order by l.name`, [uuid(x.param('id'), 'id'), x.p.tenantId])).rows;
    return { registrations: rows };
  });

  k.secure('post', '/exams/registrations/:id/decide', [...staffRoles], 'Approve or reject a paid registration; approval issues the hall ticket number', async (x) => {
    const b = await x.body(), decision = String(b.decision), note = str(b.note, 'note', 3, 300);
    if (!['approved', 'rejected'].includes(decision)) throw bad('decision must be approved or rejected');
    const row = (await x.q.query(
      `select r.id, ${STATUS_SQL} as status from exam_registrations r join invoices i on i.id = r.invoice_id left join exam_decisions d on d.registration_id = r.id where r.id = $1 and r.tenant_id = $2`,
      [uuid(x.param('id'), 'id'), x.p.tenantId])).rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'Registration not found');
    if (row.status === 'approved' || row.status === 'rejected') throw new ApiError(409, 'decided', 'Already decided');
    if (decision === 'approved' && row.status !== 'in_review') throw new ApiError(409, 'unpaid', 'The exam fee is not paid yet. A hall ticket is issued only after payment is confirmed.');
    const ticket = decision === 'approved' ? await nextNumber(x.q, x.p.tenantId, 'hallticket', 'HT') : null;
    const ins = await x.q.query('insert into exam_decisions (registration_id, tenant_id, decision, note, hall_ticket, decided_by) values ($1,$2,$3,$4,$5,$6) on conflict do nothing returning registration_id', [row.id, x.p.tenantId, decision, note, ticket, x.p.userId]);
    if (!ins.rowCount) throw new ApiError(409, 'decided', 'Already decided');
    await x.audit(`exam.${decision}`, 'exam_registration', row.id, { note, ticket });
    return { status: decision, hallTicket: ticket };
  });

  // ---------- Guardian ----------
  k.secure('get', '/guardian/exams', ['guardian'], 'Exams for linked children: eligibility, fee, registration and payment status', async (x) => {
    const today = todayIn(x.p.timezone);
    const kids = (await x.q.query('select l.id, l.name from guardianships g join learners l on l.id = g.learner_id where g.user_id = $1 order by l.name', [x.p.userId])).rows;
    const exams = (await x.q.query('select * from exams where tenant_id = $1 and (late_closes_on >= $2 or closes_on >= $2 or exam_date >= $2) order by closes_on', [x.p.tenantId, today])).rows as Exam[];
    const out: unknown[] = [];
    for (const kid of kids) for (const e of exams) {
      const reg = (await x.q.query(
        `select r.id, r.subjects, r.late, i.number as invoice, i.id as "invoiceId", i.amount_minor::float8 as "amountMinor", ${STATUS_SQL} as status, d.hall_ticket as "hallTicket", d.note as "decisionNote"
           from exam_registrations r join invoices i on i.id = r.invoice_id left join exam_decisions d on d.registration_id = r.id where r.exam_id = $1 and r.learner_id = $2`, [e.id, kid.id])).rows[0] ?? null;
      const win = windowFor(e, today), el = reg ? { ok: true as const } : await eligibility(x.q, e, kid.id);
      out.push({ learnerId: kid.id, learner: kid.name, exam: { id: e.id, name: e.name, currency: e.currency, subjects: e.subjects, examDate: e.exam_date, opensOn: e.opens_on, closesOn: e.closes_on, lateClosesOn: e.late_closes_on, window: win,
        feeBaseMinor: num(e.fee_base_minor), feePerSubjectMinor: num(e.fee_per_subject_minor), lateFeeMinor: num(e.late_fee_minor) }, registration: reg,
        canRegister: !reg && (win === 'open' || win === 'late') && el.ok, blockedReason: reg ? null : win === 'early' ? `Opens ${e.opens_on}` : win === 'closed' ? 'Registration has closed' : el.ok ? null : el.reason });
    }
    return { items: out };
  });

  k.secure('post', '/guardian/exams/:id/register', ['guardian'], 'Register a linked child; creates the exam fee invoice', async (x) => {
    const b = await x.body(), learnerId = uuid(b.learnerId, 'learnerId');
    if (!(await x.q.query('select 1 from guardianships where user_id = $1 and learner_id = $2', [x.p.userId, learnerId])).rowCount) throw new ApiError(404, 'not_found', 'Learner not found');
    return register(x, uuid(x.param('id'), 'id'), learnerId, b, false);
  });

  k.secure('get', '/guardian/exams/registrations/:id/hall-ticket', ['guardian'], 'Hall ticket, available only once the registration is approved', async (x) => {
    const r = (await x.q.query(
      `select r.subjects, l.name as learner, l.external_id as "studentId", e.name as exam, e.exam_date as "examDate", t.name as institution, d.hall_ticket as "hallTicket", ${STATUS_SQL} as status
         from exam_registrations r join exams e on e.id = r.exam_id join learners l on l.id = r.learner_id join tenants t on t.id = r.tenant_id join invoices i on i.id = r.invoice_id
         join guardianships g on g.learner_id = r.learner_id and g.user_id = $3 left join exam_decisions d on d.registration_id = r.id where r.id = $1 and r.tenant_id = $2`,
      [uuid(x.param('id'), 'id'), x.p.tenantId, x.p.userId])).rows[0];
    if (!r) throw new ApiError(404, 'not_found', 'Registration not found');
    if (r.status !== 'approved') throw new ApiError(409, 'not_approved', 'The hall ticket is issued once the fee is paid and the school approves the registration');
    return r;
  });
}
