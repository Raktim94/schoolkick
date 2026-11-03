import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { shiftDay, todayIn } from '../src/validate.ts';
import { client, freshApp } from './helpers.ts';

const PW = 'correct horse battery';
let env: Awaited<ReturnType<typeof freshApp>>;
before(async () => { env = await freshApp(); });
after(async () => { await env.close(); });
type Cl = ReturnType<typeof client>;
const mk = async (owner: Cl, mail: string, roles: string[]) => {
  assert.equal((await owner.post('/api/v1/users', { email: mail, name: 'User ' + mail.split('@')[0], password: PW, roles })).status, 201);
  const c = client(env.app); await c.post('/api/v1/auth/login', { email: mail, password: PW }); return c;
};

describe('exam registration and payment', () => {
  it('checks window and eligibility, bills through an invoice, and issues a hall ticket only after payment and approval', async () => {
    const owner = client(env.app);
    await owner.post('/api/v1/tenants', { institution: 'Exam School', name: 'Olga Owner', email: 'o@ex.test', password: PW, timezone: 'Asia/Kolkata' });
    const fin = await mk(owner, 'fin@ex.test', ['finance']), mum = await mk(owner, 'mum@ex.test', ['guardian']), other = await mk(owner, 'other@ex.test', ['guardian']), registrar = await mk(owner, 'reg@ex.test', ['registrar']);
    const today = todayIn('Asia/Kolkata'), d = (n: number) => shiftDay(today, n);
    const asha = (await owner.post('/api/v1/learners', { name: 'Asha Rao' })).data.id, ravi = (await owner.post('/api/v1/learners', { name: 'Ravi Nair' })).data.id;
    await owner.post(`/api/v1/learners/${asha}/guardians`, { email: 'mum@ex.test' });
    await owner.post(`/api/v1/learners/${ravi}/guardians`, { email: 'other@ex.test' });
    const cls = (await owner.post('/api/v1/classes', { name: '10A' })).data.id;
    for (const l of [asha, ravi]) await owner.post(`/api/v1/classes/${cls}/enrollments`, { learnerId: l });
    const body = { name: 'Board Prelims', subjects: ['Maths', 'Science', 'English'], feeBaseMinor: 50000, feePerSubjectMinor: 20000, lateFeeMinor: 10000, opensOn: d(-5), closesOn: d(5), lateClosesOn: d(10), examDate: d(30), minAttendancePct: 75 };
    assert.equal((await mum.post('/api/v1/exams', body)).status, 403);
    assert.equal((await registrar.post('/api/v1/exams', { ...body, feeBaseMinor: 0, feePerSubjectMinor: 0 })).status, 400);
    assert.equal((await registrar.post('/api/v1/exams', { ...body, closesOn: d(-9) })).status, 400);
    const exam = (await registrar.post('/api/v1/exams', body)).data.id;

    // No attendance on record: not eligible, and the reason says why.
    let item = (await mum.get('/api/v1/guardian/exams')).data.items[0];
    assert.equal(item.canRegister, false);
    assert.match(item.blockedReason, /none is recorded/);
    assert.equal((await mum.post(`/api/v1/guardian/exams/${exam}/register`, { learnerId: asha, subjects: ['Maths'] })).data.error.code, 'not_eligible');
    // Attendance: Asha present, Ravi absent.
    await owner.put(`/api/v1/classes/${cls}/attendance`, { marks: [{ learnerId: asha, status: 'present' }, { learnerId: ravi, status: 'absent' }] });
    item = (await mum.get('/api/v1/guardian/exams')).data.items[0];
    assert.equal(item.canRegister, true);
    assert.equal(item.exam.window, 'open');
    // Another family cannot register someone else's child.
    assert.equal((await other.post(`/api/v1/guardian/exams/${exam}/register`, { learnerId: asha, subjects: ['Maths'] })).status, 404);
    assert.equal((await mum.post(`/api/v1/guardian/exams/${exam}/register`, { learnerId: asha, subjects: ['History'] })).status, 400);
    const reg = await mum.post(`/api/v1/guardian/exams/${exam}/register`, { learnerId: asha, subjects: ['Maths', 'Science'], accommodations: 'Extra time' });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.amountMinor, 90000); // 50000 + 2 x 20000
    assert.equal((await mum.post(`/api/v1/guardian/exams/${exam}/register`, { learnerId: asha, subjects: ['Maths'] })).status, 409);
    // The fee is a normal invoice the family sees under Fees.
    const invoice = (await mum.get('/api/v1/guardian/fees')).data.invoices.find((i: any) => i.id === reg.data.invoiceId);
    assert.equal(invoice.status, 'due');
    assert.equal(invoice.outstandingMinor, 90000);
    // No hall ticket and no approval while unpaid.
    const regs = () => registrar.get(`/api/v1/exams/${exam}/registrations`);
    const rid = (await regs()).data.registrations[0].id;
    assert.equal((await regs()).data.registrations[0].status, 'awaiting_payment');
    assert.equal((await registrar.post(`/api/v1/exams/registrations/${rid}/decide`, { decision: 'approved', note: 'Looks fine' })).data.error.code, 'unpaid');
    assert.equal((await mum.get(`/api/v1/guardian/exams/registrations/${rid}/hall-ticket`)).status, 409);
    // Part payment is still not enough.
    await fin.post(`/api/v1/fees/invoices/${reg.data.invoiceId}/payments/manual`, { method: 'cash', amountMinor: 40000, reference: 'Desk 1' });
    assert.equal((await regs()).data.registrations[0].status, 'awaiting_payment');
    await fin.post(`/api/v1/fees/invoices/${reg.data.invoiceId}/payments/manual`, { method: 'upi', amountMinor: 50000, reference: 'UTR 998877665544' });
    assert.equal((await regs()).data.registrations[0].status, 'in_review');
    assert.equal((await mum.get('/api/v1/guardian/exams')).data.items[0].registration.status, 'in_review');
    const ok = await registrar.post(`/api/v1/exams/registrations/${rid}/decide`, { decision: 'approved', note: 'Documents checked' });
    assert.equal(ok.data.hallTicket, 'HT-000001');
    assert.equal((await registrar.post(`/api/v1/exams/registrations/${rid}/decide`, { decision: 'rejected', note: 'oops' })).status, 409);
    const ht = await mum.get(`/api/v1/guardian/exams/registrations/${rid}/hall-ticket`);
    assert.equal(ht.status, 200);
    assert.equal(ht.data.learner, 'Asha Rao');
    assert.deepEqual(ht.data.subjects, ['Maths', 'Science']);
    assert.equal((await other.get(`/api/v1/guardian/exams/registrations/${rid}/hall-ticket`)).status, 404);

    // Ravi is below the attendance rule: the parent is refused with the reason; staff can override with a recorded reason.
    assert.equal((await other.post(`/api/v1/guardian/exams/${exam}/register`, { learnerId: ravi, subjects: ['Maths'] })).data.error.code, 'not_eligible');
    assert.equal((await registrar.post(`/api/v1/exams/${exam}/register`, { learnerId: ravi, subjects: ['Maths'] })).status, 400);
    const ov = await registrar.post(`/api/v1/exams/${exam}/register`, { learnerId: ravi, subjects: ['Maths'], overrideReason: 'Medical leave certificate seen' });
    assert.equal(ov.status, 201);
    assert.equal((await regs()).data.registrations.find((r: any) => r.learner === 'Ravi Nair').overrideReason, 'Medical leave certificate seen');
  });

  it('adds the late fee in the late window and refuses once closed', async () => {
    const owner = client(env.app);
    await owner.post('/api/v1/tenants', { institution: 'Late School', name: 'Olga Owner', email: 'o@late.test', password: PW, timezone: 'Asia/Kolkata' });
    const mum = await mk(owner, 'mum@late.test', ['guardian']);
    const today = todayIn('Asia/Kolkata'), d = (n: number) => shiftDay(today, n);
    const kid = (await owner.post('/api/v1/learners', { name: 'Late Kid' })).data.id;
    await owner.post(`/api/v1/learners/${kid}/guardians`, { email: 'mum@late.test' });
    const mkExam = async (name: string, o: object) => (await owner.post('/api/v1/exams', { name, subjects: ['Maths'], feeBaseMinor: 30000, lateFeeMinor: 5000, opensOn: d(-20), ...o })).data.id;
    const lateExam = await mkExam('Late Exam', { closesOn: d(-1), lateClosesOn: d(3) });
    const closed = await mkExam('Closed Exam', { closesOn: d(-5), lateClosesOn: d(-2) });
    const future = await mkExam('Future Exam', { opensOn: d(4), closesOn: d(9) });
    const r = await mum.post(`/api/v1/guardian/exams/${lateExam}/register`, { learnerId: kid, subjects: ['Maths'] });
    assert.equal(r.status, 201);
    assert.equal(r.data.late, true);
    assert.equal(r.data.amountMinor, 35000);
    assert.equal((await mum.post(`/api/v1/guardian/exams/${closed}/register`, { learnerId: kid, subjects: ['Maths'] })).data.error.code, 'closed');
    assert.equal((await mum.post(`/api/v1/guardian/exams/${future}/register`, { learnerId: kid, subjects: ['Maths'] })).data.error.code, 'not_open');
  });
});
