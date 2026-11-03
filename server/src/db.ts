import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export const connect = (url: string): Db => new pg.Pool({ connectionString: url, max: 10 });

/** Run fn in a transaction; rolls back on throw. */
export async function tx<T>(db: Db, fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Apply migrations/*.sql once each, serialised by an advisory lock so replicas can start together. */
export async function migrate(db: Db): Promise<string[]> {
  const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  await tx(db, async (c) => {
    await c.query('select pg_advisory_xact_lock(727274)');
    await c.query('create table if not exists schema_migrations (name text primary key, at timestamptz not null default now())');
    const done = new Set((await c.query('select name from schema_migrations')).rows.map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      await c.query(readFileSync(dir + f, 'utf8'));
      await c.query('insert into schema_migrations (name) values ($1)', [f]);
      applied.push(f);
    }
  });
  return applied;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Drop to the unprivileged app role and pin the transaction to one tenant; row-level security does the rest. */
export function enterTenant(q: Tx, tenantId: string) {
  if (!UUID.test(tenantId)) throw new Error('invalid tenant id');
  return q.query(`set local role campusos_app; select set_config('app.tenant_id', '${tenantId}', true)`);
}

/** Run fn in a transaction scoped to one tenant. Every authenticated request goes through this. */
export async function scoped<T>(db: Db, tenantId: string, fn: (q: Tx) => Promise<T>): Promise<T> {
  return tx(db, async (q) => {
    await enterTenant(q, tenantId);
    return fn(q);
  });
}
