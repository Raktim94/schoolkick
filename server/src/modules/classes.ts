import { ApiError } from '../kernel.ts';
import type { Kernel } from '../kernel.ts';
import { str, todayIn, uuid } from '../validate.ts';

export function classesModule(k: Kernel) {
  k.secure('get', '/classes', ['owner', 'registrar', 'teacher'], 'Classes you can see, with today’s attendance progress', async ({ q, p, staff }) => ({
    classes: (await q.query(
      `select c.id, c.name,
              (select count(*)::int from enrollments e where e.class_id = c.id) as learners,
              (select count(distinct a.learner_id)::int from attendance_events a where a.class_id = c.id and a.day = $4) as "markedToday",
              coalesce((select array_agg(u.name order by u.name) from class_teachers ct join users u on u.id = ct.user_id where ct.class_id = c.id), '{}') as teachers
         from classes c
        where c.tenant_id = $1 and ($2 or exists (select 1 from class_teachers ct where ct.class_id = c.id and ct.user_id = $3)) order by c.name`,
      [p.tenantId, staff, p.userId, todayIn(p.timezone)])).rows,
  }));

  k.secure('post', '/classes', ['owner', 'registrar'], 'Create a class', async ({ q, p, body, audit, c }) => {
    const r = await q.query('insert into classes (tenant_id, name) values ($1,$2) returning id', [p.tenantId, str((await body()).name, 'name', 1, 120)]);
    await audit('class.create', 'class', r.rows[0].id);
    return c.json({ id: r.rows[0].id }, 201);
  });

  k.secure('post', '/classes/:id/teachers', ['owner', 'registrar'], 'Assign a teacher to a class', async ({ q, p, body, audit, param, c }) => {
    const id = uuid(param('id'), 'id');
    const r = await q.query(
      `insert into class_teachers (tenant_id, class_id, user_id) select $1, c.id, u.id from classes c, users u
        where c.id = $2 and c.tenant_id = $1 and u.id = $3 and u.tenant_id = $1 and 'teacher' = any(u.roles) on conflict do nothing returning user_id`,
      [p.tenantId, id, uuid((await body()).userId, 'userId')]);
    if (!r.rowCount) throw new ApiError(404, 'not_found', 'Class or teacher not found (or already assigned)');
    await audit('class.assign_teacher', 'class', id);
    return c.json({ ok: true }, 201);
  });

  k.secure('post', '/classes/:id/enrollments', ['owner', 'registrar'], 'Enrol a learner in a class', async ({ q, p, body, audit, param, c }) => {
    const id = uuid(param('id'), 'id');
    const r = await q.query(
      `insert into enrollments (tenant_id, class_id, learner_id) select $1, c.id, l.id from classes c, learners l
        where c.id = $2 and c.tenant_id = $1 and l.id = $3 and l.tenant_id = $1 and not l.archived on conflict do nothing returning learner_id`,
      [p.tenantId, id, uuid((await body()).learnerId, 'learnerId')]);
    if (!r.rowCount) throw new ApiError(404, 'not_found', 'Class or learner not found (or already enrolled)');
    await audit('class.enroll', 'class', id);
    return c.json({ ok: true }, 201);
  });
}
