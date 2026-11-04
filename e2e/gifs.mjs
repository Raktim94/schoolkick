// Records frames of five real SchoolKick workflows against a running app, with synthetic demo data.
// Needs the app running with PAYMENTS_SANDBOX=1 PAYMENT_WEBHOOK_SECRET=x, and Chrome.
// Then assemble: python3 e2e/gifs.py  (needs Pillow). Output: docs/gifs/*.gif
// Run: FRAMES=/tmp/sk-frames node e2e/gifs.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3847';
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';
const FRAMES = process.env.FRAMES ?? '/tmp/sk-frames';
const PW = 'demo-password-123', run = Date.now().toString(36), email = (n) => `${n}.${run}@demo.example`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jar() {
  let cookie = '';
  return async (method, path, body, ct = 'application/json') => {
    const r = await fetch(BASE + '/api/v1' + path, { method, headers: { 'x-requested-with': 'schoolkick', 'x-forwarded-for': `10.8.${Math.random() * 250 | 0}.${Math.random() * 250 | 0}`, ...(cookie && { cookie }), ...(body !== undefined && { 'content-type': ct }) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data)}`);
    return data;
  };
}

// ---- synthetic school ----
const owner = jar(), finance = jar();
await owner('POST', '/tenants', { institution: 'Demo Primary School', name: 'Dana Demo', email: email('owner'), password: PW, timezone: 'Asia/Kolkata', currency: 'INR' });
for (const [n, who, role] of [['teacher', 'Tara Teacher', 'teacher'], ['guardian', 'Gita Guardian', 'guardian'], ['fin', 'Farah Finance', 'finance']]) await owner('POST', '/users', { email: email(n), name: who, password: PW, roles: [role] });
const users = (await owner('GET', '/users')).users;
const classId = (await owner('POST', '/classes', { name: 'Class 5A' })).id;
const classB = (await owner('POST', '/classes', { name: 'Class 5B' })).id;
await owner('POST', `/classes/${classId}/teachers`, { userId: users.find((u) => u.email === email('teacher')).id });
const ids = [];
for (const [i, n] of ['Asha Demo', 'Ben Demo', 'Chitra Demo', 'Dev Demo', 'Esha Demo'].entries()) {
  const { id } = await owner('POST', '/learners', { name: n, externalId: `G-${run}-${i}` });
  await owner('POST', `/classes/${classId}/enrollments`, { learnerId: id }); ids.push(id);
}
for (const [i, n] of ['Farid Demo', 'Gauri Demo', 'Hari Demo', 'Isha Demo'].entries()) {
  const { id } = await owner('POST', '/learners', { name: n, externalId: `G-${run}-b${i}` });
  await owner('POST', `/classes/${classB}/enrollments`, { learnerId: id });
}
await owner('POST', `/learners/${ids[0]}/guardians`, { email: email('guardian') });
const dayStr = (back) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
const pick = (seed) => { const v = (seed * 7919) % 100; return v < 80 ? 'present' : v < 88 ? 'late' : v < 96 ? 'absent' : 'excused'; };
let seed = 1;
for (let back = 20; back >= 1; back--) {
  const d = dayStr(back); const dow = new Date(d + 'T00:00:00Z').getUTCDay(); if (dow === 0 || dow === 6) continue;
  for (const cid of [classId, classB]) {
    const roster = (await owner('GET', `/classes/${cid}/attendance?day=${d}`)).roster;
    await owner('PUT', `/classes/${cid}/attendance`, { day: d, marks: roster.map((r) => ({ learnerId: r.learnerId, status: pick(seed++) })) });
  }
}
await finance('POST', '/auth/login', { email: email('fin'), password: PW });
await finance('PUT', '/fees/settings', { upiId: 'demoschool@okbank', upiName: 'Demo School' });
await finance('POST', '/fees/invoices', { learnerId: ids[0], description: 'Term 1 tuition', kind: 'tuition', amountMinor: 1250000, dueDate: '2026-12-15' });
await finance('POST', '/fees/invoices', { learnerId: ids[0], description: 'Bus fee', kind: 'transport', amountMinor: 60000, dueDate: '2026-12-30' });
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
await owner('POST', '/exams', { name: 'Annual Exam', subjects: ['Maths', 'Science'], feeBaseMinor: 20000, feePerSubjectMinor: 10000, opensOn: d(-2), closesOn: d(20), examDate: d(40) });

// ---- recorder ----
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const text = async (p, t) => { try { await p.waitForFunction((s) => document.body.innerText.includes(s), { timeout: 10000 }, t); } catch (e) { console.error('Never saw:', JSON.stringify(t), '\nPage text:', (await p.evaluate(() => document.body.innerText)).slice(0, 2500)); throw e; } };
const click = (p, sel, t) => p.evaluate((sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(t)).click(), sel, t);
const clickLabel = (p, scope, label) => p.evaluate((scope, label) => [...document.querySelectorAll(scope + ' label')].find((l) => l.textContent.trim() === label).click(), scope, label);

function recorder(name) {
  const dir = `${FRAMES}/${name}`; mkdirSync(dir, { recursive: true }); let n = 0;
  return async (p, ms = 900) => { await sleep(250); await p.screenshot({ path: `${dir}/${String(n++).padStart(3, '0')}-${ms}.png` }); };
}
async function session(w, h, mail, fn, { shotsOn = null } = {}) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.goto(BASE + '/app/', { waitUntil: 'networkidle0' });
  try { await fn(p, mail); } finally { await ctx.close(); }
}
const login = async (p, mail, snap) => {
  await p.type('input[name=email]', mail, { delay: 25 }); await p.type('input[name=password]', PW, { delay: 15 });
  if (snap) await snap(p, 1100);
  await p.click('form.auth-card button.btn'); await p.waitForSelector('.shell main h1');
};
const M = [390, 780], D = [1100, 640];

// 1. Attendance with a kept correction (teacher, phone)
{ const snap = recorder('attendance');
  await session(...M, null, async (p) => {
    await login(p, email('teacher'), snap);
    await text(p, 'Today’s classes'); await snap(p, 1100);
    await p.click('.class-rows a.btn'); await text(p, 'Asha Demo'); await snap(p, 900);
    await p.click('.toolbar .btn'); await snap(p, 900);
    await clickLabel(p, '.roster li:nth-child(2)', 'Late'); await clickLabel(p, '.roster li:nth-child(3)', 'Absent'); await snap(p, 1300);
    await p.click('.sticky-bar .btn'); await text(p, 'Attendance saved for 5 learners'); await snap(p, 1500);
    await clickLabel(p, '.roster li:nth-child(3)', 'Present'); await p.type('label.reason input', 'Marked the wrong learner', { delay: 40 }); await snap(p, 1300);
    await p.click('.sticky-bar .btn'); await text(p, '1 correction recorded'); await snap(p, 1500);
    await p.click('button.link[aria-expanded]'); await text(p, 'Marked the wrong learner');
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await snap(p, 2200);
  }); }

// 2. Family view (guardian, phone): today, kept correction, fees, exams
{ const snap = recorder('family');
  await session(...M, null, async (p) => {
    await login(p, email('guardian'), snap);
    await text(p, 'Asha Demo'); await snap(p, 1800);
    await p.evaluate(() => window.scrollTo(0, 260)); await snap(p, 1500);
    await click(p, 'nav a', 'Fees'); await text(p, 'Term 1 tuition'); await snap(p, 1800);
    await click(p, 'nav a', 'Exams'); await text(p, 'Annual Exam'); await snap(p, 1800);
  }); }

// 3. UPI payment, confirmed by the office (guardian then finance, desktop)
{ const snap = recorder('upi-payment');
  await session(...D, null, async (p) => {
    await login(p, email('guardian'), snap);
    await click(p, 'nav a', 'Fees'); await text(p, 'Bus fee'); await snap(p, 1300);
    await p.evaluate(() => [...document.querySelectorAll('li.card')].find((c) => c.innerText.includes('Bus fee')).querySelector('button.btn').click());
    await text(p, 'Scan with any UPI app'); await p.waitForSelector('img.qr'); await snap(p, 1800);
    await p.type('input[name=utr]', '412345678901', { delay: 60 }); await snap(p, 1100);
    await click(p, 'button', 'I have paid'); await text(p, 'Do not pay again yet'); await snap(p, 2000);
  });
  await session(...D, null, async (p) => {
    await login(p, email('fin'), null);
    await click(p, 'nav a', 'Reconcile'); await text(p, '412345678901'); await snap(p, 1800);
    await p.evaluate(() => [...document.querySelectorAll('summary')].find((e) => e.textContent.includes('Confirm money')).click());
    await p.type('input[name=evidence]', 'UTR 412345678901 on bank statement', { delay: 25 });
    const notes = await p.$$('input[name=note]'); await notes[notes.length - 2].type('Matched amount and UTR', { delay: 25 }); await snap(p, 1500);
    await click(p, 'button', 'Mark paid and issue receipt'); await text(p, 'Nothing to reconcile'); await snap(p, 2200);
  }); }

// 4. CSV import with a preview (owner, desktop)
{ const snap = recorder('csv-import');
  await session(...D, null, async (p) => {
    await login(p, email('owner'), null);
    await p.click('.nav-link[href="/app/learners"]'); await text(p, 'Add learners'); await snap(p, 900);
    await p.click('details.import summary'); await snap(p, 700);
    const bad = `name,external_id,guardian_email\nNew Child,G-${run}-n1,${email("guardian")}\nX,N-1,\n`;
    await p.type('details.import textarea', bad, { delay: 12 }); await snap(p, 1300);
    await click(p, 'details.import .btn', 'Check file'); await text(p, 'to fix before importing'); await snap(p, 2200);
    await p.focus('details.import textarea'); await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control');
    await p.type('details.import textarea', `name,external_id,guardian_email\nNew Child,G-${run}-n1,${email("guardian")}\nSecond Child,G-${run}-n2,\n`, { delay: 8 }); await snap(p, 1100);
    await click(p, 'details.import .btn', 'Check file'); await text(p, 'No problems found'); await snap(p, 1600);
    await p.evaluate(() => [...document.querySelectorAll('details.import .btn')].find((b) => !b.disabled && !b.classList.contains('secondary')).click());
    await text(p, 'Imported 2 learners'); await snap(p, 2200);
  }); }

// 5. Overview, command palette, dark theme (owner, desktop)
{ const snap = recorder('overview-palette');
  await session(...D, null, async (p) => {
    await login(p, email('owner'), null);
    await text(p, 'Needs attention'); await sleep(350); await snap(p, 500); await sleep(900); await snap(p, 1500);
    await p.hover('.reg .cell.s4, .reg .cell.s3').catch(() => {}); await snap(p, 1400);
    await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await sleep(350); await snap(p, 1100);
    await p.keyboard.type('fees', { delay: 90 }); await snap(p, 1300);
    await p.keyboard.press('Enter'); await text(p, 'Invoices, payments and receipts'); await snap(p, 1500);
    await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await sleep(300);
    await p.keyboard.type('dark', { delay: 90 }); await snap(p, 1000);
    await p.keyboard.press('Enter'); await sleep(500); await snap(p, 2200);
  }); }

await browser.close();
writeFileSync(`${FRAMES}/DONE`, 'ok');
console.log('frames written to', FRAMES);
