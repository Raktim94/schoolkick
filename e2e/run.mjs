// Browser end-to-end check + screenshots. Needs the app running (BASE) and Chrome (CHROME).
// Uses clearly synthetic demo data. Run: npm run e2e
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

const BASE = process.env.BASE ?? 'http://localhost:3847';
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const PW = 'demo-password-123';
const run = Date.now().toString(36);
const email = (n) => `${n}.${run}@demo.example`;

// ---- seed through the public API (also exercises it) ----
function jar() {
  let cookie = '';
  return async (method, path, body, ct = 'application/json') => {
    const r = await fetch(BASE + '/api/v1' + path, { method, headers: { 'x-requested-with': 'schoolkick', 'x-forwarded-for': `10.9.${Math.random() * 250 | 0}.${Math.random() * 250 | 0}`, ...(cookie && { cookie }), ...(body !== undefined && { 'content-type': ct }) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const data = await r.json().catch(() => null);
    assert.ok(r.ok, `${method} ${path} -> ${r.status} ${JSON.stringify(data)}`);
    return data;
  };
}
const owner = jar();
await owner('POST', '/tenants', { institution: 'Demo Primary School (synthetic data)', name: 'Dana Demo', email: email('owner'), password: PW, timezone: 'Asia/Kolkata' });
for (const [n, role] of [['teacher', 'teacher'], ['guardian', 'guardian']]) await owner('POST', '/users', { email: email(n), name: n === 'teacher' ? 'Tara Teacher' : 'Gita Guardian', password: PW, roles: [role] });
const users = (await owner('GET', '/users')).users;
const { id: classId } = await owner('POST', '/classes', { name: 'Class 5A' });
await owner('POST', '/classes', { name: 'Class 5B' });
await owner('POST', `/classes/${classId}/teachers`, { userId: users.find((u) => u.email === email('teacher')).id });
const names = ['Asha Demo', 'Ben Demo', 'Chitra Demo', 'Dev Demo', 'Esha Demo'];
const ids = [];
for (const [i, n] of names.entries()) {
  const { id } = await owner('POST', '/learners', { name: n, externalId: `D-${run}-${i}` });
  await owner('POST', `/classes/${classId}/enrollments`, { learnerId: id });
  ids.push(id);
}
await owner('POST', `/learners/${ids[0]}/guardians`, { email: email('guardian') });
const classB = (await owner('GET', '/classes')).classes.find((c) => c.name === 'Class 5B').id;
for (const [i, n] of ['Farid Demo', 'Gauri Demo', 'Hari Demo', 'Isha Demo'].entries()) {
  const { id } = await owner('POST', '/learners', { name: n, externalId: `D-${run}-b${i}` });
  await owner('POST', `/classes/${classB}/enrollments`, { learnerId: id });
}
// Synthetic history for the previous 20 days (weekdays only) with deterministic variety.
const dayStr = (back) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
const pick = (seed) => { const v = (seed * 7919) % 100; return v < 80 ? 'present' : v < 88 ? 'late' : v < 96 ? 'absent' : 'excused'; };
let seed = 1;
for (let back = 20; back >= 1; back--) {
  const d = dayStr(back); const dow = new Date(d + 'T00:00:00Z').getUTCDay(); if (dow === 0 || dow === 6) continue;
  for (const [cid, pool] of [[classId, ids], [classB, null]]) {
    const roster = (await owner('GET', `/classes/${cid}/attendance?day=${d}`)).roster;
    await owner('PUT', `/classes/${cid}/attendance`, { day: d, marks: roster.map((r) => ({ learnerId: r.learnerId, status: pick(seed++) })) });
  }
}

// ---- browser ----
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const problems = [];
async function session(width, height, path, fn, { dark = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, ...(dark ? [{ name: 'prefers-color-scheme', value: 'dark' }] : [])]);
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`console ${m.type()}: ${m.text()}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 500 && problems.push(`5xx: ${r.url()}`));
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  try { await fn(page); } finally { await ctx.close(); }
}
const text = (page, t) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout: 8000 }, t);
const shot = (page, name, full = false) => page.screenshot({ path: OUT + name + '.png', fullPage: full });
const login = async (page, mail) => { await page.type('input[name=email]', mail); await page.type('input[name=password]', PW); await page.click('form.auth-card button.btn'); };
const clickLabel = (page, scope, label) => page.evaluate((scope, label) => [...document.querySelectorAll(scope + ' label')].find((l) => l.textContent.trim() === label).click(), scope, label);
const clickText = (page, sel, t) => page.evaluate((sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === t).click(), sel, t);

// public site: SEO basics per page
const SITE = [['/', 'home'], ['/features', 'features'], ['/get-started', 'get-started'], ['/screenshots', 'screenshots'], ['/self-hosting', 'selfhosting'], ['/security', 'security'], ['/faq', 'faq'], ['/roadmap', 'roadmap'], ['/contribute', 'contribute'], ['/contributors', 'contributors']];
for (const [path, name] of SITE) {
  await session(1440, 900, path, async (p) => {
    assert.ok((await p.title()).length > 10, `title on ${path}`);
    assert.equal(await p.$$eval('h1', (h) => h.length), 1, `one h1 on ${path}`);
    assert.ok(await p.$eval('link[rel=canonical]', (l) => l.href), `canonical on ${path}`);
    assert.ok(await p.$eval('meta[name=description]', (m) => m.content.length > 50), `description on ${path}`);
    assert.equal(await p.$$eval('img', (i) => i.filter((x) => !x.alt && x.getAttribute('alt') === null).length), 0, `img alt on ${path}`);
    await shot(p, 'site-' + name + '-desktop', path === '/' || path === '/get-started');
  });
}
// phone widths: no sideways scroll, menu opens, lazy images decode
for (const [path, name] of SITE) {
  await session(375, 812, path, async (p) => {
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal scroll on ${path} at 375px`);
    if (path === '/') { await p.click('details.mob summary'); assert.ok(await p.$eval('details.mob', (d) => d.open)); await shot(p, 'site-menu-mobile'); await p.click('details.mob summary'); }
    if (['/', '/get-started', '/screenshots', '/faq'].includes(path)) await shot(p, 'site-' + name + '-mobile', path !== '/');
  });
}
await session(1440, 900, '/screenshots', async (p) => {
  await p.evaluate(async () => { for (const i of document.images) { i.loading = 'eager'; await i.decode().catch(() => {}); } });
  assert.equal(await p.$$eval('img', (i) => i.filter((x) => !x.naturalWidth).length), 0, 'every screenshot loads');
});

