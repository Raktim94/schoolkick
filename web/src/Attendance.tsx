import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { Link } from './router';
import { Empty, fmtTime, Loading, Meter, PageHead, Status, useAction, useApi } from './ui';

const STATUSES = ['present', 'absent', 'late', 'excused'] as const;
type St = (typeof STATUSES)[number];
type Row = { learnerId: string; name: string; status: St | null; reason: string | null; corrected: boolean };
type Roster = { class: string; day: string; roster: Row[] };
type Mark = { status: St; reason: string };

const draftKey = (c: string, d: string) => `campusos:draft:${c}:${d}`;
const readDraft = (k: string): Record<string, Mark> => { try { return JSON.parse(localStorage.getItem(k) ?? '{}'); } catch { return {}; } };
const writeDraft = (k: string, v: Record<string, Mark>) => { try { Object.keys(v).length ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch { /* storage unavailable */ } };

export function Attendance({ classId, back }: { classId: string; back: string }) {
  const [day, setDay] = useState('');
  const { data, error, loading, reload } = useApi<Roster>(`/classes/${classId}/attendance${day ? `?day=${day}` : ''}`);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [showHistory, setShowHistory] = useState(false);
  const act = useAction();
  const key = data ? draftKey(classId, data.day) : '';

  // Restore an unsent draft for this class and day after load (survives reloads and lost connections).
  // Only once per class+day: refetches after a save must not overwrite what the teacher is editing.
  const restored = useRef('');
  useEffect(() => { if (key && restored.current !== key) { restored.current = key; setMarks(readDraft(key)); } }, [key]);
  useEffect(() => { if (key && restored.current === key) writeDraft(key, marks); }, [key, marks]);

  const rows = data?.roster ?? [];
  const changes = useMemo(() => rows.filter((r) => marks[r.learnerId] && marks[r.learnerId].status !== r.status), [rows, marks]);
  const needReason = changes.filter((r) => r.status && !(marks[r.learnerId].reason.trim().length >= 3));
  const set = (id: string, status: St) => setMarks((m) => ({ ...m, [id]: { status, reason: m[id]?.reason ?? '' } }));

  const save = () => act.run(async () => {
    const res = await api<{ created: number; corrected: number }>('PUT', `/classes/${classId}/attendance`, {
      day: data!.day,
      marks: changes.map((r) => ({ learnerId: r.learnerId, status: marks[r.learnerId].status, reason: r.status ? marks[r.learnerId].reason.trim() : undefined })),
    });
    setMarks({});
    writeDraft(key, {});
    reload();
    return `Attendance saved for ${res.created + res.corrected} learner${res.created + res.corrected === 1 ? '' : 's'}${res.corrected ? ` (${res.corrected} correction${res.corrected === 1 ? '' : 's'} recorded)` : ''}.`;
  });

  if (loading && !data) return <Loading />;
  if (error && !data) return <Status kind="error">{error}</Status>;
  if (!data) return null;
  const unmarked = rows.filter((r) => !r.status && !marks[r.learnerId]).length;

  return (
    <section aria-labelledby="att-h">
      <Link className="link" to={back}>Back to classes</Link>
      <PageHead title={data.class} sub={`${rows.length - unmarked} of ${rows.length} marked`}>
        <label className="inline">Date
          <input type="date" value={data.day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDay(e.target.value)} />
        </label>
      </PageHead>
      {rows.length === 0 ? <Empty title="No learners in this class yet" hint="Ask an administrator to enrol learners." /> : (
        <>
          <div className="toolbar">
            <button className="btn secondary" disabled={!unmarked} onClick={() => setMarks((m) => { const n = { ...m }; for (const r of rows) if (!r.status && !n[r.learnerId]) n[r.learnerId] = { status: 'present', reason: '' }; return n; })}>
              Mark {unmarked} unmarked as present
            </button>
            <Meter value={rows.length - unmarked} max={rows.length} label="Learners marked" />
          </div>
          <ul className="roster">
            {rows.map((r) => {
              const cur = marks[r.learnerId]?.status ?? r.status;
              const editing = marks[r.learnerId] && marks[r.learnerId].status !== r.status && r.status;
              return (
                <li key={r.learnerId}>
                  <fieldset>
                    <legend>
                      {r.name}
                      {r.corrected && <span className="tag">Corrected</span>}
                    </legend>
                    <div className="choice">
                      {STATUSES.map((s) => (
                        <label key={s} className={cur === s ? 'on' : ''}>
                          <input type="radio" name={r.learnerId} checked={cur === s} onChange={() => set(r.learnerId, s)} />
                          {s[0].toUpperCase() + s.slice(1)}
                        </label>
                      ))}
                    </div>
                    {editing && (
                      <label className="reason">Reason for correcting {r.status} to {marks[r.learnerId].status}
                        <input value={marks[r.learnerId].reason} onChange={(e) => setMarks((m) => ({ ...m, [r.learnerId]: { ...m[r.learnerId], reason: e.target.value } }))} placeholder="For example: marked the wrong learner" maxLength={300} />
                      </label>
                    )}
                  </fieldset>
                </li>
              );
            })}
          </ul>
          <div className="sticky-bar">
            <button className="btn" disabled={!changes.length || needReason.length > 0 || act.busy} onClick={save}>
              {act.busy ? 'Saving…' : changes.length ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'}` : 'No changes to save'}
            </button>
            {needReason.length > 0 && <span className="muted">Add a reason for {needReason.length} correction{needReason.length === 1 ? '' : 's'}.</span>}
          </div>
        </>
      )}
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      <button className="link" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>{showHistory ? 'Hide' : 'Show'} history for this day</button>
      {showHistory && <History key={rows.map((r) => r.status).join()} classId={classId} day={data.day} />}
    </section>
  );
}

function History({ classId, day }: { classId: string; day: string }) {
  const { data, loading } = useApi<{ events: { id: number; learner: string; status: string; reason: string | null; actor: string; at: string }[] }>(`/classes/${classId}/attendance/history?day=${day}`);
  if (loading) return <Loading />;
  if (!data?.events.length) return <Empty title="Nothing recorded for this day yet" />;
  return (
    <table className="table">
      <thead><tr><th>When</th><th>Learner</th><th>Status</th><th>By</th><th>Reason</th></tr></thead>
      <tbody>{data.events.map((e) => <tr key={e.id}><td>{fmtTime(e.at)}</td><td>{e.learner}</td><td>{e.status}</td><td>{e.actor}</td><td>{e.reason ?? '—'}</td></tr>)}</tbody>
    </table>
  );
}

export function Today() {
  const { data, loading, error } = useApi<{ classes: { id: string; name: string; learners: number; markedToday: number }[] }>('/classes');
  if (loading && !data) return <Loading />;
  if (error && !data) return <Status kind="error">{error}</Status>;
  return (
    <>
      <PageHead title="Today’s classes" sub="Take attendance for each class you teach." />
      {!data?.classes.length ? <Empty title="No classes are assigned to you" hint="An administrator can assign you to a class." /> : (
        <ul className="rows class-rows">
          {data.classes.map((c) => (
            <li key={c.id}>
              <div className="grow"><b>{c.name}</b><span className="muted">{c.markedToday} of {c.learners} marked</span></div>
              <Meter value={c.markedToday} max={c.learners} label={`${c.name} attendance progress`} />
              <Link className={`btn${c.markedToday >= c.learners && c.learners > 0 ? ' secondary' : ''}`} to={`/classes/${c.id}`}>{c.markedToday === 0 ? 'Take attendance' : c.markedToday < c.learners ? 'Continue' : 'Review'}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
