// Browser check of the fee, payment and receipt flow. Needs the app running with
// PAYMENTS_SANDBOX=1 and PAYMENT_WEBHOOK_SECRET set, plus Chrome. Synthetic data only.
// Run: BASE=http://localhost:8081 node e2e/fees.mjs
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const BASE = process.env.BASE ?? 'http://localhost:3847';
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const PW = 'demo-password-123', run = Date.now().toString(36), email = (n) => `${n}.${run}@demo.example`;

function jar() {
  let cookie = '';
  return async (method, path, body) => {
    const r = await fetch(BASE + '/api/v1' + path, { method, headers: { 'x-requested-with': 'schoolkick', 'x-forwarded-for': `10.7.${Math.random() * 250 | 0}.${Math.random() * 250 | 0}`, ...(cookie && { cookie }), ...(body !== undefined && { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const data = await r.json().catch(() => null);
    assert.ok(r.ok, `${method} ${path} -> ${r.status} ${JSON.stringify(data)}`);
    return data;
  };
}
const owner = jar(), finance = jar();
await owner('POST', '/tenants', { institution: 'Demo School (synthetic data)', name: 'Dana Demo', email: email('owner'), password: PW, timezone: 'Asia/Kolkata', currency: 'INR' });
for (const [n, who, role] of [['fin', 'Farah Finance', 'finance'], ['guardian', 'Gita Guardian', 'guardian']]) await owner('POST', '/users', { email: email(n), name: who, password: PW, roles: [role] });
await finance('POST', '/auth/login', { email: email('fin'), password: PW });
const kid = (await owner('POST', '/learners', { name: 'Asha Demo', externalId: `E-${run}` })).id;
await owner('POST', `/learners/${kid}/guardians`, { email: email('guardian') });
await finance('POST', '/fees/invoices', { learnerId: kid, description: 'Term 1 tuition', kind: 'tuition', amountMinor: 1250000, dueDate: '2026-12-15' });
await finance('POST', '/fees/invoices', { learnerId: kid, description: 'Annual exam fee', kind: 'exam', amountMinor: 85000, dueDate: '2026-10-01' });

await finance('PUT', '/fees/settings', { upiId: 'demoschool@okbank', upiName: 'Demo School' });
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
await owner('POST', '/exams', { name: 'Annual Exam', subjects: ['Maths', 'Science'], feeBaseMinor: 20000, feePerSubjectMinor: 10000, opensOn: d(-2), closesOn: d(20), examDate: d(40) });
await finance('POST', '/fees/invoices', { learnerId: kid, description: 'Bus fee', kind: 'transport', amountMinor: 60000, dueDate: '2026-12-30' });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const problems = [];
async function session(width, height, mail, fn) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
  await page.setViewport({ width, height });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/40[0-9]|status of/.test(m.text()) && problems.push(`console ${m.type()}: ${m.text()}`));
  await page.goto(BASE + '/app', { waitUntil: 'networkidle0' });
  await page.type('input[name=email]', mail); await page.type('input[name=password]', PW); await page.click('form.auth-card button.btn');
  await page.waitForSelector('.shell main h1');
  try { await fn(page); } finally { await ctx.close(); }
}
const text = (p, t) => p.waitForFunction((s) => document.body.innerText.includes(s), { timeout: 8000 }, t);
const shot = (p, n, full = true) => p.screenshot({ path: OUT + n + '.png', fullPage: full });
// Automated accessibility check (axe-core, WCAG 2.2 A/AA tags). Catches contrast, labels, names and roles; it does not replace a manual screen-reader pass.
const axe = async (p, where) => {
  await p.evaluate(AXE);
  const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }));
  for (const v of r.violations) problems.push(`axe ${v.impact} on ${where}: ${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ')}`);
};
const noScroll = async (p, where) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal page scroll: ${where}`);
const click = (p, sel, t) => p.evaluate((sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(t)).click(), sel, t);

// Parent on a phone: sees fees, pays through the sandbox, only sees "Paid" after the verified message.
await session(375, 812, email('guardian'), async (p) => {
  await click(p, 'nav a', 'Fees'); await text(p, 'Term 1 tuition');
  await noScroll(p, 'parent fees 375'); await shot(p, 'fees-parent-mobile');
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pay ₹12,500.00 online').click()); await text(p, 'Test provider');
  assert.ok(!(await p.evaluate(() => document.body.innerText)).includes('Paid\n'), 'checkout page must not claim Paid');
  await click(p, 'button', 'Report “still processing”'); await text(p, 'Do not pay again yet');
  await noScroll(p, 'processing 375'); await shot(p, 'fees-processing-mobile');
  await click(p, 'button', 'Report success'); await text(p, 'View receipt RCT-');
  await shot(p, 'fees-paid-mobile');
  await click(p, 'a', 'View receipt'); await text(p, 'Payment receipt');
  assert.ok((await p.evaluate(() => document.body.innerText)).includes('Asha Demo'));
  await noScroll(p, 'receipt 375'); await shot(p, 'receipt-mobile');
});
// Parent: UPI QR, claim with the UTR (not paid until the office confirms), then exam registration.
await session(375, 812, email('guardian'), async (p) => {
  await click(p, 'nav a', 'Fees'); await text(p, 'Bus fee');
  await axe(p, 'parent fees');
  await p.evaluate(() => [...document.querySelectorAll('li.card')].find((c) => c.innerText.includes('Bus fee')).querySelector('button.btn').click());
  await text(p, 'Scan with any UPI app'); await p.waitForSelector('img.qr');
  assert.ok(await p.$eval('img.qr', (i) => i.naturalWidth > 100), 'QR image rendered');
  await axe(p, 'upi checkout'); await noScroll(p, 'upi 375'); await shot(p, 'upi-checkout-mobile');
  await p.type('input[name=utr]', '412345678901'); await click(p, 'button', 'I have paid'); await text(p, 'Do not pay again yet');
  await click(p, 'nav a', 'Exams'); await text(p, 'Annual Exam'); await axe(p, 'parent exams');
  await p.click('.subjects input[type=checkbox]'); await click(p, 'button.btn', 'Register and create the fee'); await text(p, 'Go to Fees to pay');
  await noScroll(p, 'exams 375'); await shot(p, 'exams-parent-mobile');
});
// Finance on desktop, then tablet.
await session(1440, 900, email('fin'), async (p) => {
  await text(p, 'INV-000001'); await shot(p, 'fees-staff-desktop');
  await click(p, 'button', 'Record payment'); await p.type('input[name=ref]', 'Counter 2, slip 41'); await p.click('table form.grid-form button.btn'); await text(p, 'Receipt RCT-');
  await axe(p, 'finance fees');
  await click(p, 'nav a', 'Reconcile'); await text(p, '412345678901'); await axe(p, 'reconcile'); await shot(p, 'reconcile-desktop');
  await p.evaluate(() => [...document.querySelectorAll('summary')].find((e) => e.textContent.includes('Confirm money')).click());
  await p.type('input[name=evidence]', 'UTR 412345678901 on statement'); const notes = await p.$$('input[name=note]'); await notes[notes.length - 2].type('Matched amount and UTR');
  await click(p, 'button', 'Mark paid and issue receipt'); await text(p, 'Nothing to reconcile');
});
await session(768, 1024, email('fin'), async (p) => { await text(p, 'INV-000001'); await noScroll(p, 'finance 768'); await shot(p, 'fees-staff-tablet'); });
await session(375, 812, email('fin'), async (p) => { await text(p, 'INV-000001'); await noScroll(p, 'finance 375'); await shot(p, 'fees-staff-mobile'); });
await browser.close();
assert.deepEqual(problems, [], 'browser problems:\n' + problems.join('\n'));
console.log('fees e2e ok');
