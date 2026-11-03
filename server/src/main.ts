import { serve } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { connect, migrate } from './db.ts';
import { mountWeb } from './web.ts';

const log = (o: object) => console.log(JSON.stringify({ level: 'info', ...o }));
const port = Number(process.env.PORT ?? 8080);
const db = connect(process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/campus');
log({ msg: 'migrations', applied: await migrate(db) });

const app = buildApp(db, { allowSignup: process.env.ALLOW_SIGNUP !== '0', log: true,
  // Online payment stays off unless a webhook secret is set. PAYMENTS_SANDBOX=1 enables the fake test provider (no real money).
  payments: { webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET, sandbox: process.env.PAYMENTS_SANDBOX === '1', siteUrl: process.env.SITE_URL ?? `http://localhost:${port}` } });
mountWeb(app, {
  siteUrl: (process.env.SITE_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
  repoUrl: (process.env.REPO_URL ?? 'https://github.com/Raktim94/schoolkick').replace(/\/$/, ''),
  appDir: process.env.WEB_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url)),
});
const server = serve({ fetch: app.fetch, port });
log({ msg: 'listening', port });
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => server.close(() => db.end().then(() => process.exit(0))));
