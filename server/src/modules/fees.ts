import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { limiter } from '../auth.ts';
import { scoped } from '../db.ts';
import type { Db, Tx } from '../db.ts';
import { ApiError } from '../kernel.ts';
import type { Ctx, Kernel } from '../kernel.ts';
import { receiptPdf, checkReceiptSig, signReceipt, signingKey } from '../receiptpdf.ts';
import { bad, currency, isoDay, minor, str, todayIn, uuid } from '../validate.ts';

export type PaymentsConfig = {
  /** Shared secret for provider webhooks. Without it online payment is off and only staff-recorded payments work. */
  webhookSecret?: string;
  /** Test provider: a fake hosted checkout so the whole flow can be exercised. Never move real money. */
  sandbox?: boolean;
  /** Public base URL, used in receipt verification QR codes. */
  siteUrl?: string;
};

type Status = 'initiated' | 'processing' | 'settled' | 'failed' | 'needs_reconciliation' | 'reversed';
type Pay = { id: string; tenant_id: string; invoice_id: string; payer_id: string | null; method: string; amount_minor: string; currency: string; status: Status; provider_ref: string | null };
const OPEN: Status[] = ['initiated', 'processing', 'needs_reconciliation'];
const METHODS = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'];
const UPI_RE = /^[\w.\-]{2,64}@[A-Za-z][A-Za-z0-9.\-]{1,40}$/;

