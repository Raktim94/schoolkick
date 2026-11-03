import type { Kernel } from '../kernel.ts';
import { shiftDay, todayIn } from '../validate.ts';

const PRECEDENCE = ['absent', 'late', 'excused', 'present']; // worst first, for a child's day across classes

export function insightsModule(k: Kernel) {
  k.secure('get', '/insights/overview', ['owner', 'registrar'], 'Attendance overview: today, trend, class register, exceptions', async ({ q, p, qs }) => {
    const span = Math.min(90, Math.max(7, Number(qs('days')) || 14));
    const today = todayIn(p.timezone), from = shiftDay(today, -(span - 1));
    // Latest event per (class, learner, day) is the current truth; earlier events are history.
    const latest = `select distinct on (class_id, learner_id, day) class_id, learner_id, day, status
                      from attendance_events where tenant_id = $1 and day between $2 and $3 order by class_id, learner_id, day, id desc`;
    const cells = (await q.query(
      `with latest as (${latest}) select class_id as "classId", day::text, count(*)::int as marked,
              (count(*) filter (where status in ('present','late')))::int as attended from latest group by class_id, day`, [p.tenantId, from, today])).rows;
    const todayRows = (await q.query(`with latest as (${latest}) select status, count(*)::int as n from latest where day = $3 group by status`, [p.tenantId, today, today])).rows;
    const classes = (await q.query(
      `select c.id, c.name, count(l.id)::int as learners from classes c
         left join enrollments e on e.class_id = c.id left join learners l on l.id = e.learner_id and not l.archived
        where c.tenant_id = $1 group by c.id order by c.name`, [p.tenantId])).rows;
    const corrections = (await q.query(
      `select a.created_at as "at", u.name as actor, l.name as learner, c.name as class, a.meta->>'from' as "from", a.meta->>'to' as "to", a.meta->>'reason' as reason
         from audit_events a join users u on u.id = a.actor_id
         join attendance_events ae on ae.id = a.entity_id::bigint join learners l on l.id = ae.learner_id join classes c on c.id = ae.class_id
        where a.tenant_id = $1 and a.action = 'attendance.correct' and a.created_at > now() - interval '7 days' order by a.id desc limit 6`, [p.tenantId])).rows;
    const noGuardian = (await q.query(
      `select count(*)::int as n from learners l where l.tenant_id = $1 and not l.archived and not exists (select 1 from guardianships g where g.learner_id = l.id)`, [p.tenantId])).rows[0].n;

    const byDay = new Map<string, { marked: number; attended: number }>();
    for (const c of cells) {
      const d = byDay.get(c.day) ?? { marked: 0, attended: 0 };
      d.marked += c.marked; d.attended += c.attended; byDay.set(c.day, d);
    }
    const days = [...new Set([...byDay.keys(), today])].sort();
    const markedToday = new Map(cells.filter((c) => c.day === today).map((c) => [c.classId, c.marked]));
    const expected = classes.reduce((s, c) => s + c.learners, 0);
    const count = (s: string) => todayRows.find((r) => r.status === s)?.n ?? 0;
    const marked = todayRows.reduce((s, r) => s + r.n, 0);
    return {
      range: { from, to: today, days: span },
      today: { expected, present: count('present'), absent: count('absent'), late: count('late'), excused: count('excused'), unmarked: Math.max(0, expected - marked) },
      series: days.map((day) => ({ day, ...(byDay.get(day) ?? { marked: 0, attended: 0 }) })),
      register: {
        days,
        rows: classes.map((c) => ({ classId: c.id, name: c.name, learners: c.learners, cells: days.map((d) => cells.find((x) => x.classId === c.id && x.day === d) ?? null).map((x) => (x ? { marked: x.marked, attended: x.attended } : null)) })),
      },
      attention: {
        unmarkedClasses: classes.filter((c) => c.learners > 0 && (markedToday.get(c.id) ?? 0) < c.learners).map((c) => ({ id: c.id, name: c.name, learners: c.learners, marked: markedToday.get(c.id) ?? 0 })),
        corrections,
        learnersWithoutGuardian: noGuardian,
      },
    };
  });

  k.secure('get', '/guardian/learners', ['guardian'], 'Your linked learners with today and the last two weeks', async ({ q, p }) => {
    const today = todayIn(p.timezone), from = shiftDay(today, -13);
    const learners = (await q.query(
      `select l.id, l.name from guardianships g join learners l on l.id = g.learner_id where g.user_id = $1 and l.tenant_id = $2 and not l.archived order by l.name`, [p.userId, p.tenantId])).rows;
    const ids = learners.map((l) => l.id);
    const ev = ids.length ? (await q.query(
      `select distinct on (a.learner_id, a.class_id, a.day) a.learner_id as "learnerId", a.day::text, a.status, c.name as class,
              count(*) over (partition by a.learner_id, a.class_id, a.day) > 1 as corrected
         from attendance_events a join classes c on c.id = a.class_id
        where a.tenant_id = $1 and a.learner_id = any($2) and a.day between $3 and $4 order by a.learner_id, a.class_id, a.day, a.id desc`, [p.tenantId, ids, from, today])).rows : [];
    return {
      day: today,
      learners: learners.map((l) => {
        const mine = ev.filter((e) => e.learnerId === l.id);
        const perDay = new Map<string, string>();
        for (const e of mine) { const prev = perDay.get(e.day); if (!prev || PRECEDENCE.indexOf(e.status) < PRECEDENCE.indexOf(prev)) perDay.set(e.day, e.status); }
        return {
          id: l.id, name: l.name,
          today: mine.filter((e) => e.day === today).map((e) => ({ class: e.class, status: e.status, corrected: e.corrected })).sort((a, b) => a.class.localeCompare(b.class)),
          recent: [...perDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, status]) => ({ day, status })),
        };
      }),
    };
  });

  k.secure('get', '/audit', ['owner'], 'Latest 200 audit events', async ({ q, p }) => ({
    events: (await q.query(
      `select a.id, a.action, a.entity, a.meta, a.created_at as "at", u.name as actor from audit_events a left join users u on u.id = a.actor_id
        where a.tenant_id = $1 order by a.id desc limit 200`, [p.tenantId])).rows,
  }));
}
