import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { enterTenant } from '../src/db.ts';
import { client, freshApp } from './helpers.ts';

const PW = 'correct horse battery';
let env: Awaited<ReturnType<typeof freshApp>>;
before(async () => { env = await freshApp(); });
after(async () => { await env.close(); });

async function signup(inst: string, mail: string) {
  const c = client(env.app);
  const r = await c.post('/api/v1/tenants', { institution: inst, name: 'Owner One', email: mail, password: PW, timezone: 'Asia/Kolkata' });
  assert.equal(r.status, 201);
  return c;
}
async function addUser(owner: ReturnType<typeof client>, mail: string, roles: string[]) {
  const r = await owner.post('/api/v1/users', { email: mail, name: 'Person ' + mail.split('@')[0], password: PW, roles });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const c = client(env.app);
  assert.equal((await c.post('/api/v1/auth/login', { email: mail, password: PW })).status, 200);
  return c;
}

describe('school day flow', () => {
  let owner: ReturnType<typeof client>, teacher: ReturnType<typeof client>, other: ReturnType<typeof client>, guardian: ReturnType<typeof client>;
  let classId: string, learnerId: string, otherClass: string;

  before(async () => {
    owner = await signup('Alpha School', 'owner@alpha.test');
    teacher = await addUser(owner, 'teacher@alpha.test', ['teacher']);
    other = await addUser(owner, 'other@alpha.test', ['teacher']);
    guardian = await addUser(owner, 'parent@alpha.test', ['guardian']);
    classId = (await owner.post('/api/v1/classes', { name: '5A' })).data.id;
    otherClass = (await owner.post('/api/v1/classes', { name: '5B' })).data.id;
    learnerId = (await owner.post('/api/v1/learners', { name: 'Asha Rao', externalId: 'A-1' })).data.id;
    const users = (await owner.get('/api/v1/users')).data.users as { id: string; email: string }[];
    const tId = users.find((u) => u.email === 'teacher@alpha.test')!.id;
    assert.equal((await owner.post(`/api/v1/classes/${classId}/teachers`, { userId: tId })).status, 201);
    assert.equal((await owner.post(`/api/v1/classes/${classId}/enrollments`, { learnerId })).status, 201);
    assert.equal((await owner.post(`/api/v1/learners/${learnerId}/guardians`, { email: 'parent@alpha.test' })).status, 201);
  });

  it('blocks state-changing requests without the CSRF header or from another origin', async () => {
    const c = client(env.app);
    const r = await c.raw('POST', '/api/v1/auth/login', { email: 'a@b.co', password: 'x' }, { 'x-requested-with': '' });
    assert.equal(r.status, 403);
    const r2 = await c.raw('POST', '/api/v1/auth/login', { email: 'a@b.co', password: 'x' }, { origin: 'https://evil.example' });
    assert.equal(r2.status, 403);
  });

  it('requires a session and enforces roles', async () => {
    assert.equal((await client(env.app).get('/api/v1/classes')).status, 401);
    assert.equal((await teacher.post('/api/v1/classes', { name: 'X' })).status, 403);
    assert.equal((await guardian.get('/api/v1/classes')).status, 403);
    assert.equal((await teacher.get('/api/v1/audit')).status, 403);
  });

  it('teachers only reach their assigned classes', async () => {
    assert.equal((await teacher.get(`/api/v1/classes/${classId}/attendance`)).status, 200);
    assert.equal((await other.get(`/api/v1/classes/${classId}/attendance`)).status, 403);
    assert.equal((await teacher.get(`/api/v1/classes/${otherClass}/attendance`)).status, 403);
    assert.deepEqual(((await teacher.get('/api/v1/classes')).data.classes as { name: string }[]).map((c) => c.name), ['5A']);
  });

  it('records attendance once, requires a reason to correct, and keeps the history', async () => {
    const mark = (status: string, reason?: string) => teacher.put(`/api/v1/classes/${classId}/attendance`, { marks: [{ learnerId, status, reason }] });
    let r = await mark('present');
    assert.deepEqual(r.data, { created: 1, corrected: 0, unchanged: 0 });
    assert.deepEqual((await mark('present')).data, { created: 0, corrected: 0, unchanged: 1 });
    assert.equal((await mark('absent')).status, 400); // correction without reason
    r = await mark('absent', 'Marked wrong learner');
    assert.deepEqual(r.data, { created: 0, corrected: 1, unchanged: 0 });
    const roster = (await teacher.get(`/api/v1/classes/${classId}/attendance`)).data.roster[0];
    assert.equal(roster.status, 'absent');
    assert.equal(roster.corrected, true);
    const hist = (await teacher.get(`/api/v1/classes/${classId}/attendance/history`)).data.events;
    assert.deepEqual(hist.map((e: any) => e.status), ['absent', 'present']);
    assert.equal(hist[0].reason, 'Marked wrong learner');
    const audit = (await owner.get('/api/v1/audit')).data.events.map((e: any) => e.action);
    assert.ok(audit.includes('attendance.correct'));
  });

  it('rejects future days, bad statuses and unenrolled learners', async () => {
    const put = (body: object) => teacher.put(`/api/v1/classes/${classId}/attendance`, body);
    assert.equal((await put({ day: '2999-01-01', marks: [{ learnerId, status: 'present' }] })).status, 400);
    assert.equal((await put({ marks: [{ learnerId, status: 'sleeping' }] })).status, 400);
    const stranger = (await owner.post('/api/v1/learners', { name: 'Not Enrolled' })).data.id;
    assert.equal((await put({ marks: [{ learnerId: stranger, status: 'present' }] })).status, 400);
  });

  it('attendance rows cannot be updated or deleted, even with SQL', async () => {
    await assert.rejects(env.db.query('update attendance_events set status = $1', ['present']), /append-only/);
    await assert.rejects(env.db.query('delete from audit_events'), /append-only/);
  });

  it('guardians see only linked learners, with correction visible', async () => {
    const mine = (await guardian.get('/api/v1/guardian/learners')).data.learners;
    assert.equal(mine.length, 1);
    assert.deepEqual(mine[0].today, [{ class: '5A', status: 'absent', corrected: true }]);
    const unlinked = await addUser(owner, 'parent2@alpha.test', ['guardian']);
    assert.equal((await unlinked.get('/api/v1/guardian/learners')).data.learners.length, 0);
  });

  it('imports learners from CSV with a dry run that explains every issue', async () => {
    const csv = (s: string) => owner.raw('POST', '/api/v1/learners/import?dryRun=1', s, { 'content-type': 'text/csv' });
    let r = await csv('name,external_id,guardian_email\nBen Roy,B-1,parent@alpha.test\nC,A-1,nobody@x.test\nDee Das,B-1,\n');
    assert.equal(r.data.imported, 0);
    assert.deepEqual(r.data.issues.map((i: any) => `${i.row}:${i.field}`).sort(), ['3:external_id', '3:guardian_email', '3:name', '4:external_id']);
    const bad = await owner.raw('POST', '/api/v1/learners/import?dryRun=0', 'name,external_id\nOk Name,Z-1\nX,Z-2\n', { 'content-type': 'text/csv' });
    assert.equal(bad.data.imported, 0); // all-or-nothing
    const good = await owner.raw('POST', '/api/v1/learners/import?dryRun=0', 'name,external_id,guardian_email\n"Roy, Ben",B-1,parent@alpha.test\nDee Das,B-2,\n', { 'content-type': 'text/csv' });
    assert.equal(good.data.imported, 2);
    const names = (await guardian.get('/api/v1/guardian/learners')).data.learners.map((l: any) => l.name);
    assert.ok(names.includes('Roy, Ben'));
  });
});

