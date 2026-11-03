import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
import { Link } from './router';
import { money } from './Fees';
import { Empty, Loading, PageHead, Status, useAction, useApi } from './ui';

const val = (f: FormEvent, n: string) => ((f.currentTarget as HTMLFormElement).elements.namedItem(n) as HTMLInputElement).value;
const day = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const minor = (t: string, cur: string) => Math.round(Number(t || 0) * 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits ?? 2));

const STATE: Record<string, [string, string, string]> = {
  awaiting_payment: ['Fee not paid yet', '•', 'info'], payment_pending: ['Payment being confirmed', '…', 'info'], in_review: ['Paid, waiting for the school to review', '…', 'info'],
  approved: ['Approved', '✓', 'ok'], rejected: ['Not accepted', '×', 'bad'],
};
const Pill = ({ k }: { k: string }) => { const [w, g, t] = STATE[k] ?? [k, '•', 'info']; return <span className={`pill ${t}`}><i aria-hidden="true">{g}</i>{w}</span>; };

/* ================= Parent ================= */
type Item = { learnerId: string; learner: string; canRegister: boolean; blockedReason: string | null;
  exam: { id: string; name: string; currency: string; subjects: string[]; examDate: string | null; opensOn: string; closesOn: string; lateClosesOn: string | null; window: string; feeBaseMinor: number; feePerSubjectMinor: number; lateFeeMinor: number };
  registration: { id: string; subjects: string[]; late: boolean; invoice: string; amountMinor: number; status: string; hallTicket: string | null; decisionNote: string | null } | null };

export function GuardianExams() {
  const { data, loading, error, reload } = useApi<{ items: Item[] }>('/guardian/exams');
  if (loading && !data) return <Loading />;
  if (error && !data) return <Status kind="error">{error}</Status>;
  return (
    <>
      <PageHead title="Exams" sub="Register, pay the exam fee and get the hall ticket here." />
      {!data?.items.length ? <Empty title="No open exams" hint="When the school opens exam registration, it appears here for each child." /> : (
        <ul className="cards wide">{data.items.map((i) => <ExamCard key={i.learnerId + i.exam.id} i={i} onDone={reload} />)}</ul>
      )}
    </>
  );
}

