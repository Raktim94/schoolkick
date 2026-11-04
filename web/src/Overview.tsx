import { useEffect, useState } from 'react';
import { useCountUp } from '@/hooks/use-count-up';
import { Register, SegBar, Trend, fmtDay } from './charts';
import type { Part } from './charts';
import { Link, navigate } from './router';
import { Empty, fmtTime, Loading, PageHead, Status, useApi } from './ui';

type Data = {
  range: { from: string; to: string; days: number };
  today: { expected: number; present: number; absent: number; late: number; excused: number; unmarked: number };
  series: { day: string; marked: number; attended: number }[];
  register: { days: string[]; rows: { classId: string; name: string; learners: number; cells: ({ marked: number; attended: number } | null)[] }[] };
  attention: { unmarkedClasses: { id: string; name: string; learners: number; marked: number }[]; corrections: { at: string; actor: string; learner: string; class: string; from: string; to: string; reason: string }[]; learnersWithoutGuardian: number };
};
const RANGES = [7, 14, 30];

export function Overview({ canAudit = false }: { canAudit?: boolean }) {
  const [days, setDays] = useState(14);
  const { data, error, loading, reload } = useApi<Data>(`/insights/overview?days=${days}`);
  const shortcuts = <nav className="dashboard-links" aria-label="Workspace shortcuts"><span>Go to</span><Link to="/classes">Classes</Link><Link to="/learners">Learners</Link><Link to="/people">People</Link>{canAudit && <Link to="/audit">Audit log</Link>}</nav>;
  if (!data) return <><PageHead title="Overview" />{shortcuts}{error ? <Status kind="error">{error}</Status> : <Loading />}</>;
  const t = data.today, marked = t.expected - t.unmarked, attended = t.present + t.late;
  const parts: Part[] = [
    { key: 'present', label: 'Present', n: t.present, css: 'c-present' }, { key: 'absent', label: 'Absent', n: t.absent, css: 'c-absent' },
    { key: 'late', label: 'Late', n: t.late, css: 'c-late' }, { key: 'excused', label: 'Excused', n: t.excused, css: 'c-excused', ink: 'dark' },
    { key: 'unmarked', label: 'Not marked yet', n: t.unmarked, css: 'c-none' },
  ];
  const a = data.attention, nothing = !a.unmarkedClasses.length && !a.corrections.length && !a.learnersWithoutGuardian;
  const empty = t.expected === 0;

  return (
    <div className={loading ? 'dim' : ''}>
      <PageHead title="Overview" sub={fmtDay(data.range.to, { weekday: 'long', month: 'long', day: 'numeric' })}>
        <div className="seg-ctl" role="group" aria-label="Date range">
          {RANGES.map((r) => <button key={r} aria-pressed={days === r} className={days === r ? 'on' : ''} onClick={() => setDays(r)}>{r} days</button>)}
        </div>
        <button className="btn secondary" onClick={reload}>Refresh</button>
      </PageHead>
      {shortcuts}

      {empty ? (
        <Empty title="Add learners and classes to see attendance here" hint="Create a class, enrol learners, and assign a teacher. The overview fills in as soon as attendance is taken.">
          <p><Link className="btn" to="/classes">Set up classes</Link></p>
        </Empty>
      ) : (
        <div className="dash">
          <div className="dash-main">
            <section className="panel hero-panel" aria-labelledby="today-h">
              <h2 id="today-h">Today</h2>
              <div className="hero-fig"><span className="big">{marked ? <CountPct value={Math.round((attended / marked) * 100)} /> : '—'}</span><span className="muted">{marked ? `present or late, ${marked} of ${t.expected} learners marked` : 'No attendance recorded yet today'}</span></div>
              <SegBar parts={parts} total={t.expected} name="Today’s attendance" />
            </section>
            <section className="panel" aria-labelledby="trend-h"><h2 id="trend-h">Attendance rate</h2><Trend series={data.series} /></section>
            <section className="panel" aria-labelledby="reg-h"><h2 id="reg-h">Class register</h2>
              <Register days={data.register.days} rows={data.register.rows} today={data.range.to} onOpen={(id) => navigate(`/classes/${id}`)} /></section>
          </div>

          <aside className="dash-aside" aria-labelledby="attn-h">
            <section className="panel"><h2 id="attn-h">Needs attention</h2>
              {nothing && <p className="muted">Nothing needs attention right now.</p>}
              {a.unmarkedClasses.length > 0 && (<><h3>Attendance not finished today</h3>
                <ul className="rows">{a.unmarkedClasses.map((c) => <li key={c.id}><Link to={`/classes/${c.id}`}><b>{c.name}</b><span className="muted">{c.marked} of {c.learners} marked</span></Link></li>)}</ul></>)}
              {a.corrections.length > 0 && (<><h3>Corrections this week</h3>
                <ul className="rows">{a.corrections.map((c, i) => <li key={i}><div><b>{c.learner}</b> <span className="muted">{c.class}</span><br />{c.from} changed to {c.to}<br /><span className="muted">{c.actor}, {fmtTime(c.at)}. “{c.reason}”</span></div></li>)}</ul></>)}
              {a.learnersWithoutGuardian > 0 && (<><h3>Records to complete</h3>
                <ul className="rows"><li><Link to="/people"><b>{a.learnersWithoutGuardian} learner{a.learnersWithoutGuardian === 1 ? '' : 's'}</b><span className="muted">no guardian linked</span></Link></li></ul></>)}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

/** Rolls the headline percentage up from 0 on first view; shows the final number at once for reduced-motion users. */
function CountPct({ value }: { value: number }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [target, setTarget] = useState(reduce ? value : 0);
  useEffect(() => { setTarget(value); }, [value]);
  const shown = useCountUp(target, 900);
  return <>{reduce ? value : shown}%</>;
}