describe('tenant isolation', () => {
  it('never leaks another institution’s data', async () => {
    const a = await signup('Isolated A', 'a@iso.test'), b = await signup('Isolated B', 'b@iso.test');
    const cls = (await a.post('/api/v1/classes', { name: 'Secret' })).data.id;
    const lr = (await a.post('/api/v1/learners', { name: 'Private Learner', externalId: 'S-1' })).data.id;
    assert.equal((await b.get(`/api/v1/classes/${cls}/attendance`)).status, 404);
    assert.equal((await b.post(`/api/v1/classes/${cls}/enrollments`, { learnerId: lr })).status, 404);
    assert.equal((await b.get('/api/v1/learners')).data.learners.length, 0);
    assert.equal((await b.post('/api/v1/learners', { name: 'Twin', externalId: 'S-1' })).status, 201); // same external id is fine across tenants
  });
});

describe('sessions and login', () => {
  it('rejects bad credentials, logs out, and throttles guessing', async () => {
    const c = await signup('Auth School', 'auth@auth.test');
    assert.notEqual((await c.get('/api/v1/session')).data.me, null);
    await c.post('/api/v1/auth/logout');
    assert.equal((await c.get('/api/v1/session')).data.me, null);
    const g = client(env.app);
    assert.equal((await g.post('/api/v1/auth/login', { email: 'auth@auth.test', password: 'wrong-password' })).status, 401);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await g.post('/api/v1/auth/login', { email: 'auth@auth.test', password: 'wrong-password' })).status;
    assert.equal(last, 429);
  });
  it('validates sign-up input', async () => {
    const c = client(env.app);
    assert.equal((await c.post('/api/v1/tenants', { institution: 'X Y', name: 'Zed', email: 'bad', password: PW })).status, 400);
    assert.equal((await c.post('/api/v1/tenants', { institution: 'X Y', name: 'Zed', email: 'z@z.test', password: 'short' })).status, 400);
  });
  it('reports health', async () => {
    const r = await client(env.app).get('/readyz');
    assert.equal(r.status, 200);
  });
});