function ExamCard({ i, onDone }: { i: Item; onDone: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const act = useAction();
  const late = i.exam.window === 'late';
  const total = i.exam.feeBaseMinor + i.exam.feePerSubjectMinor * picked.length + (late ? i.exam.lateFeeMinor : 0);
  const submit = (e: FormEvent) => { e.preventDefault(); act.run(async () => { await api('POST', `/guardian/exams/${i.exam.id}/register`, { learnerId: i.learnerId, subjects: picked, accommodations: val(e, 'acc') || undefined }); onDone(); return 'Registered. Pay the exam fee under Fees to continue.'; }); };
  return (
    <li className="card static">
      <div className="split"><b>{i.exam.name}</b>{i.registration && <Pill k={i.registration.status} />}</div>
      <p className="muted small-print">{i.learner}{i.exam.examDate ? ` · exam on ${day(i.exam.examDate)}` : ''} · register by {day(i.exam.closesOn)}{i.exam.lateClosesOn ? ` (late until ${day(i.exam.lateClosesOn)}, extra ${money(i.exam.lateFeeMinor, i.exam.currency)})` : ''}</p>
      {i.registration ? (
        <>
          <p>Subjects: {i.registration.subjects.join(', ')}. Fee {money(i.registration.amountMinor, i.exam.currency)} ({i.registration.invoice}){i.registration.late ? ', late' : ''}.</p>
          {['awaiting_payment', 'payment_pending'].includes(i.registration.status) && <Link className="btn" to="/fees">Go to Fees to pay</Link>}
          {i.registration.status === 'approved' && <Link className="btn" to={`/hall-ticket/${i.registration.id}`}>Open hall ticket {i.registration.hallTicket}</Link>}
          {i.registration.status === 'rejected' && <p>The school did not accept this registration: {i.registration.decisionNote}</p>}
        </>
      ) : i.canRegister ? (
        <form className="stack" onSubmit={submit}>
          <fieldset className="subjects"><legend>Subjects</legend>
            {i.exam.subjects.map((s) => <label key={s} className="check"><input type="checkbox" checked={picked.includes(s)} onChange={(e) => setPicked(e.target.checked ? [...picked, s] : picked.filter((x) => x !== s))} />{s}</label>)}
          </fieldset>
          <label>Accommodations needed (optional)<input name="acc" maxLength={500} /></label>
          <p className="amount" aria-live="polite">{picked.length ? money(total, i.exam.currency) : 'Choose subjects to see the fee'}</p>
          <button className="btn" disabled={act.busy || !picked.length}>Register and create the fee</button>
          {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
        </form>
      ) : <Status kind="info">{i.blockedReason}</Status>}
    </li>
  );
}

export function HallTicket({ id }: { id: string }) {
  const { data, error } = useApi<{ subjects: string[]; learner: string; studentId: string | null; exam: string; examDate: string | null; institution: string; hallTicket: string }>(`/guardian/exams/registrations/${id}/hall-ticket`);
  if (error && !data) return <Status kind="error">{error}</Status>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHead title={`Hall ticket ${data.hallTicket}`}><button className="btn secondary" onClick={() => window.print()}>Print</button></PageHead>
      <article className="paper"><header><h2>{data.institution}</h2><p className="muted">Hall ticket · {data.exam}</p></header>
        <dl className="facts">
          <div><dt>Candidate</dt><dd>{data.learner}</dd></div>
          {data.studentId && <div><dt>Student ID</dt><dd>{data.studentId}</dd></div>}
          <div><dt>Hall ticket number</dt><dd>{data.hallTicket}</dd></div>
          {data.examDate && <div><dt>Exam date</dt><dd>{day(data.examDate)}</dd></div>}
          <div><dt>Subjects</dt><dd>{data.subjects.join(', ')}</dd></div>
        </dl>
        <p className="muted small-print">Bring this ticket and a school ID. The school may ask for identity proof.</p>
      </article>
    </>
  );
}

/* ================= Staff ================= */
type Ex = { id: string; name: string; currency: string; subjects: string[]; window: string; opensOn: string; closesOn: string; lateClosesOn: string | null; examDate: string | null; minAttendancePct: number | null; registered: number };
type Reg = { id: string; learner: string; studentId: string | null; subjects: string[]; accommodations: string | null; late: boolean; overrideReason: string | null; invoice: string; status: string; hallTicket: string | null };

export function StaffExams({ currency }: { currency: string }) {
  const { data, loading, error, reload } = useApi<{ exams: Ex[] }>('/exams');
  const act = useAction();
  const create = (e: FormEvent) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    act.run(async () => {
      await api('POST', '/exams', { name: val(e, 'name'), subjects: val(e, 'subjects').split(',').map((x) => x.trim()).filter(Boolean), feeBaseMinor: minor(val(e, 'base'), currency), feePerSubjectMinor: minor(val(e, 'per'), currency), lateFeeMinor: minor(val(e, 'late'), currency),
        opensOn: val(e, 'opens'), closesOn: val(e, 'closes'), lateClosesOn: val(e, 'lateCloses') || undefined, examDate: val(e, 'date') || undefined, minAttendancePct: val(e, 'att') ? Number(val(e, 'att')) : undefined });
      f.reset(); reload(); return 'Exam created.';
    });
  };
  return (
    <>
      <PageHead title="Exams" sub="Open registration, set the fee and rule, then review paid registrations." />
      <details className="import" open={!data?.exams.length}>
        <summary>Create an exam</summary>
        <form className="grid-form" onSubmit={create}>
          <label>Name<input name="name" required minLength={2} maxLength={120} /></label>
          <label>Subjects (comma separated)<input name="subjects" required placeholder="Maths, Science, English" /></label>
          <label>Base fee ({currency})<input name="base" type="number" min="0" step="0.01" defaultValue="0" /></label>
          <label>Fee per subject<input name="per" type="number" min="0" step="0.01" defaultValue="0" /></label>
          <label>Late fee (optional)<input name="late" type="number" min="0" step="0.01" defaultValue="0" /></label>
          <label>Registration opens<input name="opens" type="date" required /></label>
          <label>Closes<input name="closes" type="date" required /></label>
          <label>Late window ends (optional)<input name="lateCloses" type="date" /></label>
          <label>Exam date (optional)<input name="date" type="date" /></label>
          <label>Minimum attendance % (optional)<input name="att" type="number" min="1" max="100" /></label>
          <button className="btn" disabled={act.busy}>Create exam</button>
        </form>
      </details>
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      {loading && !data ? <Loading /> : error && !data ? <Status kind="error">{error}</Status> : !data?.exams.length ? <Empty title="No exams yet" hint="Create the first exam above." /> : (
        <ul className="cards wide">{data.exams.map((x) => <ExamAdmin key={x.id} x={x} />)}</ul>
      )}
    </>
  );
}

