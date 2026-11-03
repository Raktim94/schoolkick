import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api } from './api';
import { Link, navigate } from './router';
import { Empty, fmtTime, Loading, PageHead, Status, useAction, useApi } from './ui';

/* ---------- money: integer minor units on the wire, formatted for display only ---------- */
const digits = (cur: string) => new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits ?? 2;
export const money = (minor: number, cur: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(minor / 10 ** digits(cur));
const toMinor = (text: string, cur: string) => Math.round(Number(text) * 10 ** digits(cur));
const day = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const val = (f: FormEvent, n: string) => ((f.currentTarget as HTMLFormElement).elements.namedItem(n) as HTMLInputElement | HTMLSelectElement).value;

/* ---------- states: a glyph and a word, never colour alone ---------- */
const INV: Record<string, { word: string; glyph: string; tone: string }> = {
  due: { word: 'Due', glyph: '•', tone: 'info' }, overdue: { word: 'Overdue', glyph: '!', tone: 'bad' }, partial: { word: 'Partly paid', glyph: '◐', tone: 'info' },
  paid: { word: 'Paid', glyph: '✓', tone: 'ok' }, void: { word: 'Cancelled', glyph: '–', tone: 'muted' },
};
const PAY: Record<string, { word: string; glyph: string; tone: string }> = {
  initiated: { word: 'Checkout started, not finished', glyph: '…', tone: 'info' }, processing: { word: 'Waiting for the bank to confirm', glyph: '…', tone: 'info' },
  settled: { word: 'Paid', glyph: '✓', tone: 'ok' }, failed: { word: 'Not completed', glyph: '×', tone: 'muted' },
  needs_reconciliation: { word: 'Under review by the school', glyph: '!', tone: 'bad' }, reversed: { word: 'Reversed', glyph: '↩', tone: 'muted' },
};
export const Badge = ({ k, map = INV }: { k: string; map?: typeof INV }) => {
  const s = map[k] ?? { word: k, glyph: '•', tone: 'info' };
  return <span className={`pill ${s.tone}`}><i aria-hidden="true">{s.glyph}</i>{s.word}</span>;
};

type Payment = { id: string; status: string; method: string; amountMinor: number; providerRef: string | null; reference: string | null; createdAt: string; updatedAt: string; receiptId: string | null; receiptNumber: string | null; refundedMinor: number; case: { note: string | null; eta: string | null; owner: string | null } | null };
type GInvoice = { id: string; number: string; description: string; currency: string; amountMinor: number; paidMinor: number; outstandingMinor: number; dueDate: string; learner: string; status: string; payments: Payment[]; openPayment: Payment | null; doNotPayAgain: boolean; canPay: boolean; payBlockedReason: string | null };

/* ================= Parent / guardian ================= */
export function GuardianFees() {
  const { data, loading, error, reload } = useApi<{ invoices: GInvoice[]; onlineAvailable: boolean; sandbox: boolean }>('/guardian/fees');
  const act = useAction();
  if (loading && !data) return <Loading />;
  if (error && !data) return <Status kind="error">{error}</Status>;
  const pay = (inv: GInvoice) => act.run(async () => { const r = await api<{ paymentId: string }>('POST', `/guardian/invoices/${inv.id}/pay`, {}); navigate(`/pay/${r.paymentId}`); });
  const groups = new Map<string, GInvoice[]>();
  for (const i of data?.invoices ?? []) (groups.get(i.learner) ?? groups.set(i.learner, []).get(i.learner)!).push(i);
  if (!groups.size) return <><PageHead title="Fees" /><Empty title="No fees to show" hint="When the school raises a fee for your child, it appears here with its receipt once paid." /></>;
  return (
    <>
      <PageHead title="Fees" sub="Amounts are shown as paid only after the bank or school confirms them." />
      {!data?.onlineAvailable && <Status kind="info">Online payment is not set up at this school yet. Pay at the school office; staff will record it and the receipt will appear here.</Status>}
      {data?.sandbox && <Status kind="info">This school is using a test payment provider. No real money moves.</Status>}
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      {[...groups].map(([learner, list]) => (
        <section key={learner} className="stack" aria-labelledby={`f-${learner}`}>
          <h2 id={`f-${learner}`}>{learner}</h2>
          <ul className="cards wide">
            {list.map((i) => (
              <li key={i.id} className="card static">
                <div className="split"><b>{i.description}</b><Badge k={i.status} /></div>
                <p className="muted small-print">{i.number} · due {day(i.dueDate)}</p>
                <p className="amount">{money(i.outstandingMinor, i.currency)}{i.status !== 'void' && i.paidMinor > 0 && <span className="muted"> left of {money(i.amountMinor, i.currency)}</span>}</p>
                {i.doNotPayAgain && i.openPayment && (
                  <div className="notice" role="status">
                    <b>Do not pay again yet.</b>
                    <p>{i.openPayment.status === 'needs_reconciliation' ? 'We received a payment message we need to check by hand.' : 'Your payment is still being confirmed.'} If money has left your account, it will not be lost. Quote this reference if you contact the school: <code>{i.openPayment.providerRef}</code></p>
                    {i.openPayment.case?.note && <p>Update from the school{i.openPayment.case.owner ? ` (${i.openPayment.case.owner})` : ''}: {i.openPayment.case.note}{i.openPayment.case.eta ? ` Expected by ${day(i.openPayment.case.eta)}.` : ''}</p>}
                    <p className="small-print">Started {fmtTime(i.openPayment.createdAt)}.</p>
                  </div>
                )}
                {i.openPayment?.status === 'initiated' && <Link className="btn secondary" to={`/pay/${i.openPayment.id}`}>Continue or cancel payment</Link>}
                {i.canPay && <button className="btn" disabled={act.busy} onClick={() => pay(i)}>Pay {money(i.outstandingMinor, i.currency)}</button>}
                {i.payBlockedReason === 'not_authorised' && <p className="muted small-print">Your account can see this fee but is not set up to pay it. Ask the school office.</p>}
                {i.payments.filter((p) => p.status === 'settled').map((p) => (
                  <p key={p.id} className="small-print">Paid {money(p.amountMinor, i.currency)} on {day(p.updatedAt.slice(0, 10))}{p.refundedMinor > 0 && <> · refunded {money(p.refundedMinor, i.currency)}</>} · <Link className="link" to={`/receipts/${p.receiptId}`}>Receipt {p.receiptNumber}</Link></p>
                ))}
                {i.payments.some((p) => p.status === 'failed') && <p className="muted small-print">{i.payments.filter((p) => p.status === 'failed').length} earlier attempt(s) did not complete.</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="muted small-print"><button className="linklike" onClick={reload}>Refresh</button></p>
    </>
  );
}

/** Sandbox hosted checkout. A real provider's page replaces this; the return state is still read from the server, never assumed. */
export function Checkout({ id }: { id: string }) {
  type P = { id: string; status: string; amountMinor: number; currency: string; providerRef: string; receiptId: string | null; receiptNumber: string | null; sandbox: boolean };
  const { data, error, reload } = useApi<P>(`/guardian/payments/${id}`);
  const act = useAction();
  useEffect(() => {
    if (!data || !['initiated', 'processing'].includes(data.status)) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [data?.status, reload]);
  if (error && !data) return <Status kind="error">{error}</Status>;
  if (!data) return <Loading />;
  const send = (outcome: string) => act.run(async () => { await api('POST', `/guardian/payments/${id}/sandbox`, { outcome }); reload(); });
  const cancel = () => act.run(async () => { await api('POST', `/guardian/payments/${id}/cancel`); reload(); });
  return (
    <>
      <PageHead title="Payment" sub={`Reference ${data.providerRef}`} />
      <div className="panel stack">
        <p className="amount">{money(data.amountMinor, data.currency)}</p>
        <p role="status"><Badge k={data.status} map={PAY} /></p>
        {data.status === 'settled' && <p>Thank you. <Link className="link" to={`/receipts/${data.receiptId}`}>View receipt {data.receiptNumber}</Link></p>}
        {data.status === 'processing' && <div className="notice"><b>Do not pay again yet.</b><p>The bank has not confirmed this payment. This page updates by itself.</p></div>}
        {data.status === 'needs_reconciliation' && <div className="notice"><b>Do not pay again yet.</b><p>The school will check this payment and update you. Keep the reference above.</p></div>}
        {data.status === 'failed' && <p>This payment did not complete, so nothing was charged to the school. You can go back and try again.</p>}
        {data.sandbox && ['initiated', 'processing'].includes(data.status) && (
          <fieldset className="sandbox"><legend>Test provider (no real money)</legend>
            <p className="muted small-print">A real provider would show its own page here. Choose what it should report back.</p>
            <div className="row">
              <button className="btn" disabled={act.busy} onClick={() => send('settled')}>Report success</button>
              <button className="btn secondary" disabled={act.busy} onClick={() => send('processing')}>Report “still processing”</button>
              <button className="btn secondary" disabled={act.busy} onClick={() => send('failed')}>Report failure</button>
            </div>
          </fieldset>
        )}
        {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
        <div className="row">
          {data.status === 'initiated' && <button className="btn secondary" disabled={act.busy} onClick={cancel}>I did not pay, cancel this</button>}
          <Link className="btn secondary" to="/fees">Back to fees</Link>
        </div>
      </div>
    </>
  );
}

/* ================= Receipt (also the print layout) ================= */
export function Receipt({ id }: { id: string }) {
  const { data, error } = useApi<{ number: string; amountMinor: number; currency: string; issuedAt: string; snapshot: Record<string, string | null>; refunds: { amountMinor: number; reason: string; at: string }[]; refundedMinor: number }>(`/receipts/${id}`);
  if (error && !data) return <Status kind="error">{error}</Status>;
  if (!data) return <Loading />;
  const s = data.snapshot;
  return (
    <>
      <PageHead title={`Receipt ${data.number}`}><button className="btn secondary" onClick={() => window.print()}>Print or save as PDF</button></PageHead>
      <article className="paper" aria-label={`Receipt ${data.number}`}>
        <header><h2>{s.institution}</h2><p className="muted">Payment receipt</p></header>
        <dl className="facts">
          <div><dt>Receipt number</dt><dd>{data.number}</dd></div>
          <div><dt>Date and time</dt><dd>{fmtTime(data.issuedAt)}</dd></div>
          <div><dt>Learner</dt><dd>{s.learner}</dd></div>
          {s.payer && <div><dt>Paid by</dt><dd>{s.payer}</dd></div>}
          <div><dt>For</dt><dd>{s.description} ({s.invoice})</dd></div>
          <div><dt>Method</dt><dd>{(s.method ?? '').replace('_', ' ')}</dd></div>
          {s.providerRef && <div><dt>Transaction reference</dt><dd><code>{s.providerRef}</code></dd></div>}
        </dl>
        <p className="amount total">{money(data.amountMinor, data.currency)} <span className="muted">paid</span></p>
        {data.refunds.length > 0 && (
          <section><h3>Refunds recorded</h3>
            <ul className="plain-rows">{data.refunds.map((r, n) => <li key={n}><span>{day(r.at.slice(0, 10))} · {r.reason}</span><b>−{money(r.amountMinor, data.currency)}</b></li>)}</ul>
            <p className="muted small-print">This receipt is not changed by a refund. Net paid: {money(data.amountMinor - data.refundedMinor, data.currency)}.</p>
          </section>
        )}
      </article>
    </>
  );
}

/* ================= Staff: invoices ================= */
type SInvoice = { id: string; number: string; description: string; currency: string; amountMinor: number; paidMinor: number; dueDate: string; learner: string; status: string; openPayment: string | null };
const FILTERS = ['all', 'overdue', 'due', 'partial', 'paid', 'void'];

export function StaffFees({ canEdit, currency }: { canEdit: boolean; currency: string }) {
  const [filter, setFilter] = useState('all');
  const { data, loading, error, reload } = useApi<{ invoices: SInvoice[]; counts: Record<string, number>; total: number }>('/fees/invoices');
  const learners = useApi<{ learners: { id: string; name: string; external_id: string | null }[] }>(canEdit ? '/learners' : null);
  const act = useAction();
  const create = (e: FormEvent) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    act.run(async () => {
      await api('POST', '/fees/invoices', { learnerId: val(e, 'learner'), description: val(e, 'description'), kind: val(e, 'kind'), amountMinor: toMinor(val(e, 'amount'), currency), dueDate: val(e, 'due') });
      f.reset(); reload(); return 'Invoice created.';
    });
  };
  const rows = (data?.invoices ?? []).filter((i) => filter === 'all' || i.status === filter);
  return (
    <>
      <PageHead title="Fees" sub="Invoices, payments and receipts for this institution." />
      {canEdit && (
        <details className="import" open={!data?.total}>
          <summary>Create an invoice</summary>
          <form className="grid-form" onSubmit={create}>
            <label>Learner<select name="learner" required defaultValue=""><option value="" disabled>Choose…</option>{learners.data?.learners.map((l) => <option key={l.id} value={l.id}>{l.name}{l.external_id ? ` (${l.external_id})` : ''}</option>)}</select></label>
            <label>Description<input name="description" required minLength={2} maxLength={200} placeholder="Term 1 tuition" /></label>
            <label>Type<select name="kind" defaultValue="tuition"><option value="tuition">Tuition</option><option value="admission">Admission</option><option value="exam">Exam</option><option value="transport">Transport</option><option value="other">Other</option></select></label>
            <label>Amount ({currency})<input name="amount" type="number" inputMode="decimal" min="0.01" step={1 / 10 ** digits(currency)} required /></label>
            <label>Due date<input name="due" type="date" required /></label>
            <button className="btn" disabled={act.busy}>Create invoice</button>
          </form>
        </details>
      )}
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      <div className="toolbar" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => <button key={f} className={`chip${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : INV[f].word} <span className="muted">{f === 'all' ? data?.total ?? 0 : data?.counts[f] ?? 0}</span></button>)}
      </div>
      {loading && !data ? <Loading /> : error && !data ? <Status kind="error">{error}</Status> : !rows.length ? <Empty title={data?.total ? 'No invoices match this filter' : 'No invoices yet'} hint={canEdit && !data?.total ? 'Create the first invoice above.' : undefined} /> : (
        <div className="scroll">
          <table className="table">
            <caption>{rows.length} invoice{rows.length === 1 ? '' : 's'}</caption>
            <thead><tr><th>Invoice</th><th>Learner</th><th>Due</th><th className="num">Amount</th><th className="num">Paid</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
            <tbody>{rows.map((i) => <InvoiceRow key={i.id} i={i} canEdit={canEdit} onDone={reload} />)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function InvoiceRow({ i, canEdit, onDone }: { i: SInvoice; canEdit: boolean; onDone: () => void }) {
  const [open, setOpen] = useState<null | 'pay' | 'void'>(null);
  const act = useAction();
  const left = i.amountMinor - i.paidMinor;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (open === 'pay') {
        const r = await api<{ receiptId: string; receiptNumber: string }>('POST', `/fees/invoices/${i.id}/payments/manual`, { method: val(e, 'method'), amountMinor: toMinor(val(e, 'amount'), i.currency), reference: val(e, 'ref') });
        setOpen(null); onDone(); return `Recorded. Receipt ${r.receiptNumber} issued.`;
      }
      await api('POST', `/fees/invoices/${i.id}/void`, { reason: val(e, 'reason') });
      setOpen(null); onDone(); return 'Invoice cancelled.';
    });
  };
  const cell = (n: ReactNode) => n;
  return (
    <>
      <tr>
        <td><b>{i.number}</b><br /><span className="muted">{i.description}</span></td>
        <td>{i.learner}</td><td>{day(i.dueDate)}</td>
        <td className="num">{money(i.amountMinor, i.currency)}</td><td className="num">{money(i.paidMinor, i.currency)}</td>
        <td><Badge k={i.status} />{i.openPayment && <div className="small-print">Online payment: {PAY[i.openPayment]?.word.toLowerCase()}</div>}</td>
        <td>{cell(canEdit && i.status !== 'paid' && i.status !== 'void' && (
          <div className="row tight">
            <button className="btn secondary" onClick={() => setOpen(open === 'pay' ? null : 'pay')} aria-expanded={open === 'pay'}>Record payment</button>
            {i.paidMinor === 0 && <button className="btn secondary" onClick={() => setOpen(open === 'void' ? null : 'void')} aria-expanded={open === 'void'}>Cancel</button>}
          </div>
        ))}</td>
      </tr>
      {open && (
        <tr><td colSpan={7}>
          <form className="grid-form" onSubmit={submit}>
            {open === 'pay' ? (<>
              <label>Method<select name="method" defaultValue="cash"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
              <label>Amount received ({i.currency})<input name="amount" type="number" step={1 / 10 ** digits(i.currency)} min="0.01" required defaultValue={left / 10 ** digits(i.currency)} /></label>
              <label>Reference (slip, UTR, cheque no.)<input name="ref" required minLength={2} maxLength={80} /></label>
            </>) : <label>Reason for cancelling<input name="reason" required minLength={3} maxLength={300} /></label>}
            <button className="btn" disabled={act.busy}>{open === 'pay' ? 'Record and issue receipt' : 'Cancel invoice'}</button>
          </form>
        </td></tr>
      )}
      {act.msg && <tr><td colSpan={7}><Status kind={act.msg.kind}>{act.msg.text}</Status></td></tr>}
    </>
  );
}

/* ================= Staff: reconciliation queue ================= */
type RItem = { id: string; status: string; amountMinor: number; currency: string; providerRef: string; createdAt: string; updatedAt: string; invoice: string; learner: string; payer: string | null; reason: string | null; case: { note: string | null; eta: string | null; owner: string | null } | null };
const REASON: Record<string, string> = { amount_mismatch: 'Amount from the provider did not match', failed_after_settled: 'Provider said failed after it had settled', provider_refunded: 'Provider reported a refund', provider_chargeback: 'Provider reported a chargeback' };

export function Reconciliation() {
  const { data, loading, error, reload } = useApi<{ items: RItem[]; note: string }>('/fees/reconciliation');
  if (loading && !data) return <Loading />;
  if (error && !data) return <Status kind="error">{error}</Status>;
  return (
    <>
      <PageHead title="Reconciliation" sub="Online payments that are not settled. Families are told not to pay again while an item is here." />
      {!data?.items.length ? <Empty title="Nothing to reconcile" hint="Every online payment is either confirmed or failed." /> : (
        <ul className="cards wide">{data.items.map((p) => <ReconCard key={p.id} p={p} onDone={reload} />)}</ul>
      )}
    </>
  );
}

function ReconCard({ p, onDone }: { p: RItem; onDone: () => void }) {
  const act = useAction();
  const hours = Math.max(0, Math.round((Date.now() - new Date(p.createdAt).getTime()) / 3_600_000));
  const send = (action: string) => (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api('POST', `/fees/payments/${p.id}/resolve`, { action, note: val(e, 'note'), evidence: action === 'settle' ? val(e, 'evidence') : undefined, eta: action === 'case' ? val(e, 'eta') || undefined : undefined });
      onDone(); return 'Saved.';
    });
  };
  return (
    <li className="card static">
      <div className="split"><b>{p.learner}</b><Badge k={p.status} map={PAY} /></div>
      <p className="amount">{money(p.amountMinor, p.currency)}</p>
      <p className="muted small-print">{p.invoice} · {p.payer ?? 'unknown payer'} · started {hours < 1 ? 'under an hour' : `${hours} h`} ago · ref <code>{p.providerRef}</code></p>
      {p.reason && <p className="small-print"><b>Why it is here:</b> {REASON[p.reason] ?? p.reason}</p>}
      {p.case?.note && <p className="small-print"><b>Case note:</b> {p.case.note}{p.case.owner ? ` (${p.case.owner})` : ''}{p.case.eta ? `, expected ${day(p.case.eta)}` : ''}</p>}
      <details><summary className="link">Update the family</summary>
        <form className="grid-form" onSubmit={send('case')}>
          <label>Note the family will see<input name="note" required minLength={3} maxLength={300} /></label>
          <label>Expected by<input name="eta" type="date" /></label>
          <button className="btn secondary" disabled={act.busy}>Save update</button>
        </form>
      </details>
      <details><summary className="link">Confirm money received</summary>
        <form className="grid-form" onSubmit={send('settle')}>
          <label>Evidence (bank statement line, UTR)<input name="evidence" required minLength={3} maxLength={120} /></label>
          <label>What you checked<input name="note" required minLength={3} maxLength={300} /></label>
          <button className="btn" disabled={act.busy}>Mark paid and issue receipt</button>
        </form>
      </details>
      <details><summary className="link">No money received</summary>
        <form className="grid-form" onSubmit={send('fail')}>
          <label>What you checked<input name="note" required minLength={3} maxLength={300} /></label>
          <button className="btn secondary" disabled={act.busy}>Mark as not paid</button>
        </form>
      </details>
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
    </li>
  );
}