describe('architecture guarantees', () => {
  it('denies every non-public route to anonymous callers (default deny)', async () => {
    const c = client(env.app);
    const guarded = env.app.registry.filter((r) => r.access !== 'public');
    assert.ok(guarded.length >= 15);
    for (const r of guarded) {
      const path = '/api/v1' + r.path.replace(/:\w+/g, '00000000-0000-0000-0000-000000000000');
      const res = await c.raw(r.method.toUpperCase(), path, r.method === 'get' ? undefined : {});
      assert.equal(res.status, 401, `${r.method} ${r.path} must require sign-in`);
    }
  });

  it('describes the API in OpenAPI, marking roles and public routes', async () => {
    const doc = (await client(env.app).get('/api/v1/openapi.json')).data;
    assert.equal(doc.openapi, '3.1.0');
    assert.deepEqual(doc.paths['/api/v1/insights/overview'].get['x-roles'], ['owner', 'registrar']);
    assert.equal(doc.paths['/api/v1/auth/login'].post['x-roles'], 'public');
  });

  it('Postgres row-level security isolates tenants even if a query forgets its WHERE clause', async () => {
    const a = await signup('RLS A', 'a@rls.test'), b = await signup('RLS B', 'b@rls.test');
    await a.post('/api/v1/learners', { name: 'RLS Learner A' });
    await b.post('/api/v1/learners', { name: 'RLS Learner B' });
    const tenants = (await env.db.query('select id from tenants where name in ($1,$2) order by name', ['RLS A', 'RLS B'])).rows;
    const c = await env.db.connect();
    try {
      await c.query('begin');
      await enterTenant(c, tenants[0].id);
      const rows = (await c.query('select name from learners')).rows.map((r) => r.name); // no WHERE on purpose
      assert.deepEqual(rows, ['RLS Learner A']);
      await assert.rejects(c.query(`insert into learners (tenant_id, name) values ('${tenants[1].id}', 'smuggled')`), /row-level security/);
      await c.query('rollback');
      await c.query('begin');
      await c.query('set local role campusos_app'); // no tenant pinned: sees nothing
      assert.equal((await c.query('select count(*)::int as n from learners')).rows[0].n, 0);
      await assert.rejects(c.query('update attendance_events set status = $1', ['absent']), /permission denied/);
      await c.query('rollback');
    } finally { c.release(); }
  });

  it('reports request ids and noindex headers', async () => {
    const r = await client(env.app).get('/api/v1/session');
    assert.ok(r.headers.get('x-request-id'));
    assert.match(r.headers.get('x-robots-tag') ?? '', /noindex/);
  });
});

