import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';

const BASE = '/app';
const strip = (p: string) => (p.startsWith(BASE) ? p.slice(BASE.length) : p) || '/';

/** Path inside the app, e.g. "/classes/abc". Real URLs (History API) so every screen is linkable. */
export function usePath(): string {
  const [path, setPath] = useState(() => strip(location.pathname));
  useEffect(() => {
    const on = () => setPath(strip(location.pathname));
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  return path.replace(/\/$/, '') || '/';
}

export function navigate(to: string, replace = false) {
  history[replace ? 'replaceState' : 'pushState'](null, '', BASE + (to === '/' ? '' : to));
  dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
  document.getElementById('main')?.focus({ preventScroll: true });
}

export function Link({ to, onClick, ...rest }: { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a {...rest} href={BASE + (to === '/' ? '' : to)} onClick={go} />;
}
