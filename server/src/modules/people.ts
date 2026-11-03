import { randomUUID } from 'node:crypto';
import { hashPassword, ROLES } from '../auth.ts';
import { parseCsv } from '../csv.ts';
import { ApiError } from '../kernel.ts';
import type { Kernel } from '../kernel.ts';
import { bad, email, password, str, uuid } from '../validate.ts';

export function peopleModule(k: Kernel) {
  k.secure('get', '/users', ['owner', 'registrar'], 'List people in this institution', async ({ q, p }) => ({
    users: (await q.query('select id, email, name, roles, active from users where tenant_id = $1 order by name', [p.tenantId])).rows,
  }));

  k.secure('post', '/users', ['owner'], 'Create a staff or guardian account', async ({ q, p, body, audit, c }) => {
    const b = await body();
    const roles = Array.isArray(b.roles) ? b.roles : [];
    if (!roles.length || !roles.every((r) => (ROLES as readonly unknown[]).includes(r))) throw bad(`roles must be a non-empty subset of ${ROLES.join(', ')}`);
    const hash = await hashPassword(password(b.password));
    const r = await q.query('insert into users (tenant_id, email, name, pw_hash, roles) values ($1,$2,$3,$4,$5) on conflict (tenant_id, email) do nothing returning id',
      [p.tenantId, email(b.email), str(b.name, 'name', 2, 120), hash, roles]);
    if (!r.rowCount) throw new ApiError(409, 'duplicate', 'A user with this email already exists');
    await audit('user.create', 'user', r.rows[0].id, { roles });
    return c.json({ id: r.rows[0].id }, 201);
  });

  k.secure('get', '/learners', ['owner', 'registrar'], 'List learners with their guardians', async ({ q, p }) => ({
    learners: (await q.query(
      `select l.id, l.name, l.external_id, coalesce(array_agg(u.email) filter (where u.id is not null), '{}') as guardians
         from learners l left join guardianships g on g.learner_id = l.id left join users u on u.id = g.user_id
        where l.tenant_id = $1 and not l.archived group by l.id order by l.name limit 1000`, [p.tenantId])).rows,
  }));

  k.secure('post', '/learners', ['owner', 'registrar'], 'Add a learner', async ({ q, p, body, audit, c }) => {
    const b = await body();
    const ext = b.externalId ? str(b.externalId, 'externalId', 1, 64) : null;
    const r = await q.query('insert into learners (tenant_id, name, external_id) values ($1,$2,$3) on conflict do nothing returning id', [p.tenantId, str(b.name, 'name', 2, 120), ext]);
    if (!r.rowCount) throw new ApiError(409, 'duplicate', 'A learner with this student ID already exists');
    await audit('learner.create', 'learner', r.rows[0].id);
    return c.json({ id: r.rows[0].id }, 201);
  });

  k.secure('post', '/learners/:id/guardians', ['owner', 'registrar'], 'Link a guardian account to a learner', async ({ q, p, body, audit, param, c }) => {
    const mail = email((await body()).email), id = uuid(param('id'), 'id');
    const r = await q.query(
      `insert into guardianships (tenant_id, user_id, learner_id)
       select $1, u.id, l.id from users u, learners l
        where u.tenant_id = $1 and u.email = $2 and 'guardian' = any(u.roles) and l.tenant_id = $1 and l.id = $3
       on conflict do nothing returning user_id`, [p.tenantId, mail, id]);
    if (!r.rowCount) throw new ApiError(404, 'not_found', 'No guardian account with that email, or learner not found');
    await audit('guardianship.link', 'learner', id, { guardian: r.rows[0].user_id });
    return c.json({ ok: true }, 201);
  });

  // CSV import: name,external_id,guardian_email. A dry run lists every issue; a real run is all-or-nothing.
  k.secure('post', '/learners/import', ['owner', 'registrar'], 'Import learners from CSV (dryRun=1 checks only)', async ({ q, p, c, qs, audit }) => {
    const dryRun = qs('dryRun') !== '0';
    const grid = parseCsv(await c.req.text());
    const head = (grid.shift() ?? []).map((h) => h.trim().toLowerCase());
    const col = (n: string) => head.indexOf(n);
    if (col('name') < 0) throw bad('CSV needs a header row with at least a "name" column');
    if (grid.length > 2000) throw bad('Import at most 2000 rows at a time');
    const cell = (r: string[], n: string) => (col(n) >= 0 ? r[col(n)] ?? '' : '').trim();
    const items = grid.map((r, i) => ({ row: i + 2, name: cell(r, 'name'), ext: cell(r, 'external_id'), guardian: cell(r, 'guardian_email').toLowerCase() }));
    const ex = await q.query('select external_id from learners where tenant_id = $1 and external_id = any($2)', [p.tenantId, items.map((i) => i.ext).filter(Boolean)]);
    const gu = await q.query(`select email, id from users where tenant_id = $1 and 'guardian' = any(roles) and email = any($2)`, [p.tenantId, items.map((i) => i.guardian).filter(Boolean)]);
    const taken = new Set(ex.rows.map((r) => r.external_id)), guardians = new Map(gu.rows.map((r) => [r.email, r.id]));
    const seen = new Set<string>(), issues: { row: number; field: string; message: string }[] = [];
    for (const i of items) {
      if (i.name.length < 2 || i.name.length > 120) issues.push({ row: i.row, field: 'name', message: 'Name must be 2-120 characters' });
      if (i.ext) {
        if (taken.has(i.ext)) issues.push({ row: i.row, field: 'external_id', message: `Student ID ${i.ext} already exists` });
        else if (seen.has(i.ext)) issues.push({ row: i.row, field: 'external_id', message: `Student ID ${i.ext} appears twice in this file` });
        seen.add(i.ext);
      }
      if (i.guardian && !guardians.has(i.guardian)) issues.push({ row: i.row, field: 'guardian_email', message: `No guardian account for ${i.guardian}` });
    }
    let imported = 0;
    if (!dryRun && !issues.length && items.length) {
      const ids = items.map(() => randomUUID());
      await q.query(`insert into learners (id, tenant_id, name, external_id) select u.id, $1, u.n, nullif(u.e, '') from unnest($2::uuid[], $3::text[], $4::text[]) as u(id, n, e)`,
        [p.tenantId, ids, items.map((i) => i.name), items.map((i) => i.ext)]);
      const links = items.map((i, n) => [i, ids[n]] as const).filter(([i]) => i.guardian);
      if (links.length) await q.query('insert into guardianships (tenant_id, user_id, learner_id) select $1, u.g, u.l from unnest($2::uuid[], $3::uuid[]) as u(g, l)',
        [p.tenantId, links.map(([i]) => guardians.get(i.guardian)), links.map(([, id]) => id)]);
      await audit('learners.import', 'learner', undefined, { count: items.length });
      imported = items.length;
    }
    return { dryRun, rows: items.length, issues, imported };
  });
}