await session(375, 812, '/app/', async (p) => {
  await shot(p, 'sign-in-mobile');
  await login(p, email('teacher'));
  await text(p, 'Today’s classes'); await shot(p, 'teacher-classes-mobile');
  await p.click('.class-rows a.btn'); await text(p, 'Asha Demo');
  await p.click('.toolbar .btn');
  await clickLabel(p, '.roster li:nth-child(2)', 'Late');
  await shot(p, 'teacher-roster-mobile', true);
  await p.click('.sticky-bar .btn'); await text(p, 'Attendance saved for 5 learners');
  await clickLabel(p, '.roster li:nth-child(1)', 'Absent');
  assert.equal(await p.$eval('.sticky-bar .btn', (b) => b.disabled), true, 'save must wait for a reason');
  await p.type('label.reason input', 'Marked the wrong learner');
  await shot(p, 'teacher-correction-mobile', true);
  await p.click('.sticky-bar .btn'); await text(p, '1 correction recorded');
  await p.click('button.link[aria-expanded]'); await text(p, 'Marked the wrong learner');
  await shot(p, 'teacher-history-mobile', true);
});

await session(375, 812, '/app/', async (p) => {
  await login(p, email('teacher'));
  await text(p, 'Today’s classes'); await p.click('.class-rows a.btn'); await text(p, 'Asha Demo');
  await shot(p, 'teacher-roster-dark-mobile', true);
}, { dark: true });

await session(375, 812, '/app/', async (p) => {
  await login(p, email('guardian'));
  await text(p, 'Asha Demo'); await text(p, 'Corrected');
  await shot(p, 'guardian-mobile', true);
});

await session(1440, 900, '/app/', async (p) => {
  await login(p, email('owner'));
  await text(p, 'Needs attention'); await text(p, 'Class register');
  await new Promise((r) => setTimeout(r, 300));
  await shot(p, 'dashboard-desktop', true);
  // chart interactions: hover the register, switch to table view, change range
  await p.hover('.reg .cell.s4, .reg .cell.s3'); await p.waitForSelector('.tip');
  await shot(p, 'dashboard-tooltip-desktop');
  await clickText(p, 'button.link', 'View as table'); await text(p, 'Present or late');
  await clickText(p, 'button.link', 'View as chart');
  await clickText(p, '.seg-ctl button', '30 days'); await text(p, 'Class register');
  await p.click('.nav-link[href="/app/classes"]'); await text(p, 'Create classes');
  await shot(p, 'classes-desktop');
  await p.click('.nav-link[href="/app/learners"]'); await text(p, 'Add learners');
  await p.click('details.import summary');
  await p.type('details.import textarea', `name,external_id,guardian_email\nNew Child,D-${run}-0,nobody@demo.example\nX,N-1,\n`);
  await clickText(p, 'details.import .btn', 'Check file'); await text(p, 'problems to fix');
  await shot(p, 'import-check-desktop', true);
  await p.click('.nav-link[href="/app/audit"]'); await text(p, 'attendance.correct');
  await shot(p, 'audit-desktop');
  // deep link + back/forward
  await p.goBack(); await text(p, 'Add learners');
});

await session(1440, 900, '/app/', async (p) => {
  await login(p, email('owner')); await text(p, 'Class register');
  await clickText(p, '.theme-ctl button', 'Dark'); await new Promise((r) => setTimeout(r, 200));
  await shot(p, 'dashboard-dark-desktop', true);
});
await session(768, 1024, '/app/', async (p) => { await login(p, email('owner')); await text(p, 'Class register'); await shot(p, 'dashboard-tablet', true); });
await session(375, 812, '/app/', async (p) => { await login(p, email('owner')); await text(p, 'Class register'); await shot(p, 'dashboard-mobile', true); });

await browser.close();
assert.deepEqual(problems, [], 'browser reported problems:\n' + problems.join('\n'));
console.log('e2e ok: all browser flows passed with no console errors');