describe('dashboard data', () => {
  it('summarises today, the trend, the class register and exceptions', async () => {
    const o = await signup('Insight School', 'o@insight.test');
    const t = await addUser(o, 't@insight.test', ['teacher']);
    const cls = (await o.post('/api/v1/classes', { name: '7A' })).data.id;
    await o.post('/api/v1/classes', { name: '7B' });
    const ls: string[] = [];
    for (const n of ['Una Test', 'Vik Test', 'Wes Test', 'Xia Test']) {
      const id = (await o.post('/api/v1/learners', { name: n })).data.id;
      await o.post(`/api/v1/classes/${cls}/enrollments`, { learnerId: id });
      ls.push(id);
    }
    const tid = ((await o.get('/api/v1/users')).data.users as any[]).find((u) => u.email === 't@insight.test').id;
    await o.post(`/api/v1/classes/${cls}/teachers`, { userId: tid });
    let ov = (await o.get('/api/v1/insights/overview')).data;
    assert.equal(ov.today.expected, 4);
    assert.equal(ov.today.unmarked, 4);
    assert.equal(ov.attention.learnersWithoutGuardian, 4);
    assert.equal(ov.attention.unmarkedClasses.length, 1); // 7B is empty, so it is not nagged about
    await t.put(`/api/v1/classes/${cls}/attendance`, { marks: [{ learnerId: ls[0], status: 'present' }, { learnerId: ls[1], status: 'absent' }, { learnerId: ls[2], status: 'late' }] });
    await t.put(`/api/v1/classes/${cls}/attendance`, { marks: [{ learnerId: ls[1], status: 'excused', reason: 'Doctor note received' }] });
    ov = (await o.get('/api/v1/insights/overview?days=7')).data;
    assert.deepEqual({ ...ov.today }, { expected: 4, present: 1, absent: 0, late: 1, excused: 1, unmarked: 1 });
    const last = ov.series.at(-1);
    assert.deepEqual({ marked: last.marked, attended: last.attended }, { marked: 3, attended: 2 });
    assert.deepEqual(ov.register.rows.find((r: any) => r.name === '7A').cells.at(-1), { marked: 3, attended: 2 });
    assert.equal(ov.attention.corrections.length, 1);
    assert.equal(ov.attention.corrections[0].learner, 'Vik Test');
    assert.equal(ov.attention.corrections[0].to, 'excused');
    assert.equal((await t.get('/api/v1/insights/overview')).status, 403);
    const cl = (await t.get('/api/v1/classes')).data.classes[0];
    assert.equal(cl.markedToday, 3);
  });

  it('gives guardians a two-week strip with the worst status per day', async () => {
    const o = await signup('Strip School', 'o@strip.test');
    const g = await addUser(o, 'g@strip.test', ['guardian']);
    const l = (await o.post('/api/v1/learners', { name: 'Yan Test' })).data.id;
    await o.post(`/api/v1/learners/${l}/guardians`, { email: 'g@strip.test' });
    const [c1, c2] = [(await o.post('/api/v1/classes', { name: 'Maths' })).data.id, (await o.post('/api/v1/classes', { name: 'Art' })).data.id];
    for (const c of [c1, c2]) await o.post(`/api/v1/classes/${c}/enrollments`, { learnerId: l });
    await o.put(`/api/v1/classes/${c1}/attendance`, { marks: [{ learnerId: l, status: 'present' }] });
    await o.put(`/api/v1/classes/${c2}/attendance`, { marks: [{ learnerId: l, status: 'absent' }] });
    const child = (await g.get('/api/v1/guardian/learners')).data.learners[0];
    assert.deepEqual(child.recent.map((r: any) => r.status), ['absent']);
    assert.equal(child.today.length, 2);
  });
});
