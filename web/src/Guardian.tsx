import { StatusMark, STATUS, fmtDay } from './charts';
import type { Status as St } from './charts';
import { Empty, Loading, PageHead, Status, useApi } from './ui';

type Learner = { id: string; name: string; today: { class: string; status: St; corrected: boolean }[]; recent: { day: string; status: St }[] };

export function Guardian() {
  const { data, loading, error } = useApi<{ day: string; learners: Learner[] }>('/guardian/learners');
  if (loading && !data) return <Loading />;
  if (error && !data) return <Status kind="error">{error}</Status>;
  if (!data?.learners.length) return <Empty title="No learners are linked to your account yet" hint="Ask the school office to link your email address to your child’s record." />;
  return (
    <>
      <PageHead title="Today" sub={fmtDay(data.day, { weekday: 'long', month: 'long', day: 'numeric' })} />
      <div className="kids">
        {data.learners.map((l) => (
          <section key={l.id} className="panel" aria-labelledby={`k-${l.id}`}>
            <h2 id={`k-${l.id}`}>{l.name}</h2>
            {l.today.length === 0 ? <p className="muted">The school has not recorded attendance for today yet.</p> : (
              <ul className="rows plain-rows">{l.today.map((t) => <li key={t.class}><span>{t.class}</span><StatusMark status={t.status} corrected={t.corrected} /></li>)}</ul>
            )}
            {l.recent.length > 0 && (
              <>
                <h3>Last two weeks</h3>
                <ul className="strip" aria-label={`Attendance for ${l.name}, last two weeks`}>
                  {l.recent.map((r) => <li key={r.day} className={`mark ${r.status}`} title={`${fmtDay(r.day, { weekday: 'long', month: 'long', day: 'numeric' })}: ${STATUS[r.status].label}`}><small>{fmtDay(r.day, { weekday: 'narrow' })}</small><i aria-hidden="true">{STATUS[r.status].glyph}</i><span className="sr">{fmtDay(r.day)}: {STATUS[r.status].label}</span></li>)}
                </ul>
                <p className="muted small-print">/ present &nbsp; ○ absent &nbsp; L late &nbsp; E excused. Days with no mark are not shown.</p>
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
