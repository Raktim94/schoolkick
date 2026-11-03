import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Db } from './db.ts';

const scryptAsync = promisify(scrypt) as (p: string, s: Buffer, n: number) => Promise<Buffer>;

export const ROLES = ['owner', 'registrar', 'teacher', 'finance', 'guardian'] as const;
export type Role = (typeof ROLES)[number];
export type Principal = { userId: string; tenantId: string; roles: Role[]; name: string; timezone: string };

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await scryptAsync(pw, salt, 64)).toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const SESSION_DAYS = 14;

export async function createSession(db: Db, userId: string, tenantId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `insert into sessions (token_hash, user_id, tenant_id, expires_at) values ($1,$2,$3, now() + make_interval(days => $4))`,
    [sha(token), userId, tenantId, SESSION_DAYS],
  );
  return token;
}

export const destroySession = (db: Db, token: string) => db.query('delete from sessions where token_hash = $1', [sha(token)]);

/** Resolve a session token to a principal. Tenant and roles always come from the DB, never from the client. */
export async function principalFor(db: Db, token: string): Promise<Principal | null> {
  const { rows } = await db.query(
    `select u.id, u.tenant_id, u.roles, u.name, t.timezone from sessions s
       join users u on u.id = s.user_id and u.tenant_id = s.tenant_id and u.active
       join tenants t on t.id = u.tenant_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha(token)],
  );
  const r = rows[0];
  return r ? { userId: r.id, tenantId: r.tenant_id, roles: r.roles, name: r.name, timezone: r.timezone } : null;
}

/** Fixed-window limiter, in-memory (single node). */
export function limiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return true;
    }
    return ++h.n <= max;
  };
}
