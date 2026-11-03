import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { connect, migrate } from '../src/db.ts';

const admin = process.env.TEST_ADMIN_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';

export const WEBHOOK_SECRET = 'test-webhook-secret';
export async function freshApp() {
  const name = `campus_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const a = new pg.Client({ connectionString: admin });
  await a.connect();
  await a.query(`create database ${name}`);
  await a.end();
  const db = connect(admin.replace(/\/[^/]*$/, `/${name}`));
  await migrate(db);
  const app = buildApp(db, { payments: { sandbox: true, webhookSecret: WEBHOOK_SECRET } });
  return {
    app, db,
    async close() {
      await db.end();
      const c = new pg.Client({ connectionString: admin });
      await c.connect();
      await c.query(`drop database ${name} with (force)`);
      await c.end();
    },
  };
}

/** Tiny cookie-keeping client. */
export function client(app: ReturnType<typeof buildApp>) {
  let cookie = '';
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const call = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { 'x-requested-with': 'schoolkick', host: 'localhost', 'x-forwarded-for': ip, ...extra };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined && typeof body !== 'string') headers['content-type'] = 'application/json';
    const res = await app.request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!.endsWith('=') ? '' : set.split(';')[0]!;
    const data = await res.json().catch(() => null) as any;
    return { status: res.status, data, headers: res.headers };
  };
  const bytes = async (path: string) => {
    const res = await app.request(`http://localhost${path}`, { headers: { cookie, host: 'localhost' } });
    return { status: res.status, type: res.headers.get('content-type'), body: Buffer.from(await res.arrayBuffer()) };
  };
  return { bytes, get: (p: string) => call('GET', p), post: (p: string, b?: unknown, h?: Record<string, string>) => call('POST', p, b ?? {}, h), put: (p: string, b: unknown) => call('PUT', p, b), raw: call };
}