/** UPI deep link per the NPCI spec: any UPI app opens pre-filled with payee, exact amount and our reference. */
export function buildUpiUri(o: { vpa: string; name?: string | null; amountMinor: number; note?: string; ref?: string }) {
  const q = new URLSearchParams();
  q.set('pa', o.vpa);
  if (o.name) q.set('pn', o.name.slice(0, 60));
  q.set('am', (o.amountMinor / 100).toFixed(2));
  q.set('cu', 'INR');
  if (o.note) q.set('tn', o.note.slice(0, 60));
  if (o.ref) q.set('tr', o.ref.slice(0, 35));
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`;
}
const MONEY_ROLES = ['owner', 'finance'] as const;

const sign = (secret: string, raw: string) => createHmac('sha256', secret).update(raw).digest('hex');
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const num = (v: unknown) => Number(v);

export async function nextNumber(q: Tx, tenantId: string, name: string, prefix: string) {
  const r = await q.query(
    `insert into counters (tenant_id, name, value) values ($1,$2,1) on conflict (tenant_id, name) do update set value = counters.value + 1 returning value`, [tenantId, name]);
  return `${prefix}-${String(r.rows[0].value).padStart(6, '0')}`;
}

const audit = (q: Tx, tenantId: string, actor: string | null, action: string, entity: string, id: string, meta: object = {}) =>
  q.query('insert into audit_events (tenant_id, actor_id, action, entity, entity_id, meta) values ($1,$2,$3,$4,$5,$6)', [tenantId, actor, action, entity, id, meta]);

const event = (q: Tx, tenantId: string, paymentId: string, type: string, o: { providerEventId?: string; amount?: number; actor?: string | null; meta?: object } = {}) =>
  q.query(`insert into payment_events (tenant_id, payment_id, type, provider_event_id, amount_minor, actor_id, meta) values ($1,$2,$3,$4,$5,$6,$7)
           on conflict do nothing returning id`, [tenantId, paymentId, type, o.providerEventId ?? null, o.amount ?? null, o.actor ?? null, o.meta ?? {}]);

/** Invoices with what has been paid. "Paid" counts settled payments only, minus recorded refunds. */
const INVOICE_SQL = `
  select i.id, i.number, i.kind, i.description, i.currency, i.amount_minor::float8 as "amountMinor", i.due_date::text as "dueDate", i.created_at as "createdAt",
         l.id as "learnerId", l.name as learner, (v.invoice_id is not null) as voided, v.reason as "voidReason",
         coalesce((select sum(p.amount_minor) from payments p where p.invoice_id = i.id and p.status = 'settled'), 0)::float8
           - coalesce((select sum(r.amount_minor) from refunds r join payments p on p.id = r.payment_id where p.invoice_id = i.id), 0)::float8 as "paidMinor"
    from invoices i join learners l on l.id = i.learner_id left join invoice_voids v on v.invoice_id = i.id`;
type InvRow = { id: string; amountMinor: number; paidMinor: number; voided: boolean; dueDate: string; [k: string]: unknown };
const invoiceStatus = (r: InvRow, today: string) =>
  r.voided ? 'void' : r.paidMinor >= r.amountMinor ? 'paid' : r.paidMinor > 0 ? 'partial' : r.dueDate < today ? 'overdue' : 'due';

async function paymentsFor(q: Tx, invoiceIds: string[]) {
  if (!invoiceIds.length) return new Map<string, any[]>();
  const rows = (await q.query(
    `select p.id, p.invoice_id as "invoiceId", p.method, p.status, p.amount_minor::float8 as "amountMinor", p.provider_ref as "providerRef", p.reference, p.created_at as "createdAt", p.updated_at as "updatedAt",
            rc.id as "receiptId", rc.number as "receiptNumber",
            (select jsonb_build_object('note', e.meta->>'note', 'eta', e.meta->>'eta', 'owner', e.meta->>'ownerName') from payment_events e where e.payment_id = p.id and e.type = 'case.update' order by e.id desc limit 1) as "case",
            coalesce((select sum(r.amount_minor) from refunds r where r.payment_id = p.id), 0)::float8 as "refundedMinor"
       from payments p left join receipts rc on rc.payment_id = p.id where p.invoice_id = any($1) order by p.created_at desc`, [invoiceIds])).rows;
  const by = new Map<string, any[]>();
  for (const r of rows) (by.get(r.invoiceId) ?? by.set(r.invoiceId, []).get(r.invoiceId)!).push(r);
  return by;
}

/** Moves a payment to a new status and issues the receipt the first time it settles. All callers go through here. */
async function setStatus(q: Tx, pay: Pay, next: Status, actor: string | null, type: string, meta: object = {}) {
  if (next === pay.status) return;
  await q.query('update payments set status = $2, updated_at = now() where id = $1', [pay.id, next]);
  await event(q, pay.tenant_id, pay.id, type, { actor, meta: { from: pay.status, to: next, ...meta } });
  await audit(q, pay.tenant_id, actor, `payment.${next}`, 'payment', pay.id, { from: pay.status, ...meta });
  if (next === 'settled') await issueReceipt(q, { ...pay, status: next }, actor);
}

async function issueReceipt(q: Tx, pay: Pay, actor: string | null) {
  if ((await q.query('select 1 from receipts where payment_id = $1', [pay.id])).rowCount) return; // a payment gets one receipt, ever
  const d = (await q.query(
    `select i.number as inv, i.description, i.kind, l.name as learner, t.name as institution, u.name as payer
       from invoices i join learners l on l.id = i.learner_id join tenants t on t.id = i.tenant_id left join users u on u.id = $2 where i.id = $1`, [pay.invoice_id, pay.payer_id])).rows[0];
  const ref = (await q.query(`select reference, (select meta->>'utr' from payment_events e where e.payment_id = $1 and e.type = 'payer.claimed' order by e.id desc limit 1) as utr from payments where id = $1`, [pay.id])).rows[0];
  const number = await nextNumber(q, pay.tenant_id, 'receipt', 'RCT');
  const r = (await q.query(
    `insert into receipts (tenant_id, payment_id, number, amount_minor, currency, snapshot) values ($1,$2,$3,$4,$5,$6) returning id`,
    [pay.tenant_id, pay.id, number, pay.amount_minor, pay.currency, { institution: d.institution, learner: d.learner, payer: d.payer ?? null, invoice: d.inv, description: d.description, kind: d.kind, method: pay.method, providerRef: pay.provider_ref, reference: ref.reference ?? null, utr: ref.utr ?? null }])).rows[0];
  await audit(q, pay.tenant_id, actor, 'receipt.issue', 'receipt', r.id, { number, payment: pay.id });
}

/**
 * One provider message. Duplicates (same event id) are ignored, out-of-order or contradictory messages
 * never silently undo a settled payment: they park it in `needs_reconciliation` for a human.
 */
async function applyProviderEvent(q: Tx, pay: Pay, ev: { id: string; type: string; amountMinor?: number }) {
  const first = await event(q, pay.tenant_id, pay.id, `provider.${ev.type}`, { providerEventId: ev.id, amount: ev.amountMinor });
  if (!first.rowCount) return { duplicate: true, status: pay.status };
  let next: Status = pay.status, reason: string | undefined;
  if (ev.type === 'processing') { if (pay.status === 'initiated') next = 'processing'; }
  else if (ev.type === 'settled') {
    if (ev.amountMinor !== num(pay.amount_minor)) { if (pay.status !== 'settled') { next = 'needs_reconciliation'; reason = 'amount_mismatch'; } }
    else if (['initiated', 'processing', 'failed', 'needs_reconciliation'].includes(pay.status)) { next = 'settled'; if (pay.status === 'failed') reason = 'late_settlement_after_failure'; }
  } else if (ev.type === 'failed') {
    if (pay.status === 'initiated' || pay.status === 'processing') next = 'failed';
    else if (pay.status === 'settled') { next = 'needs_reconciliation'; reason = 'failed_after_settled'; }
  } else if (ev.type === 'refunded' || ev.type === 'chargeback') {
    if (pay.status === 'settled') { next = 'needs_reconciliation'; reason = `provider_${ev.type}`; }
  } else throw bad('unknown event type');
  await setStatus(q, pay, next, null, 'status.change', { providerEvent: ev.id, ...(reason ? { reason } : {}) });
  return { duplicate: false, status: next };
}

export function feesModule(k: Kernel, db: Db, cfg: PaymentsConfig = {}) {
  const hookLimit = limiter(300, 60_000);
  const readers = ['owner', 'registrar', 'finance'] as const;
  const onlineReady = !!(cfg.sandbox && cfg.webhookSecret);

  const loadInvoice = async (x: Ctx, id: string) => {
    const r = (await x.q.query(`${INVOICE_SQL} where i.id = $1 and i.tenant_id = $2`, [id, x.p.tenantId])).rows[0] as InvRow | undefined;
    if (!r) throw new ApiError(404, 'not_found', 'Invoice not found');
    return r;
  };
  const loadPayment = async (x: Ctx, id: string, lock = false) => {
    const r = (await x.q.query(`select * from payments where id = $1 and tenant_id = $2 ${lock ? 'for update' : ''}`, [id, x.p.tenantId])).rows[0] as Pay | undefined;
    if (!r) throw new ApiError(404, 'not_found', 'Payment not found');
    return r;
  };
  /** A guardian reaches only invoices of children linked to them; `needPay` also requires permission to pay. */
  const guardianInvoice = async (x: Ctx, id: string, needPay: boolean) => {
    const ok = await x.q.query(
      `select g.can_pay from invoices i join guardianships g on g.learner_id = i.learner_id and g.user_id = $2 where i.id = $1`, [uuid(id, 'id'), x.p.userId]);
    if (!ok.rowCount) throw new ApiError(404, 'not_found', 'Invoice not found');
    if (needPay && !ok.rows[0].can_pay) throw new ApiError(403, 'forbidden', 'Your account can view this child’s fees but is not set up to pay them. Ask the school office.');
    return loadInvoice(x, id);
  };

  /** The school's UPI id, if it set one. UPI only applies to INR invoices. */
  const upiFor = async (x: Ctx) => {
    const t = (await x.q.query('select upi_id as vpa, upi_name as name from tenants where id = $1', [x.p.tenantId])).rows[0];
    return t?.vpa ? (t as { vpa: string; name: string | null }) : null;
  };

  // ---------- Settings: the school's UPI id ----------
  k.secure('get', '/fees/settings', [...readers], 'Payment settings: UPI id and which methods are on', async (x) => {
    const t = (await x.q.query('select upi_id as "upiId", upi_name as "upiName" from tenants where id = $1', [x.p.tenantId])).rows[0];
    return { ...t, currency: x.p.currency, gateway: onlineReady, cash: true };
  });
  k.secure('put', '/fees/settings', [...MONEY_ROLES], 'Set or clear the school UPI id used for payment QR codes', async (x) => {
    const b = await x.body();
    const vpa = b.upiId ? str(b.upiId, 'upiId', 5, 100) : null;
    if (vpa && !UPI_RE.test(vpa)) throw bad('Enter a valid UPI id like school@bank');
    const name = b.upiName ? str(b.upiName, 'upiName', 2, 60) : null;
    if (vpa && !name) throw bad('Enter the name that should appear on the UPI payment screen');
    await x.db.query('update tenants set upi_id = $2, upi_name = $3 where id = $1', [x.p.tenantId, vpa, name]); // tenants has no row security; scoped by the signed-in principal
    await x.audit('settings.upi', 'tenant', x.p.tenantId, { upiId: vpa });
    return { upiId: vpa, upiName: name };
  });

  // Counter QR: the office shows this to someone paying at the desk. Nothing is recorded until staff confirm money arrived.
  k.secure('get', '/fees/invoices/:id/upi', [...MONEY_ROLES], 'UPI link for the outstanding amount, for a QR at the office counter', async (x) => {
    const inv = await loadInvoice(x, uuid(x.param('id'), 'id')), upi = await upiFor(x);
    if (!upi) throw new ApiError(409, 'upi_off', 'Set the school UPI id in payment settings first');
    if (inv.currency !== 'INR') throw new ApiError(409, 'not_inr', 'UPI works for INR invoices only');
    const left = inv.amountMinor - inv.paidMinor;
    if (inv.voided || left <= 0) throw new ApiError(409, 'paid', 'Nothing is outstanding on this invoice');
    const amount = x.qs('amountMinor') ? minor(Number(x.qs('amountMinor')), 'amountMinor') : left;
    if (amount > left) throw bad('That is more than the outstanding balance');
    const ref = `${inv.number}-${randomBytes(2).toString('hex')}`;
    return { uri: buildUpiUri({ vpa: upi.vpa, name: upi.name, amountMinor: amount, note: `${inv.number} ${inv.learner}`, ref }), amountMinor: amount, reference: ref, payee: upi.name, vpa: upi.vpa };
  });

  // ---------- Staff: invoices ----------
  k.secure('get', '/fees/invoices', [...readers], 'List invoices with paid amounts and status', async (x) => {
    const today = todayIn(x.p.timezone), want = x.qs('status'), learner = x.qs('learnerId');
    const rows = (await x.q.query(`${INVOICE_SQL} where i.tenant_id = $1 and ($2::uuid is null or i.learner_id = $2) order by i.created_at desc limit 500`, [x.p.tenantId, learner ? uuid(learner, 'learnerId') : null])).rows as InvRow[];
    const open = await x.q.query(`select invoice_id, status from payments where tenant_id = $1 and status = any($2) and method in ('online','upi')`, [x.p.tenantId, OPEN]);
    const openBy = new Map(open.rows.map((r) => [r.invoice_id, r.status]));
    const all = rows.map((r) => ({ ...r, status: invoiceStatus(r, today), openPayment: openBy.get(r.id) ?? null }));
    const counts: Record<string, number> = {};
    for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return { invoices: want ? all.filter((r) => r.status === want) : all, counts, total: all.length };
  });

  const newInvoice = async (x: Ctx, learnerId: string, b: Record<string, unknown>) => {
    const kind = String(b.kind ?? 'tuition');
    if (!['admission', 'tuition', 'exam', 'transport', 'other'].includes(kind)) throw bad('kind must be admission, tuition, exam, transport or other');
    const cur = b.currency === undefined ? x.p.currency : currency(b.currency);
    const number = await nextNumber(x.q, x.p.tenantId, 'invoice', 'INV');
    const r = await x.q.query(
      `insert into invoices (tenant_id, learner_id, number, kind, description, currency, amount_minor, due_date, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [x.p.tenantId, learnerId, number, kind, str(b.description, 'description', 2, 200), cur, minor(b.amountMinor), isoDay(b.dueDate, 'dueDate'), x.p.userId]);
    return { id: r.rows[0].id as string, number };
  };

  k.secure('post', '/fees/invoices', [...MONEY_ROLES], 'Create an invoice for one learner', async (x) => {
    const b = await x.body(), learnerId = uuid(b.learnerId, 'learnerId');
    if (!(await x.q.query('select 1 from learners where id = $1 and tenant_id = $2', [learnerId, x.p.tenantId])).rowCount) throw new ApiError(404, 'not_found', 'Learner not found');
    const inv = await newInvoice(x, learnerId, b);
    await x.audit('invoice.create', 'invoice', inv.id, { number: inv.number, learnerId });
    return x.c.json(inv, 201);
  });

  k.secure('get', '/fees/classes', [...MONEY_ROLES], 'Classes with learner counts, for invoicing a whole class', async (x) => ({
    classes: (await x.q.query(`select c.id, c.name, count(l.id)::int as learners from classes c left join enrollments e on e.class_id = c.id left join learners l on l.id = e.learner_id and not l.archived where c.tenant_id = $1 group by c.id order by c.name`, [x.p.tenantId])).rows,
  }));

  k.secure('post', '/fees/invoices/bulk', [...MONEY_ROLES], 'Create the same invoice for every learner in a class', async (x) => {
    const b = await x.body(), classId = uuid(b.classId, 'classId');
    const kids = (await x.q.query(`select l.id from enrollments e join learners l on l.id = e.learner_id and not l.archived where e.class_id = $1 and e.tenant_id = $2 order by l.name`, [classId, x.p.tenantId])).rows;
    if (!kids.length) throw bad('That class has no enrolled learners');
    const made: string[] = [];
    for (const kid of kids) made.push((await newInvoice(x, kid.id, b)).id);
    await x.audit('invoice.bulk', 'class', classId, { count: made.length });
    return x.c.json({ created: made.length }, 201);
  });

  k.secure('post', '/fees/invoices/:id/void', [...MONEY_ROLES], 'Void an invoice that has no payments (recorded, never deleted)', async (x) => {
    const inv = await loadInvoice(x, uuid(x.param('id'), 'id')), reason = str((await x.body()).reason, 'reason', 3, 300);
    if (inv.voided) throw new ApiError(409, 'already_void', 'This invoice is already void');
    if ((await x.q.query(`select 1 from payments where invoice_id = $1 and status <> 'failed'`, [inv.id])).rowCount) throw new ApiError(409, 'has_payments', 'This invoice has payments. Refund or resolve them first; a paid invoice cannot be voided.');
    await x.q.query('insert into invoice_voids (invoice_id, tenant_id, reason, actor_id) values ($1,$2,$3,$4)', [inv.id, x.p.tenantId, reason, x.p.userId]);
    await x.audit('invoice.void', 'invoice', inv.id, { reason });
  });

  k.secure('get', '/fees/invoices/:id/payments', [...readers], 'Payments for one invoice with receipts and refunds', async (x) => {
    const inv = await loadInvoice(x, uuid(x.param('id'), 'id'));
    return { payments: (await paymentsFor(x.q, [inv.id])).get(inv.id) ?? [] };
  });

  // ---------- Staff: manual (cash, bank transfer, cheque) payments ----------
  k.secure('post', '/fees/invoices/:id/payments/manual', [...MONEY_ROLES], 'Record a cash or bank payment received outside the system', async (x) => {
    const inv = await loadInvoice(x, uuid(x.param('id'), 'id')), b = await x.body();
    if (inv.voided) throw new ApiError(409, 'void', 'This invoice is void');
    const method = String(b.method), amount = minor(b.amountMinor), ref = str(b.reference, 'reference', 2, 80);
    if (!METHODS.includes(method)) throw bad(`method must be one of ${METHODS.join(', ')}`);
    if (amount > inv.amountMinor - inv.paidMinor) throw new ApiError(409, 'overpayment', 'That is more than the outstanding balance');
    if ((await x.q.query(`select 1 from payments where invoice_id = $1 and method in ('online','upi') and status = any($2)`, [inv.id, OPEN])).rowCount)
      throw new ApiError(409, 'payment_in_progress', 'An online or UPI payment for this invoice is still unresolved. Resolve it in Reconciliation first so the family is not charged twice.');
    const p = (await x.q.query(
      `insert into payments (tenant_id, invoice_id, method, reference, amount_minor, currency, status) values ($1,$2,$3,$4,$5,$6,'initiated') returning *`,
      [x.p.tenantId, inv.id, method, ref, amount, inv.currency])).rows[0] as Pay;
    await event(x.q, x.p.tenantId, p.id, 'manual.recorded', { actor: x.p.userId, amount, meta: { method, reference: ref, note: b.note ? str(b.note, 'note', 1, 300) : undefined } });
    await setStatus(x.q, p, 'settled', x.p.userId, 'status.change', { manual: true });
    const rc = (await x.q.query('select id, number from receipts where payment_id = $1', [p.id])).rows[0];
    return x.c.json({ paymentId: p.id, receiptId: rc.id, receiptNumber: rc.number }, 201);
  });

  // ---------- Staff: reconciliation ----------
  k.secure('get', '/fees/reconciliation', [...MONEY_ROLES], 'Online payments that are unresolved, with age, so none are forgotten', async (x) => {
    const rows = (await x.q.query(
      `select p.id, p.status, p.method, p.amount_minor::float8 as "amountMinor", p.currency, p.provider_ref as "providerRef", p.created_at as "createdAt", p.updated_at as "updatedAt",
              (select e.meta->>'utr' from payment_events e where e.payment_id = p.id and e.type = 'payer.claimed' order by e.id desc limit 1) as utr,
              i.number as invoice, l.name as learner, u.name as payer,
              (select jsonb_build_object('note', e.meta->>'note', 'eta', e.meta->>'eta', 'owner', e.meta->>'ownerName') from payment_events e where e.payment_id = p.id and e.type = 'case.update' order by e.id desc limit 1) as "case",
              (select e.meta->>'reason' from payment_events e where e.payment_id = p.id and e.type = 'status.change' order by e.id desc limit 1) as reason
         from payments p join invoices i on i.id = p.invoice_id join learners l on l.id = i.learner_id left join users u on u.id = p.payer_id
        where p.tenant_id = $1 and p.method in ('online','upi') and p.status = any($2) order by p.updated_at`, [x.p.tenantId, OPEN])).rows;
    return { items: rows, note: 'A payment stays here until a verified provider message or a finance user settles or fails it.' };
  });

  k.secure('get', '/fees/payments/:id', [...MONEY_ROLES], 'One payment with its full event timeline', async (x) => {
    const pay = await loadPayment(x, uuid(x.param('id'), 'id'));
    const events = (await x.q.query(`select e.id, e.type, e.amount_minor::float8 as "amountMinor", e.meta, e.created_at as "at", u.name as actor from payment_events e left join users u on u.id = e.actor_id where e.payment_id = $1 order by e.id`, [pay.id])).rows;
    const refunds = (await x.q.query(`select r.id, r.amount_minor::float8 as "amountMinor", r.reason, r.created_at as "at", u.name as actor from refunds r join users u on u.id = r.actor_id where r.payment_id = $1 order by r.created_at`, [pay.id])).rows;
    return { payment: { id: pay.id, status: pay.status, method: pay.method, amountMinor: num(pay.amount_minor), currency: pay.currency, providerRef: pay.provider_ref }, events, refunds };
  });

  k.secure('post', '/fees/payments/:id/resolve', [...MONEY_ROLES], 'Settle, fail or annotate an unresolved payment (evidence and reason required)', async (x) => {
    const pay = await loadPayment(x, uuid(x.param('id'), 'id'), true), b = await x.body(), action = String(b.action);
    const note = str(b.note, 'note', 3, 300);
    if (action === 'case') {
      const eta = b.eta ? isoDay(b.eta, 'eta') : undefined;
      await event(x.q, x.p.tenantId, pay.id, 'case.update', { actor: x.p.userId, meta: { note, eta, ownerName: x.p.name } });
      return { status: pay.status };
    }
    if (action === 'settle') {
      if (pay.status === 'settled' || pay.status === 'reversed') throw new ApiError(409, 'conflict', `This payment is already ${pay.status}`);
      await setStatus(x.q, pay, 'settled', x.p.userId, 'resolve.settle', { note, evidence: str(b.evidence, 'evidence', 3, 120) });
    } else if (action === 'fail') {
      if (!['initiated', 'processing', 'needs_reconciliation'].includes(pay.status)) throw new ApiError(409, 'conflict', `A ${pay.status} payment cannot be failed`);
      await setStatus(x.q, pay, 'failed', x.p.userId, 'resolve.fail', { note });
    } else if (action === 'keep_settled') {
      if (pay.status !== 'needs_reconciliation' || !(await x.q.query('select 1 from receipts where payment_id = $1', [pay.id])).rowCount) throw new ApiError(409, 'conflict', 'Only a reviewed, already-receipted payment can be returned to settled');
      await setStatus(x.q, pay, 'settled', x.p.userId, 'resolve.keep_settled', { note });
    } else throw bad('action must be settle, fail, keep_settled or case');
    return { status: (await loadPayment(x, pay.id)).status };
  });

  k.secure('post', '/fees/payments/:id/refund', [...MONEY_ROLES], 'Request a refund against a settled payment; the owner approves it', async (x) => {
    const pay = await loadPayment(x, uuid(x.param('id'), 'id'), true), b = await x.body(), amount = minor(b.amountMinor), reason = str(b.reason, 'reason', 3, 300);
    if (pay.status !== 'settled') throw new ApiError(409, 'conflict', 'Only a settled payment can be refunded');
    const committed = num((await x.q.query(
      `select coalesce((select sum(amount_minor) from refunds where payment_id = $1),0)
            + coalesce((select sum(r.amount_minor) from refund_requests r left join refund_decisions d on d.request_id = r.id where r.payment_id = $1 and d.request_id is null),0) as s`, [pay.id])).rows[0].s);
    if (committed + amount > num(pay.amount_minor)) throw new ApiError(409, 'over_refund', 'Refunds (including ones waiting for approval) cannot exceed the amount paid');
    const r = (await x.q.query('insert into refund_requests (tenant_id, payment_id, amount_minor, reason, requested_by) values ($1,$2,$3,$4,$5) returning id', [x.p.tenantId, pay.id, amount, reason, x.p.userId])).rows[0];
    await event(x.q, x.p.tenantId, pay.id, 'refund.requested', { actor: x.p.userId, amount, meta: { reason } });
    await x.audit('refund.request', 'payment', pay.id, { amount, reason });
    return x.c.json({ id: r.id, status: 'requested' }, 201);
  });

  k.secure('get', '/fees/refunds', [...MONEY_ROLES], 'Refund requests with their decision', async (x) => {
    const rows = (await x.q.query(
      `select r.id, r.amount_minor::float8 as "amountMinor", r.reason, r.created_at as "createdAt", ru.name as "requestedBy", p.currency, i.number as invoice, l.name as learner,
              coalesce(d.decision, 'pending') as status, d.note as "decisionNote", du.name as "decidedBy", d.created_at as "decidedAt"
         from refund_requests r join payments p on p.id = r.payment_id join invoices i on i.id = p.invoice_id join learners l on l.id = i.learner_id
         join users ru on ru.id = r.requested_by left join refund_decisions d on d.request_id = r.id left join users du on du.id = d.decided_by
        where r.tenant_id = $1 order by (d.request_id is null) desc, r.created_at desc limit 200`, [x.p.tenantId])).rows;
    return { refunds: rows };
  });

  k.secure('post', '/fees/refunds/:id/decide', ['owner'], 'Approve or reject a refund request (owner only; approval records the refund)', async (x) => {
    const b = await x.body(), decision = String(b.decision), note = str(b.note, 'note', 3, 300);
    if (!['approved', 'rejected'].includes(decision)) throw bad('decision must be approved or rejected');
    const req = (await x.q.query('select * from refund_requests where id = $1 and tenant_id = $2', [uuid(x.param('id'), 'id'), x.p.tenantId])).rows[0];
    if (!req) throw new ApiError(404, 'not_found', 'Refund request not found');
    if ((await x.q.query('select 1 from refund_decisions where request_id = $1', [req.id])).rowCount) throw new ApiError(409, 'decided', 'This request was already decided');
    // The primary key on request_id is the lock: two simultaneous decisions cannot both succeed.
    const ins = await x.q.query('insert into refund_decisions (request_id, tenant_id, decision, note, decided_by) values ($1,$2,$3,$4,$5) on conflict do nothing returning request_id', [req.id, x.p.tenantId, decision, note, x.p.userId]);
    if (!ins.rowCount) throw new ApiError(409, 'decided', 'This request was already decided');
    const selfApproved = req.requested_by === x.p.userId; // a one-person school has no one else; it is recorded so it can be reviewed
    if (decision === 'approved') {
      await x.q.query('insert into refunds (tenant_id, payment_id, amount_minor, reason, actor_id) values ($1,$2,$3,$4,$5)', [x.p.tenantId, req.payment_id, req.amount_minor, req.reason, x.p.userId]);
      await event(x.q, x.p.tenantId, req.payment_id, 'refund.recorded', { actor: x.p.userId, amount: num(req.amount_minor), meta: { reason: req.reason, selfApproved } });
    }
    await x.audit(`refund.${decision}`, 'refund_request', req.id, { note, selfApproved });
    return { status: decision, selfApproved };
  });

  // ---------- Parent / guardian ----------
  k.secure('get', '/guardian/fees', ['guardian'], 'Fees for linked children, with honest payment states', async (x) => {
    const today = todayIn(x.p.timezone), upi = await upiFor(x);
    const rows = (await x.q.query(`${INVOICE_SQL} join guardianships g on g.learner_id = i.learner_id and g.user_id = $1 where i.tenant_id = $2 order by i.due_date desc limit 300`, [x.p.userId, x.p.tenantId])).rows as InvRow[];
    const can = new Map((await x.q.query('select learner_id, can_pay from guardianships where user_id = $1', [x.p.userId])).rows.map((r) => [r.learner_id, r.can_pay]));
    const pays = await paymentsFor(x.q, rows.map((r) => r.id));
    const invoices = rows.map((r) => {
      const status = invoiceStatus(r, today), list = pays.get(r.id) ?? [];
      const open = list.find((p) => OPEN.includes(p.status));
      const outstanding = Math.max(0, r.amountMinor - r.paidMinor);
      return {
        ...r, status, outstandingMinor: outstanding, payments: list,
        openPayment: open ?? null,
        // The key trust rule: while money may have moved, tell the family not to pay again.
        doNotPayAgain: !!open && open.status !== 'initiated',
        canPay: !r.voided && outstanding > 0 && !open && !!can.get(r.learnerId as string) && onlineReady,
        canUpi: !r.voided && outstanding > 0 && !open && !!can.get(r.learnerId as string) && !!upi && r.currency === 'INR',
        payBlockedReason: r.voided || outstanding === 0 ? null : !can.get(r.learnerId as string) ? 'not_authorised' : open ? 'in_progress' : !onlineReady && !upi ? 'online_off' : null,
      };
    });
    return { invoices, onlineAvailable: onlineReady, upiAvailable: !!upi, sandbox: !!cfg.sandbox };
  });

  k.secure('post', '/guardian/invoices/:id/pay', ['guardian'], 'Start a hosted payment for (part of) an invoice', async (x) => {
    if (!onlineReady) throw new ApiError(400, 'online_off', 'Online payment is not set up for this school yet. Pay at the school office; staff will record it and you will get a receipt.');
    const inv = await guardianInvoice(x, x.param('id'), true), b = await x.body();
    if (inv.voided) throw new ApiError(409, 'void', 'This invoice is void');
    const outstanding = inv.amountMinor - inv.paidMinor;
    if (outstanding <= 0) throw new ApiError(409, 'paid', 'This invoice is already paid');
    const amount = b.amountMinor === undefined ? outstanding : minor(b.amountMinor);
    if (amount > outstanding) throw bad('That is more than the outstanding balance');
    const open = (await x.q.query(`select id, status from payments where invoice_id = $1 and method in ('online','upi') and status = any($2)`, [inv.id, OPEN])).rows[0];
    if (open) throw new ApiError(409, 'payment_in_progress', open.status === 'initiated'
      ? 'A payment for this invoice was already started. Finish it, or cancel it, before starting another.'
      : 'A payment for this invoice is still being confirmed. Do not pay again yet.');
    const ref = `sbx_${randomBytes(12).toString('base64url')}`;
    const p = (await x.q.query(
      `insert into payments (tenant_id, invoice_id, payer_id, method, provider, provider_ref, amount_minor, currency, status) values ($1,$2,$3,'online','sandbox',$4,$5,$6,'initiated') returning id`,
      [x.p.tenantId, inv.id, x.p.userId, ref, amount, inv.currency])).rows[0];
    await event(x.q, x.p.tenantId, p.id, 'checkout.created', { actor: x.p.userId, amount });
    await x.audit('payment.initiate', 'payment', p.id, { invoice: inv.id, amount });
    return x.c.json({ paymentId: p.id, checkoutUrl: `/app/pay/${p.id}` }, 201);
  });

  /** Where the provider sends the payer back. It reports state; it can never mark anything paid. */
  k.secure('get', '/guardian/payments/:id', ['guardian'], 'Current state of a payment (read-only; the return page uses this)', async (x) => {
    const pay = await loadPayment(x, uuid(x.param('id'), 'id'));
    await guardianInvoice(x, pay.invoice_id, false);
    const rc = (await x.q.query('select id, number from receipts where payment_id = $1', [pay.id])).rows[0];
    const upi = pay.method === 'upi' && pay.status === 'initiated' ? await upiFor(x) : null;
    const inv = upi ? await loadInvoice(x, pay.invoice_id) : null;
    return { method: pay.method, upi: upi && inv ? { uri: buildUpiUri({ vpa: upi.vpa, name: upi.name, amountMinor: num(pay.amount_minor), note: `${inv.number} ${inv.learner}`, ref: pay.provider_ref! }), vpa: upi.vpa, payee: upi.name } : null, id: pay.id, status: pay.status, amountMinor: num(pay.amount_minor), currency: pay.currency, providerRef: pay.provider_ref, receiptId: rc?.id ?? null, receiptNumber: rc?.number ?? null, sandbox: !!cfg.sandbox };
  });

  k.secure('post', '/guardian/payments/:id/cancel', ['guardian'], 'Abandon a payment you started but did not complete', async (x) => {
    const pay = await loadPayment(x, uuid(x.param('id'), 'id'), true);
    await guardianInvoice(x, pay.invoice_id, true);
    if (pay.payer_id !== x.p.userId) throw new ApiError(403, 'forbidden', 'Only the person who started this payment can cancel it');
    if (pay.status !== 'initiated') throw new ApiError(409, 'conflict', 'This payment is already being confirmed and cannot be cancelled. Do not pay again; the school will resolve it.');
    await setStatus(x.q, pay, 'failed', x.p.userId, 'cancelled_by_payer', { note: 'Payer abandoned checkout' });
  });

  k.secure('post', '/guardian/invoices/:id/upi', ['guardian'], 'Start a UPI payment: returns a QR link for the exact amount', async (x) => {
    const upi = await upiFor(x);
    if (!upi) throw new ApiError(400, 'upi_off', 'UPI is not set up for this school. Pay at the school office; staff will record it and you will get a receipt.');
    const inv = await guardianInvoice(x, x.param('id'), true), b = await x.body();
    if (inv.voided) throw new ApiError(409, 'void', 'This invoice is void');
    if (inv.currency !== 'INR') throw new ApiError(409, 'not_inr', 'UPI works for INR invoices only');
    const outstanding = inv.amountMinor - inv.paidMinor;
    if (outstanding <= 0) throw new ApiError(409, 'paid', 'This invoice is already paid');
    const amount = b.amountMinor === undefined ? outstanding : minor(b.amountMinor);
    if (amount > outstanding) throw bad('That is more than the outstanding balance');
    const open = (await x.q.query(`select status from payments where invoice_id = $1 and method in ('online','upi') and status = any($2)`, [inv.id, OPEN])).rows[0];
    if (open) throw new ApiError(409, 'payment_in_progress', open.status === 'initiated' ? 'A payment for this invoice was already started. Finish it, or cancel it, before starting another.' : 'A payment for this invoice is still being confirmed. Do not pay again yet.');
    const ref = `${inv.number}-${randomBytes(3).toString('hex')}`;
    const p = (await x.q.query(
      `insert into payments (tenant_id, invoice_id, payer_id, method, provider, provider_ref, amount_minor, currency, status) values ($1,$2,$3,'upi','upi',$4,$5,'INR','initiated') returning id`,
      [x.p.tenantId, inv.id, x.p.userId, ref, amount])).rows[0];
    await event(x.q, x.p.tenantId, p.id, 'upi.qr_created', { actor: x.p.userId, amount });
    await x.audit('payment.initiate', 'payment', p.id, { invoice: inv.id, amount, method: 'upi' });
    return x.c.json({ paymentId: p.id, checkoutUrl: `/app/pay/${p.id}` }, 201);
  });

  /** The payer says they paid and gives the UTR. This only asks the office to check; it never marks anything paid. */
  k.secure('post', '/guardian/payments/:id/claim', ['guardian'], 'Tell the school you paid by UPI, with the transaction id (UTR)', async (x) => {
    const pay = await loadPayment(x, uuid(x.param('id'), 'id'), true);
    await guardianInvoice(x, pay.invoice_id, true);
    if (pay.method !== 'upi' || pay.payer_id !== x.p.userId) throw new ApiError(403, 'forbidden', 'Only the person who started this UPI payment can report it');
    if (pay.status !== 'initiated') throw new ApiError(409, 'conflict', 'This payment has already been reported');
    const utr = str((await x.body()).utr, 'utr', 8, 30);
    if (!/^[A-Za-z0-9]+$/.test(utr)) throw bad('The UPI transaction id has letters and numbers only');
    if ((await x.q.query(`select 1 from payment_events where tenant_id = $1 and type = 'payer.claimed' and meta->>'utr' = $2`, [x.p.tenantId, utr])).rowCount)
      throw new ApiError(409, 'utr_used', 'That transaction id has already been reported for another payment');
    await event(x.q, x.p.tenantId, pay.id, 'payer.claimed', { actor: x.p.userId, meta: { utr } });
    await setStatus(x.q, pay, 'processing', x.p.userId, 'status.change', { claimedUtr: utr });
    return { status: 'processing' };
  });

  // ---------- Receipts ----------
  const loadReceipt = async (x: Ctx, rawId: string) => {
    const r = (await x.q.query(
      `select r.id, r.number, r.amount_minor::float8 as "amountMinor", r.currency, r.snapshot, r.issued_at as "issuedAt", p.id as "paymentId", i.learner_id as "learnerId"
         from receipts r join payments p on p.id = r.payment_id join invoices i on i.id = p.invoice_id where r.id = $1 and r.tenant_id = $2`, [uuid(rawId, 'id'), x.p.tenantId])).rows[0];
    if (!r) throw new ApiError(404, 'not_found', 'Receipt not found');
    const staff = x.p.roles.some((role) => (readers as readonly string[]).includes(role));
    if (!staff && !(x.p.roles.includes('guardian') && (await x.q.query('select 1 from guardianships where user_id = $1 and learner_id = $2', [x.p.userId, r.learnerId])).rowCount))
      throw new ApiError(404, 'not_found', 'Receipt not found'); // same answer as "missing", so ids cannot be probed
    const refunds = (await x.q.query('select amount_minor::float8 as "amountMinor", reason, created_at as "at" from refunds where payment_id = $1 order by created_at', [r.paymentId])).rows;
    const { learnerId: _l, paymentId: _p, ...out } = r;
    return { ...out, refunds, refundedMinor: refunds.reduce((s: number, f: any) => s + f.amountMinor, 0) };
  };
  const verifyUrl = async (id: string) => `${(cfg.siteUrl ?? '').replace(/\/$/, '')}/verify/${id}/${signReceipt(await signingKey(db), id)}`;

  k.secure('get', '/receipts/:id', [], 'A receipt, with any refunds recorded against it and its verification link', async (x) => {
    const r = await loadReceipt(x, x.param('id'));
    return { ...r, verifyUrl: await verifyUrl(r.id) };
  });
  k.secure('get', '/receipts/:id/pdf', [], 'Receipt as a PDF with a verification QR code', async (x) => {
    const r = await loadReceipt(x, x.param('id'));
    const pdf = await receiptPdf({ number: r.number, amountMinor: r.amountMinor, currency: r.currency, issuedAt: new Date(r.issuedAt), snapshot: r.snapshot, verifyUrl: await verifyUrl(r.id), refunds: r.refunds.map((f: any) => ({ ...f, at: new Date(f.at) })) });
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${r.number}.pdf"` } });
  });

  /** Public check that a receipt is genuine. Shows no learner or payer names. */
  const verifyLimit = limiter(60, 60_000);
  const verify = async (id: string, sig: string, ip: string) => {
    if (!verifyLimit(ip)) throw new ApiError(429, 'rate_limited', 'Too many requests');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !checkReceiptSig(await signingKey(db), id, sig)) return null;
    const r = (await db.query(
      `select r.number, r.amount_minor::float8 as "amountMinor", r.currency, r.issued_at as "issuedAt", t.name as institution,
              coalesce((select sum(f.amount_minor) from refunds f where f.payment_id = r.payment_id), 0)::float8 as "refundedMinor"
         from receipts r join tenants t on t.id = r.tenant_id where r.id = $1`, [id])).rows[0];
    return r ?? null;
  };
  k.pub('get', '/verify/:id/:sig', 'Check a receipt is genuine (public, no personal data)', async ({ c, ip }) => {
    const r = await verify(c.req.param('id') ?? '', c.req.param('sig') ?? '', ip);
    return r ? { valid: true, ...r } : c.json({ valid: false }, 404);
  });
  const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  k.app.get('/verify/:id/:sig', async (c) => {
    const r = await verify(c.req.param('id'), c.req.param('sig'), c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local');
    const body = r
      ? `<h1>This receipt is genuine</h1><p>Issued by <b>${esc(r.institution)}</b>.</p><dl><dt>Receipt</dt><dd>${esc(r.number)}</dd><dt>Amount</dt><dd>${esc(r.currency)} ${(r.amountMinor / 100).toFixed(2)}</dd><dt>Date</dt><dd>${esc(new Date(r.issuedAt).toISOString().slice(0, 10))}</dd>${r.refundedMinor ? `<dt>Refunded since</dt><dd>${esc(r.currency)} ${(r.refundedMinor / 100).toFixed(2)}</dd>` : ''}</dl><p>Names are not shown here. Compare with the paper or PDF receipt.</p>`
      : '<h1>We could not verify this receipt</h1><p>The link is damaged or the receipt does not exist. Ask the school office.</p>';
    return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Receipt check</title><link rel="stylesheet" href="/s/site.css"></head><body><main>${body}</main></body></html>`, r ? 200 : 404, { 'X-Robots-Tag': 'noindex, nofollow' });
  });

  // ---------- Provider webhook (signed). Tenant comes from the payment, never from the caller. ----------
  k.pub('post', '/webhooks/payments/sandbox', 'Signed provider notification: processing, settled, failed, refunded', async ({ c, ip }) => {
    if (!cfg.webhookSecret || !cfg.sandbox) throw new ApiError(503, 'not_configured', 'Online payments are not configured');
    if (!hookLimit(ip)) throw new ApiError(429, 'rate_limited', 'Too many requests');
    const raw = await c.req.text();
    if (!safeEq(c.req.header('x-signature') ?? '', sign(cfg.webhookSecret, raw))) throw new ApiError(401, 'bad_signature', 'Signature check failed');
    return handleProviderEvent(raw);
  });

  async function handleProviderEvent(raw: string) {
    let b: any;
    try { b = JSON.parse(raw); } catch { throw bad('invalid JSON'); }
    const evId = str(b?.eventId, 'eventId', 3, 120), type = str(b?.type, 'type', 3, 40), ref = str(b?.providerRef, 'providerRef', 3, 100);
    const amount = b.amountMinor === undefined ? undefined : minor(b.amountMinor);
    const found = (await db.query(`select id, tenant_id from payments where provider = 'sandbox' and provider_ref = $1`, [ref])).rows[0];
    if (!found) throw new ApiError(404, 'unknown_payment', 'No such payment'); // provider will retry; nothing to do until it exists
    return scoped(db, found.tenant_id, async (q) => {
      const pay = (await q.query('select * from payments where id = $1 for update', [found.id])).rows[0] as Pay;
      return applyProviderEvent(q, pay, { id: evId, type, amountMinor: amount });
    });
  }

  /** Sandbox only: stands in for the provider's hosted page by sending a properly signed webhook. */
  k.secure('post', '/guardian/payments/:id/sandbox', ['guardian'], 'Sandbox checkout: choose the outcome the test provider reports', async (x) => {
    if (!cfg.sandbox || !cfg.webhookSecret) throw new ApiError(404, 'not_found', 'No such endpoint');
    const pay = await loadPayment(x, uuid(x.param('id'), 'id'));
    await guardianInvoice(x, pay.invoice_id, true);
    const outcome = String((await x.body()).outcome);
    if (!['processing', 'settled', 'failed'].includes(outcome)) throw bad('outcome must be processing, settled or failed');
    const locked = (await x.q.query('select * from payments where id = $1 for update', [pay.id])).rows[0] as Pay;
    // Same core as the real webhook (idempotency, state machine, receipt); only the signature step is skipped because the guardian session is the authority here.
    return applyProviderEvent(x.q, locked, { id: `evt_${randomBytes(9).toString('base64url')}`, type: outcome, amountMinor: num(pay.amount_minor) });
  });
}

export { sign as signPaymentBody };
