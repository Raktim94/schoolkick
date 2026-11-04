import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

export type Status = 'present' | 'absent' | 'late' | 'excused';
// Ledger marks: the glyph carries identity so colour is never the only cue.
export const STATUS: Record<Status, { label: string; glyph: string }> = {
  present: { label: 'Present', glyph: '/' }, absent: { label: 'Absent', glyph: '○' }, late: { label: 'Late', glyph: 'L' }, excused: { label: 'Excused', glyph: 'E' },
};
export const StatusMark = ({ status, corrected }: { status: Status; corrected?: boolean }) => (
  <span className={`mark ${status}`}><i aria-hidden="true">{STATUS[status].glyph}</i>{STATUS[status].label}{corrected && <span className="tag" title="The school corrected this entry. The history is kept.">Corrected</span>}</span>
);

export const fmtDay = (day: string, o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { ...o, timeZone: 'UTC' });
const pct = (a: number, m: number) => (m ? Math.round((a / m) * 1000) / 10 : null);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** One floating readout, positioned by the caller. Content is rendered as text, never as HTML. */
function Tip({ at, children }: { at: { x: number; y: number } | null; children: ReactNode }) {
  if (!at) return null;
  return <div className="tip" role="tooltip" style={{ left: at.x, top: at.y }}>{children}</div>;
}

function ViewToggle({ table, set }: { table: boolean; set: (v: boolean) => void }) {
  return <button className="link small" aria-pressed={table} onClick={() => set(!table)}>{table ? 'View as chart' : 'View as table'}</button>;
}