function ExamAdmin({ x }: { x: Ex }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card static">
      <div className="split"><b>{x.name}</b><span className="pill info">{x.window === 'open' ? 'Open' : x.window === 'late' ? 'Late window' : x.window === 'early' ? 'Not open yet' : 'Closed'}</span></div>
      <p className="muted small-print">{day(x.opensOn)} to {day(x.closesOn)}{x.lateClosesOn ? ` (late to ${day(x.lateClosesOn)})` : ''} · {x.registered} registered{x.minAttendancePct ? ` · needs ${x.minAttendancePct}% attendance` : ''}</p>
      <button className="btn secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} registrations</button>
      {open && <Registrations examId={x.id} />}
    </li>
  );
}

function Registrations({ examId }: { examId: string }) {
  const { data, loading, reload } = useApi<{ registrations: Reg[] }>(`/exams/${examId}/registrations`);
  const act = useAction();
  if (loading && !data) return <Loading />;
  const decide = (e: FormEvent, id: string, d: string) => { e.preventDefault(); act.run(async () => { const r = await api<{ hallTicket: string | null }>('POST', `/exams/registrations/${id}/decide`, { decision: d, note: val(e, 'note') }); reload(); return d === 'approved' ? `Approved. Hall ticket ${r.hallTicket}.` : 'Rejected.'; }); };
  if (!data?.registrations.length) return <p className="muted">No registrations yet.</p>;
  return (
    <div className="stack">
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      <ul className="plain-rows">{data.registrations.map((r) => (
        <li key={r.id}>
          <span><b>{r.learner}</b> {r.studentId && <span className="muted">({r.studentId})</span>} · {r.subjects.join(', ')} · {r.invoice}{r.late ? ' · late' : ''}{r.accommodations ? ` · needs: ${r.accommodations}` : ''}{r.overrideReason ? ` · eligibility overridden: ${r.overrideReason}` : ''}</span>
          <Pill k={r.status} />
          {r.status === 'in_review' && (
            <form className="grid-form" onSubmit={(e) => decide(e, r.id, (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'rejected')}>
              <label>Note<input name="note" required minLength={3} maxLength={300} /></label>
              <div className="row tight"><button className="btn" value="approved" disabled={act.busy}>Approve and issue hall ticket</button><button className="btn secondary" value="rejected" disabled={act.busy}>Reject</button></div>
            </form>
          )}
          {r.hallTicket && <span className="small-print">Hall ticket {r.hallTicket}</span>}
        </li>
      ))}</ul>
    </div>
  );
}
