import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { Skeleton } from '@/components/base/skeleton/skeleton';

/** Load JSON from the API. While a new request runs the previous data stays on screen (no layout jump). */
export function useApi<T>(path: string | null) {
  const [state, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!path });
  const load = useCallback(() => {
    if (!path) return;
    set((s) => ({ ...s, loading: true }));
    api<T>('GET', path).then((data) => set({ data, loading: false }), (e) => set((s) => ({ data: s.data, error: e.message, loading: false })));
  }, [path]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

export const Status = ({ kind, children }: { kind: 'ok' | 'error' | 'info'; children: ReactNode }) => (
  <p className={`status ${kind}`} role={kind === 'error' ? 'alert' : 'status'}><b>{kind === 'ok' ? 'Done. ' : kind === 'error' ? 'Problem. ' : ''}</b>{children}</p>
);
export const Empty = ({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) => (
  <div className="empty"><b>{title}</b>{hint && <p>{hint}</p>}{children}</div>
);
export const Loading = () => (
  <div role="status" aria-live="polite" className="grid gap-3 max-w-xl"><span className="sr">Loading…</span>
    <Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
);
export const PageHead = ({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{children && <div className="page-actions">{children}</div>}</div>
);
export const Meter = ({ value, max, label }: { value: number; max: number; label: string }) => (
  <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}><i style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} /></div>
);

/** Submit helper: runs fn, tracks busy and a result message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const t = await fn();
      if (t) setMsg({ kind: 'ok', text: t });
      return true;
    } catch (e: any) {
      setMsg({ kind: 'error', text: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run, clear: () => setMsg(null) };
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export type Theme = 'auto' | 'light' | 'dark';
export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState<Theme>(() => { try { return (localStorage.getItem('schoolkick:theme') as Theme) || 'auto'; } catch { return 'auto'; } });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = t === 'dark' || (t === 'auto' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
    };
    apply();
    try { localStorage.setItem('schoolkick:theme', t); } catch { /* storage unavailable */ }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [t]);
  return [t, setT];
}
