import { ApiError } from '../kernel.ts';
import type { Ctx, Kernel } from '../kernel.ts';
import { bad, dayOrToday, str, uuid } from '../validate.ts';

const STATUSES = ['present', 'absent', 'late', 'excused'];

/** Resolve the class and enforce "teachers only reach classes they are assigned to". */
async function classFor({ q, p, staff, param }: Ctx) {
  const { rows } = await q.query(
    `select c.id, c.name, ($3 or exists (select 1 from class_teachers ct where ct.class_id = c.id and ct.user_id = $4)) as allowed
       from classes c where c.id::text = $1 and c.tenant_id = $2`, [param('id'), p.tenantId, staff, p.userId]);
  if (!rows[0]) throw new ApiError(404, 'not_found', 'Class not found');
  if (!rows[0].allowed) throw new ApiError(403, 'forbidden', 'You are not assigned to this class');
  return rows[0] as { id: string; name: string };
}

export function attendanceModule(k: Kernel) {
  const roles = ['owner', 'registrar', 'teacher'] as const;

  k.secure('get', '/classes/:id/attendance', [...roles], 'Roster with the current status for a day', async (x) => {
    const cls = await classFor(x), day = dayOrToday(x.qs('day'), x.p.timezone);
    const { rows } = await x.q.query(
      `select l.id as "learnerId", l.name, a.status, a.reason, coalesce(a.versions, 0) > 1 as corrected
         from enrollments e join learners l on l.id = e.learner_id and not l.archived
         left join lateral (select status, reason, count(*) over () as versions from attendance_events
                             where class_id = e.class_id and learner_id = e.learner_id and day = $2 order by id desc limit 1) a on true
        where e.class_id = $1 order by l.name`, [cls.id, day]);
    return { class: cls.name, day, roster: rows };
  });

  // First mark creates a record; changing it needs a reason and adds a new event. Nothing is overwritten.
  k.secure('put', '/classes/:id/attendance', [...roles], 'Save attendance marks (corrections need a reason)', async (x) => {
    const cls = await classFor(x), b = await x.body(), day = dayOrToday(b.day, x.p.timezone);
    const marks = Array.isArray(b.marks) ? b.marks : [];
    if (!marks.length || marks.length > 500) throw bad('marks must contain 1-500 entries');
    let created = 0, corrected = 0, unchanged = 0;
    for (const m of marks) {
      if (!m || typeof m !== 'object') throw bad('each mark must be an object');
      const learnerId = uuid(m.learnerId, 'learnerId'), status = m.status;
      if (!STATUSES.includes(status)) throw bad(`status must be one of ${STATUSES.join(', ')}`);
      if (!(await x.q.query('select 1 from enrollments where class_id = $1 and learner_id = $2', [cls.id, learnerId])).rowCount) throw bad(`Learner ${learnerId} is not enrolled in this class`);
      const cur = (await x.q.query('select status from attendance_events where class_id = $1 and learner_id = $2 and day = $3 order by id desc limit 1', [cls.id, learnerId, day])).rows[0];
      if (cur?.status === status) { unchanged++; continue; }
      const reason = cur ? str(m.reason, 'reason', 3, 300) : null;
      const ev = (await x.q.query('insert into attendance_events (tenant_id, class_id, learner_id, day, status, reason, actor_id) values ($1,$2,$3,$4,$5,$6,$7) returning id',
        [x.p.tenantId, cls.id, learnerId, day, status, reason, x.p.userId])).rows[0];
      if (cur) { corrected++; await x.audit('attendance.correct', 'attendance_event', String(ev.id), { from: cur.status, to: status, reason }); } else created++;
    }
    return { created, corrected, unchanged };
  });

  k.secure('get', '/classes/:id/attendance/history', [...roles], 'Every attendance event for a day, newest first', async (x) => {
    const cls = await classFor(x), day = dayOrToday(x.qs('day'), x.p.timezone);
    const { rows } = await x.q.query(
      `select a.id, l.name as learner, a.status, a.reason, u.name as actor, a.created_at as "at" from attendance_events a
         join learners l on l.id = a.learner_id join users u on u.id = a.actor_id
        where a.class_id = $1 and a.day = $2 order by a.id desc limit 500`, [cls.id, day]);
    return { events: rows };
  });
}
