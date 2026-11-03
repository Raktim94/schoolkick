import { createKernel } from './kernel.ts';
import type { Db } from './db.ts';
import { attendanceModule } from './modules/attendance.ts';
import { authModule } from './modules/auth.ts';
import { classesModule } from './modules/classes.ts';
import { feesModule } from './modules/fees.ts';
import type { PaymentsConfig } from './modules/fees.ts';
import { insightsModule } from './modules/insights.ts';
import { peopleModule } from './modules/people.ts';

/** Compose the API. Each module registers its own routes on the kernel. */
export function buildApp(db: Db, opts: { allowSignup?: boolean; log?: boolean; payments?: PaymentsConfig } = {}) {
  const k = createKernel(db, { log: opts.log });
  authModule(k, db, { allowSignup: opts.allowSignup !== false });
  peopleModule(k);
  classesModule(k);
  attendanceModule(k);
  insightsModule(k);
  feesModule(k, db, opts.payments);
  k.app.get('/healthz', (c) => c.json({ ok: true }));
  k.app.get('/readyz', async (c) => {
    try { await db.query('select 1'); return c.json({ ok: true }); } catch { return c.json({ ok: false }, 503); }
  });
  k.app.all('/api/*', (c) => c.json({ error: { code: 'not_found', message: 'No such endpoint' } }, 404));
  return Object.assign(k.app, { registry: k.routes });
}