/* ---------- Trend: attendance rate by day (single series: no legend, the title names it) ---------- */
export function Trend({ series }: { series: { day: string; marked: number; attended: number }[] }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const pts = series.filter((s) => s.marked > 0).map((s) => ({ ...s, rate: pct(s.attended, s.marked)! }));
  if (pts.length < 2) return <p className="muted">The trend appears once attendance has been recorded on two different days.</p>;

  const H = 224, m = { l: 44, r: 52, t: 14, b: 30 }, iw = Math.max(10, W - m.l - m.r), ih = H - m.t - m.b;
  const lo = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.rate)) / 10) * 10 - 10), hi = 100;
  const x = (i: number) => m.l + (i * iw) / (pts.length - 1);
  const y = (v: number) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [lo, lo + (hi - lo) / 3, lo + (2 * (hi - lo)) / 3, hi].map(Math.round);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join('');
  const area = `${line}L${x(pts.length - 1)},${m.t + ih}L${x(0)},${m.t + ih}Z`;
  const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(iw / 70))));
  const last = pts.length - 1, a = active ?? null, cur = a === null ? null : pts[a];

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setActive(Math.min(last, Math.max(0, Math.round(((e.clientX - r.left - m.l) / iw) * last))));
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setActive((v) => Math.max(0, (v ?? last) - 1));
    else if (e.key === 'ArrowRight') setActive((v) => Math.min(last, (v ?? last) + 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };
  const summary = `Attendance rate by day, ${fmtDay(pts[0].day)} to ${fmtDay(pts[last].day)}. Latest ${pts[last].rate}%. Lowest ${Math.min(...pts.map((p) => p.rate))}%.`;

  return (
    <div className="chart">
      <div className="chart-head"><span className="muted">Share of marked learners who were present or late. Days with attendance recorded.</span><ViewToggle table={table} set={setTable} /></div>
      {table ? (
        <div className="scroll"><table className="table"><thead><tr><th>Day</th><th>Marked</th><th>Present or late</th><th>Rate</th></tr></thead>
          <tbody>{pts.map((p) => <tr key={p.day}><td>{fmtDay(p.day, { weekday: 'short', month: 'short', day: 'numeric' })}</td><td>{p.marked}</td><td>{p.attended}</td><td>{p.rate}%</td></tr>)}</tbody></table></div>
      ) : (
        <div ref={ref} className="plot" tabIndex={0} role="group" aria-label={summary + ' Use left and right arrow keys to read each day.'} onKeyDown={key} onBlur={() => setActive(null)} onFocus={() => setActive((v) => v ?? last)}>
          {W > 0 && (
            <svg width={W} height={H} onPointerMove={move} onPointerLeave={() => setActive(null)} aria-hidden="true">
              {ticks.map((t) => <g key={t}><line className="grid" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text className="axis" x={m.l - 8} y={y(t) + 4} textAnchor="end">{t}%</text></g>)}
              {pts.map((p, i) => (i % every === 0 && (last - i >= every || i === last)) || i === last ? <text key={p.day} className="axis" x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>{fmtDay(p.day)}</text> : null)}
              <path className="area" d={area} /><path className="line" d={line} />
              {cur && <line className="cross" x1={x(a!)} x2={x(a!)} y1={m.t} y2={m.t + ih} />}
              <circle className="dot" cx={x(a ?? last)} cy={y(pts[a ?? last].rate)} r={5} />
              {a === null && <text className="endlabel" x={x(last) + 10} y={y(pts[last].rate) + 4}>{pts[last].rate}%</text>}
            </svg>
          )}
          <Tip at={cur ? { x: Math.min(W - 150, Math.max(4, x(a!) + 12)), y: Math.max(0, y(cur.rate) - 62) } : null}>
            <b>{cur?.rate}%</b><span>{cur && fmtDay(cur.day, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span>{cur?.attended} of {cur?.marked} present or late</span>
          </Tip>
        </div>
      )}
    </div>
  );
}

/* ---------- Register: class by day, shaded by attendance rate (sequential, one hue) ---------- */
const BINS = ['Below 75%', '75 to 84%', '85 to 89%', '90 to 94%', '95 to 100%'];
const bin = (r: number) => (r < 75 ? 0 : r < 85 ? 1 : r < 90 ? 2 : r < 95 ? 3 : 4);

export function Register({ days, rows, today, onOpen }: { days: string[]; rows: { classId: string; name: string; learners: number; cells: ({ marked: number; attended: number } | null)[] }[]; today: string; onOpen: (id: string) => void }) {
  const [tip, setTip] = useState<{ x: number; y: number; row: string; day: string; c: { marked: number; attended: number } | null } | null>(null);
  const [table, setTable] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  if (!rows.length) return <p className="muted">No classes yet.</p>;
  const show = (e: { currentTarget: HTMLElement }, row: string, day: string, c: { marked: number; attended: number } | null) => {
    const r = e.currentTarget.getBoundingClientRect(), w = wrap.current!.getBoundingClientRect();
    setTip({ x: Math.min(w.width - 170, Math.max(4, r.left - w.left)), y: r.top - w.top - 66, row, day, c });
  };
  return (
    <div className="chart">
      <div className="chart-head"><span className="muted">Each cell is one class on one day. Darker means higher attendance. An empty cell means nothing was recorded.</span><ViewToggle table={table} set={setTable} /></div>
      {table ? (
        <div className="scroll"><table className="table"><thead><tr><th>Class</th>{days.map((d) => <th key={d}>{fmtDay(d)}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.classId}><td>{r.name}</td>{r.cells.map((c, i) => <td key={i}>{c ? `${pct(c.attended, c.marked)}% (${c.attended}/${c.marked})` : '—'}</td>)}</tr>)}</tbody></table></div>
      ) : (
        <div className="reg-wrap" ref={wrap} onPointerLeave={() => setTip(null)}>
          <div className="reg-scroll">
            <div className="reg" style={{ gridTemplateColumns: `minmax(7rem, 11rem) repeat(${days.length}, minmax(1.75rem, 1fr))` }} role="table" aria-label="Attendance rate by class and day">
              <div className="reg-h" role="row"><span role="columnheader" className="reg-corner">Class</span>{days.map((d) => <span key={d} role="columnheader" className={d === today ? 'now' : ''}><small>{fmtDay(d, { weekday: 'narrow' })}</small>{fmtDay(d, { day: 'numeric' })}</span>)}</div>
              {rows.map((r) => (
                <div className="reg-r" role="row" key={r.classId}>
                  <button className="reg-name" role="rowheader" onClick={() => onOpen(r.classId)} title={`Open ${r.name}`}>{r.name}</button>
                  {r.cells.map((c, i) => {
                    const rate = c ? pct(c.attended, c.marked)! : null;
                    const label = c ? `${r.name}, ${fmtDay(days[i])}: ${rate}% present or late, ${c.attended} of ${c.marked}` : `${r.name}, ${fmtDay(days[i])}: no attendance recorded`;
                    return <span key={i} role="cell" tabIndex={0} aria-label={label} className={`cell ${c ? 's' + bin(rate!) : 'none'}`}
                      onPointerEnter={(e) => show(e, r.name, days[i], c)} onFocus={(e) => show(e, r.name, days[i], c)} onBlur={() => setTip(null)} />;
                  })}
                </div>
              ))}
            </div>
          </div>
          <Tip at={tip}>{tip && <><b>{tip.c ? `${pct(tip.c.attended, tip.c.marked)}%` : 'Not recorded'}</b><span>{tip.row}, {fmtDay(tip.day, { weekday: 'short', month: 'short', day: 'numeric' })}</span>{tip.c && <span>{tip.c.attended} of {tip.c.marked} present or late</span>}</>}</Tip>
          <ul className="scale" aria-label="Colour scale">{BINS.map((b, i) => <li key={b}><i className={`cell s${i}`} />{b}</li>)}<li><i className="cell none" />No record</li></ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Tall segmented bar: one whole split into parts ---------- */
export type Part = { key: string; label: string; n: number; css: string; ink?: 'dark' };
export function SegBar({ parts, total, name }: { parts: Part[]; total: number; name: string }) {
  const live = parts.filter((p) => p.n > 0);
  const desc = parts.map((p) => `${p.label} ${p.n}`).join(', ');
  return (
    <div>
      <div className="seg-bar" role="img" aria-label={`${name}: ${desc}`}>
        {total === 0 ? <span className="seg none" /> : live.map((p) => {
          const share = (p.n / total) * 100;
          return <span key={p.key} className={`seg ${p.css}${p.ink ? ' dark-ink' : ''}`} style={{ flexGrow: p.n }} title={`${p.label}: ${p.n} (${Math.round(share)}%)`}>{share >= 8 ? p.n : ''}</span>;
        })}
      </div>
      <ul className="seg-legend">{parts.map((p) => <li key={p.key}><i className={`sw ${p.css}`} />{p.label}</li>)}</ul>
    </div>
  );
}
