import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { enterTenant } from '../src/db.ts';
import { signPaymentBody } from '../src/modules/fees.ts';
import { WEBHOOK_SECRET, client, freshApp } from './helpers.ts';

const PW = 'correct horse battery';
type Cl = ReturnType<typeof client>;
let env: Awaited<ReturnType<typeof freshApp>>;
before(async () => { env = await freshApp(); });
after(async () => { await env.close(); });

const mk = async (owner: Cl, mail: string, roles: string[]) => {
  assert.equal((await owner.post('/api/v1/users', { email: mail, name: 'P ' + mail.split('@')[0], password: PW, roles })).status, 201);
  const c = client(env.app);
  assert.equal((await c.post('/api/v1/auth/login', { email: mail, password: PW })).status, 200);
  return c;
};
/** Send a provider webhook the way a real provider would: no cookie, no CSRF header, HMAC over the raw body. */
const hook = async (evt: object, secret = WEBHOOK_SECRET) => {
  const raw = JSON.stringify(evt);
  const res = await env.app.request('http://localhost/api/v1/webhooks/payments/sandbox', { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': signPaymentBody(secret, raw), host: 'localhost' }, body: raw });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};

describe('fees and verified payments', () => {
  let owner: Cl, finance: Cl, teacher: Cl, parent: Cl, stranger: Cl, linkOnly: Cl;
  let learnerId: string, otherLearner: string, invoiceId: string;

  const fees = async () => (await parent.get('/api/v1/guardian/fees')).data;
  const inv = async (id = invoiceId) => (await fees()).invoices.find((i: any) => i.id === id);
  const startPay = async (id = invoiceId, amountMinor?: number) => parent.post(`/api/v1/guardian/invoices/${id}/pay`, amountMinor ? { amountMinor } : {});
  const providerRef = async (paymentId: string) => (await finance.get(`/api/v1/fees/payments/${paymentId}`)).data.payment.providerRef as string;
  const newInvoice = async (amountMinor = 500000, dueDate = '2999-01-01') =>
    (await finance.post('/api/v1/fees/invoices', { learnerId, description: 'Term 1 tuition', kind: 'tuition', amountMinor, dueDate })).data.id as string;

  before(async () => {
    owner = client(env.app);
    assert.equal((await owner.post('/api/v1/tenants', { institution: 'Fee School', name: 'Owner', email: 'o@fee.test', password: PW, timezone: 'Asia/Kolkata' })).status, 201);
    finance = await mk(owner, 'fin@fee.test', ['finance']);
    teacher = await mk(owner, 'teach@fee.test', ['teacher']);
    parent = await mk(owner, 'parent@fee.test', ['guardian']);
    stranger = await mk(owner, 'stranger@fee.test', ['guardian']);
    linkOnly = await mk(owner, 'sponsor@fee.test', ['guardian']);
    learnerId = (await owner.post('/api/v1/learners', { name: 'Asha Rao', externalId: 'F-1' })).data.id;
    otherLearner = (await owner.post('/api/v1/learners', { name: 'Ravi Nair', externalId: 'F-2' })).data.id;
    assert.equal((await owner.post(`/api/v1/learners/${learnerId}/guardians`, { email: 'parent@fee.test' })).status, 201);
    assert.equal((await owner.post(`/api/v1/learners/${learnerId}/guardians`, { email: 'sponsor@fee.test', canPay: false })).status, 201);
    assert.equal((await owner.post(`/api/v1/learners/${otherLearner}/guardians`, { email: 'stranger@fee.test' })).status, 201);
    invoiceId = await newInvoice();
  });

  it('only finance and owner create invoices; amounts are whole minor units', async () => {
    assert.equal((await teacher.post('/api/v1/fees/invoices', { learnerId, description: 'x', amountMinor: 100, dueDate: '2999-01-01' })).status, 403);
    assert.equal((await parent.get('/api/v1/fees/invoices')).status, 403);
    for (const amountMinor of [0, -5, 10.5, '100']) {
      assert.equal((await finance.post('/api/v1/fees/invoices', { learnerId, description: 'bad', amountMinor, dueDate: '2999-01-01' })).status, 400, String(amountMinor));
    }
    const list = (await finance.get('/api/v1/fees/invoices')).data;
    assert.equal(list.invoices[0].number, 'INV-000001');
    assert.equal(list.invoices[0].status, 'due');
  });

  it('shows a late invoice as overdue and creates one per enrolled learner in bulk', async () => {
    const late = (await finance.post('/api/v1/fees/invoices', { learnerId, description: 'Old fee', amountMinor: 100, dueDate: '2020-01-01' })).data.id;
    assert.equal((await inv(late)).status, 'overdue');
    const cls = (await owner.post('/api/v1/classes', { name: '7A' })).data.id;
    await owner.post(`/api/v1/classes/${cls}/enrollments`, { learnerId });
    await owner.post(`/api/v1/classes/${cls}/enrollments`, { learnerId: otherLearner });
    const r = await finance.post('/api/v1/fees/invoices/bulk', { classId: cls, description: 'Lab fee', kind: 'other', amountMinor: 25000, dueDate: '2999-06-01' });
    assert.equal(r.status, 201);
    assert.equal(r.data.created, 2);
  });

  it('a guardian sees only their own children and a link-only guardian cannot pay', async () => {
    assert.ok(await inv());
    const others = (await stranger.get('/api/v1/guardian/fees')).data.invoices;
    assert.ok(others.every((i: any) => i.learnerId === otherLearner));
    assert.equal((await stranger.post(`/api/v1/guardian/invoices/${invoiceId}/pay`, {})).status, 404);
    const sponsor = (await linkOnly.get('/api/v1/guardian/fees')).data.invoices.find((i: any) => i.id === invoiceId);
    assert.equal(sponsor.canPay, false);
    assert.equal(sponsor.payBlockedReason, 'not_authorised');
    assert.equal((await linkOnly.post(`/api/v1/guardian/invoices/${invoiceId}/pay`, {})).status, 403);
  });

  it('never marks paid from the return page; only a verified settlement does, and it issues one receipt', async () => {
    const start = await startPay();
    assert.equal(start.status, 201);
    const payId = start.data.paymentId as string, ref = await providerRef(payId);
    // The payer lands back on the school's page: still not paid.
    assert.equal((await parent.get(`/api/v1/guardian/payments/${payId}`)).data.status, 'initiated');
    assert.equal((await inv()).status, 'due');
    // Forged and unsigned messages are rejected.
    assert.equal((await hook({ eventId: 'evt_1', type: 'settled', providerRef: ref, amountMinor: 500000 }, 'wrong-secret')).status, 401);
    assert.equal((await env.app.request('http://localhost/api/v1/webhooks/payments/sandbox', { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await inv()).status, 'due');
    // A second attempt while one is open is refused.
    const again = await startPay();
    assert.equal(again.status, 409);
    assert.equal(again.data.error.code, 'payment_in_progress');
    // Verified settlement.
    const evt = { eventId: 'evt_settle_1', type: 'settled', providerRef: ref, amountMinor: 500000 };
    assert.equal((await hook(evt)).data.status, 'settled');
    const paid = await inv();
    assert.equal(paid.status, 'paid');
    assert.equal(paid.outstandingMinor, 0);
    assert.match(paid.payments[0].receiptNumber, /^RCT-\d{6}$/);
    // Provider retries the same event: nothing changes, still one receipt.
    assert.equal((await hook(evt)).data.duplicate, true);
    assert.equal((await env.db.query('select count(*)::int as n from receipts where payment_id = $1', [payId])).rows[0].n, 1);
    // Receipt is readable by the parent, not by an unrelated guardian.
    const rid = paid.payments[0].receiptId;
    const rc = await parent.get(`/api/v1/receipts/${rid}`);
    assert.equal(rc.status, 200);
    assert.equal(rc.data.snapshot.learner, 'Asha Rao');
    assert.equal(rc.data.amountMinor, 500000);
    assert.equal((await stranger.get(`/api/v1/receipts/${rid}`)).status, 404);
    // A paid invoice cannot be paid again.
    assert.equal((await startPay()).status, 409);
  });

  it('processing tells the family not to pay again, and a failed payment frees the invoice', async () => {
    const id = await newInvoice(120000);
    const payId = (await startPay(id)).data.paymentId, ref = await providerRef(payId);
    const h1 = await hook({ eventId: 'evt_p1', type: 'processing', providerRef: ref }); assert.equal(h1.data.status, 'processing', JSON.stringify(h1));
    const mid = await inv(id);
    assert.equal(mid.doNotPayAgain, true);
    assert.equal(mid.canPay, false);
    assert.equal((await parent.post(`/api/v1/guardian/payments/${payId}/cancel`)).status, 409); // too late to cancel; staff must resolve
    assert.equal((await hook({ eventId: 'evt_p2', type: 'failed', providerRef: ref })).data.status, 'failed');
    const after = await inv(id);
    assert.equal(after.canPay, true);
    assert.equal(after.status, 'due');
  });

  it('a payer can abandon checkout; a late settlement for it is then caught, not lost', async () => {
    const id = await newInvoice(90000);
    const payId = (await startPay(id)).data.paymentId, ref = await providerRef(payId);
    assert.equal((await parent.post(`/api/v1/guardian/payments/${payId}/cancel`)).status, 200);
    assert.equal((await inv(id)).canPay, true);
    // Money did arrive after all.
    const r = await hook({ eventId: 'late1', type: 'settled', providerRef: ref, amountMinor: 90000 });
    assert.equal(r.data.status, 'settled');
    assert.equal((await inv(id)).status, 'paid');
  });

  it('an amount mismatch is parked for reconciliation with no receipt, then resolved by finance with evidence', async () => {
    const id = await newInvoice(70000);
    const payId = (await startPay(id)).data.paymentId, ref = await providerRef(payId);
    assert.equal((await hook({ eventId: 'evt_m1', type: 'settled', providerRef: ref, amountMinor: 69000 })).data.status, 'needs_reconciliation');
    const g = await inv(id);
    assert.equal(g.status, 'due');
    assert.equal(g.doNotPayAgain, true);
    assert.equal((await env.db.query('select count(*)::int as n from receipts where payment_id = $1', [payId])).rows[0].n, 0);
    const queue = (await finance.get('/api/v1/fees/reconciliation')).data.items;
    const row = queue.find((q: any) => q.id === payId);
    assert.equal(row.reason, 'amount_mismatch');
    // Needs evidence and a note.
    assert.equal((await finance.post(`/api/v1/fees/payments/${payId}/resolve`, { action: 'settle', note: 'checked statement' })).status, 400);
    assert.equal((await teacher.post(`/api/v1/fees/payments/${payId}/resolve`, { action: 'settle', note: 'x', evidence: 'y' })).status, 403);
    assert.equal((await finance.post(`/api/v1/fees/payments/${payId}/resolve`, { action: 'case', note: 'Asked bank for statement', eta: '2999-01-03' })).status, 200);
    const shown = (await inv(id)).openPayment;
    assert.equal(shown.case.note, 'Asked bank for statement');
    assert.equal(shown.case.owner, 'P fin');
    assert.equal((await finance.post(`/api/v1/fees/payments/${payId}/resolve`, { action: 'settle', note: 'Statement shows 700.00', evidence: 'UTR 4412' })).status, 200);
    assert.equal((await inv(id)).status, 'paid');
    assert.equal((await finance.get('/api/v1/fees/reconciliation')).data.items.some((q: any) => q.id === payId), false);
  });

  it('a failure message after settlement never erases the payment or receipt', async () => {
    const id = await newInvoice(30000);
    const payId = (await startPay(id)).data.paymentId, ref = await providerRef(payId);
    await hook({ eventId: 'evt_s1', type: 'settled', providerRef: ref, amountMinor: 30000 });
    assert.equal((await hook({ eventId: 'evt_s2', type: 'failed', providerRef: ref })).data.status, 'needs_reconciliation');
    assert.equal((await env.db.query('select count(*)::int as n from receipts where payment_id = $1', [payId])).rows[0].n, 1);
    assert.equal((await finance.post(`/api/v1/fees/payments/${payId}/resolve`, { action: 'keep_settled', note: 'Provider confirmed duplicate failure notice' })).status, 200);
    assert.equal((await inv(id)).status, 'paid');
  });

  it('records cash with a receipt, blocks overpayment and keeps refunds as history', async () => {
    const id = await newInvoice(100000);
    assert.equal((await finance.post(`/api/v1/fees/invoices/${id}/payments/manual`, { method: 'cash', amountMinor: 150000, reference: 'Counter 3' })).status, 409);
    assert.equal((await teacher.post(`/api/v1/fees/invoices/${id}/payments/manual`, { method: 'cash', amountMinor: 1000, reference: 'x1' })).status, 403);
    const m = await finance.post(`/api/v1/fees/invoices/${id}/payments/manual`, { method: 'cash', amountMinor: 40000, reference: 'Counter 3, slip 88' });
    assert.equal(m.status, 201);
    assert.equal((await inv(id)).status, 'partial');
    assert.equal((await inv(id)).outstandingMinor, 60000);
    // A paid invoice cannot be voided.
    assert.equal((await finance.post(`/api/v1/fees/invoices/${id}/void`, { reason: 'mistake' })).status, 409);
    // Refund part, then too much.
    assert.equal((await finance.post(`/api/v1/fees/payments/${m.data.paymentId}/refund`, { amountMinor: 10000, reason: 'Charged twice at counter' })).status, 201);
    assert.equal((await finance.post(`/api/v1/fees/payments/${m.data.paymentId}/refund`, { amountMinor: 40000, reason: 'again' })).status, 409);
    const g = await inv(id);
    assert.equal(g.paidMinor, 30000);
    const rc = (await parent.get(`/api/v1/receipts/${m.data.receiptId}`)).data;
    assert.equal(rc.refundedMinor, 10000);
    assert.equal(rc.amountMinor, 40000); // the original receipt is not rewritten
  });

  it('voids an unpaid invoice by recording it, never deleting it', async () => {
    const id = await newInvoice(5000);
    assert.equal((await finance.post(`/api/v1/fees/invoices/${id}/void`, { reason: 'Billed to wrong learner' })).status, 200);
    const row = (await finance.get('/api/v1/fees/invoices')).data.invoices.find((i: any) => i.id === id);
    assert.equal(row.status, 'void');
    assert.equal((await startPay(id)).status, 409);
  });

  it('financial rows cannot be edited or deleted, even with SQL', async () => {
    const tenant = (await env.db.query(`select id from tenants where name = 'Fee School'`)).rows[0].id;
    const c = new pg.Client({ connectionString: env.db.options.connectionString });
    await c.connect();
    try {
      await c.query('begin');
      await enterTenant(c as any, tenant);
      for (const sql of ['update receipts set amount_minor = 1', 'delete from receipts', 'update invoices set amount_minor = 1', 'delete from payment_events', 'update refunds set amount_minor = 1']) {
        await c.query('savepoint s');
        await assert.rejects(c.query(sql), /./, sql);
        await c.query('rollback to savepoint s');
      }
    } finally { await c.query('rollback'); await c.end(); }
  });

  it('keeps one school’s money invisible to another', async () => {
    const other = client(env.app);
    assert.equal((await other.post('/api/v1/tenants', { institution: 'Rival', name: 'Rita', email: 'r@rival.test', password: PW })).status, 201);
    assert.equal((await other.get('/api/v1/fees/invoices')).data.total, 0);
    assert.equal((await other.get('/api/v1/fees/reconciliation')).data.items.length, 0);
    const rid = (await env.db.query('select id from receipts limit 1')).rows[0].id;
    assert.equal((await other.get(`/api/v1/receipts/${rid}`)).status, 404);
  });

  it('is honest when online payment is not configured', async () => {
    const off = await freshApp();
    try {
      const app = buildApp(off.db);
      const o = client(app);
      await o.post('/api/v1/tenants', { institution: 'Offline', name: 'Olga', email: 'o@off.test', password: PW });
      await o.post('/api/v1/users', { email: 'g@off.test', name: 'Gita', password: PW, roles: ['guardian'] });
      const l = (await o.post('/api/v1/learners', { name: 'Kid' })).data.id;
      await o.post(`/api/v1/learners/${l}/guardians`, { email: 'g@off.test' });
      const f = (await o.post('/api/v1/fees/invoices', { learnerId: l, description: 'Fee', amountMinor: 1000, dueDate: '2999-01-01' })).data.id;
      const g = client(app);
      await g.post('/api/v1/auth/login', { email: 'g@off.test', password: PW });
      const list = (await g.get('/api/v1/guardian/fees')).data;
      assert.equal(list.onlineAvailable, false);
      assert.equal(list.invoices[0].payBlockedReason, 'online_off');
      assert.equal((await g.post(`/api/v1/guardian/invoices/${f}/pay`, {})).data.error.code, 'online_off');
      const raw = JSON.stringify({ eventId: 'e', type: 'settled', providerRef: 'x', amountMinor: 1 });
      const res = await app.request('http://localhost/api/v1/webhooks/payments/sandbox', { method: 'POST', body: raw, headers: { 'x-signature': signPaymentBody('anything', raw) } });
      assert.equal(res.status, 503);
    } finally { await off.close(); }
  });
});
