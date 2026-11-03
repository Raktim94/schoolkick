import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { createSession, destroySession, hashPassword, limiter, principalFor, SESSION_DAYS, verifyPassword } from '../auth.ts';
import { enterTenant, tx } from '../db.ts';
import type { Db } from '../db.ts';
import { ApiError, SESSION_COOKIE } from '../kernel.ts';
import type { Kernel } from '../kernel.ts';
import { bad, currency, email, password, str } from '../validate.ts';

export function authModule(k: Kernel, db: Db, opts: { allowSignup: boolean }) {
  const loginLimit = limiter(10, 15 * 60_000);
  const signupLimit = limiter(5, 60 * 60_000);

  const startSession = async (c: Context, userId: string, tenantId: string) => {
    const secure = new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https';
    setCookie(c, SESSION_COOKIE, await createSession(db, userId, tenantId), { httpOnly: true, sameSite: 'Lax', path: '/', secure, maxAge: SESSION_DAYS * 86400 });
  };

  k.pub('post', '/tenants', 'Create an institution and its first administrator', async ({ c, ip, body }) => {
    if (!opts.allowSignup) throw new ApiError(403, 'signup_disabled', 'Institution sign-up is disabled');
    if (!signupLimit(ip)) throw new ApiError(429, 'rate_limited', 'Too many sign-ups from this address');
    const b = await body();
    const tz = typeof b.timezone === 'string' ? b.timezone : 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw bad('timezone is not a valid IANA zone'); }
    const cur = b.currency === undefined ? 'INR' : currency(b.currency);
    const name = str(b.institution, 'institution', 2, 120), ownerName = str(b.name, 'name', 2, 120);
    const mail = email(b.email), hash = await hashPassword(password(b.password));
    const out = await tx(db, async (q) => {
      const t = (await q.query('insert into tenants (name, timezone, currency) values ($1,$2,$3) returning id', [name, tz, cur])).rows[0];
      const u = (await q.query(`insert into users (tenant_id, email, name, pw_hash, roles) values ($1,$2,$3,$4,'{owner}') returning id`, [t.id, mail, ownerName, hash])).rows[0];
      await enterTenant(q, t.id);
      await q.query(`insert into audit_events (tenant_id, actor_id, action, entity, entity_id) values ($1,$2,'tenant.create','tenant',$3)`, [t.id, u.id, String(t.id)]);
      return { tenantId: t.id as string, userId: u.id as string };
    });
    await startSession(c, out.userId, out.tenantId);
    return c.json({ ok: true }, 201);
  });

  k.pub('post', '/auth/login', 'Sign in with email and password', async ({ c, ip, body }) => {
    const b = await body();
    const mail = email(b.email), pw = str(b.password, 'password', 1, 200);
    if (!loginLimit(`${ip}|${mail}`)) throw new ApiError(429, 'rate_limited', 'Too many attempts. Wait 15 minutes.');
    const { rows } = await db.query('select id, tenant_id, pw_hash from users where email = $1 and active', [mail]); // an email can exist in several institutions
    for (const u of rows) if (await verifyPassword(pw, u.pw_hash)) { await startSession(c, u.id, u.tenant_id); return { ok: true }; }
    if (!rows.length) await verifyPassword(pw, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'); // keep timing similar for unknown emails
    throw new ApiError(401, 'bad_credentials', 'Email or password is incorrect');
  });

  k.pub('post', '/auth/logout', 'End the current session', async ({ c }) => {
    const t = getCookie(c, SESSION_COOKIE);
    if (t) await destroySession(db, t);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
  });

  // 200 with `me: null` when signed out, so the app can start without a failing request in the console.
  k.pub('get', '/session', 'Who is signed in (me is null when nobody is)', async ({ c }) => {
    const t = getCookie(c, SESSION_COOKIE);
    const p = t ? await principalFor(db, t) : null;
    if (!p) return { me: null };
    const inst = (await db.query('select name from tenants where id = $1', [p.tenantId])).rows[0];
    return { me: { name: p.name, roles: p.roles, institution: inst.name, timezone: p.timezone, currency: p.currency } };
  });
}
