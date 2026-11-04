import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import { principalFor } from './auth.ts';
import type { Principal, Role } from './auth.ts';
import { scoped } from './db.ts';
import type { Db, Tx } from './db.ts';

export class ApiError extends Error {
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503;
  code: string;
  constructor(status: ApiError['status'], code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const SESSION_COOKIE = 'schoolkick_session';
type Rec = Record<string, unknown>;
export type PublicCtx = { c: Context; db: Db; ip: string; body: () => Promise<Rec> };
export type Ctx = PublicCtx & {
  p: Principal;
  /** Transaction pinned to the caller's tenant (row-level security applies). */
  q: Tx;
  staff: boolean;
  param: (n: string) => string;
  qs: (n: string) => string | undefined;
  audit: (action: string, entity?: string, id?: string, meta?: object) => Promise<unknown>;
};
type Out = Response | object | void;
export type RouteMeta = { method: string; path: string; summary: string; access: 'public' | Role[] };

/**
 * Route registry with default-deny: a route is either declared `public` on purpose, or names the roles
 * allowed (empty list = any signed-in user). Authentication, role check, tenant scoping and audit
 * plumbing are done here once, so handlers cannot forget them. The OpenAPI document comes from the same list.
 */
export function createKernel(db: Db, opts: { log?: boolean } = {}) {
  const app = new Hono();
  const routes: RouteMeta[] = [];
  const ip = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const body = (c: Context) => async (): Promise<Rec> => {
    const b = await c.req.json().catch(() => null);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ApiError(400, 'invalid_request', 'JSON object body required');
    return b as Rec;
  };
  const reply = (c: Context, out: Out) => (out instanceof Response ? out : c.json(out ?? { ok: true }));

  app.use('*', async (c, next) => {
    const rid = randomUUID().slice(0, 8), t0 = performance.now();
    c.header('X-Request-Id', rid);
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    // style-src allows one hashed stylesheet: React Aria injects a single `touch-action` rule at runtime. If a React Aria upgrade changes
    // that rule the browser reports the new hash in a CSP console error (the browser e2e fails on console errors); update the hash then.
    c.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (/^\/(app|api)(\/|$)/.test(c.req.path)) c.header('X-Robots-Tag', 'noindex, nofollow'); // keep the product out of search; robots.txt must NOT block it or crawlers never see this
    if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store');
    if (opts.log) console.log(JSON.stringify({ level: 'info', rid, method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - t0) }));
  });
  app.use('/api/*', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: { code: 'too_large', message: 'Body too large' } }, 413) }));
  app.use('/api/*', async (c, next) => {
    // Provider webhooks are server-to-server and authenticated by signature instead of a browser session.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !c.req.path.startsWith('/api/v1/webhooks/')) {
      const origin = c.req.header('origin');
      if (c.req.header('x-requested-with') !== 'schoolkick' || (origin && new URL(origin).host !== c.req.header('host')))
        throw new ApiError(403, 'csrf', 'Cross-site request blocked');
    }
    await next();
  });
  app.onError((e, c) => {
    if (e instanceof ApiError) return c.json({ error: { code: e.code, message: e.message } }, e.status);
    if ((e as { code?: string }).code === '23505') return c.json({ error: { code: 'duplicate', message: 'That already exists. Refresh and check.' } }, 409); // lost a race on a unique rule
    console.error(JSON.stringify({ level: 'error', path: c.req.path, msg: e.message }));
    return c.json({ error: { code: 'internal', message: 'Something went wrong on our side. Try again.' } }, 500);
  });

  const pub = (method: 'get' | 'post', path: string, summary: string, h: (x: PublicCtx) => Promise<Out>) => {
    routes.push({ method, path, summary, access: 'public' });
    app[method](`/api/v1${path}`, async (c) => reply(c, await h({ c, db, ip: ip(c), body: body(c) })));
  };

  const secure = (method: 'get' | 'post' | 'put', path: string, roles: Role[], summary: string, h: (x: Ctx) => Promise<Out>) => {
    routes.push({ method, path, summary, access: roles });
    app[method](`/api/v1${path}`, async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      const p = token ? await principalFor(db, token) : null;
      if (!p) throw new ApiError(401, 'unauthenticated', 'Sign in to continue');
      if (roles.length && !roles.some((r) => p.roles.includes(r))) throw new ApiError(403, 'forbidden', 'Your role cannot do this');
      // One transaction per request: the action and its audit entry commit or roll back together.
      return scoped(db, p.tenantId, async (q) => {
        const staff = p.roles.includes('owner') || p.roles.includes('registrar');
        const audit: Ctx['audit'] = (action, entity, id, meta = {}) =>
          q.query('insert into audit_events (tenant_id, actor_id, action, entity, entity_id, meta) values ($1,$2,$3,$4,$5,$6)', [p.tenantId, p.userId, action, entity ?? null, id ?? null, meta]);
        return reply(c, await h({ c, db, ip: ip(c), body: body(c), p, q, staff, audit, param: (n) => c.req.param(n) ?? '', qs: (n) => c.req.query(n) }));
      });
    });
  };

  const openapi = () => {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const r of routes) {
      const key = '/api/v1' + r.path.replace(/:(\w+)/g, '{$1}');
      (paths[key] ??= {})[r.method] = {
        summary: r.summary,
        security: r.access === 'public' ? [] : [{ session: [] }],
        'x-roles': r.access === 'public' ? 'public' : r.access.length ? r.access : 'any signed-in user',
        responses: { '200': { description: 'OK' }, ...(r.access === 'public' ? {} : { '401': { description: 'Not signed in' }, '403': { description: 'Role not allowed' } }) },
      };
    }
    return { openapi: '3.1.0', info: { title: 'SchoolKick API', version: '0.3.0' }, paths,
      components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE } } } };
  };
  pub('get', '/openapi.json', 'OpenAPI description of this API', async ({ c }) => c.json(openapi()));

  return { app, routes, pub, secure };
}
export type Kernel = ReturnType<typeof createKernel>;
