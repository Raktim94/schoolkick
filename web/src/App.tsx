import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api } from './api';
import type { Me, Role } from './api';
import { Audit, Classes, Learners, People } from './Admin';
import { Attendance, Today } from './Attendance';
import { GuardianExams, HallTicket, StaffExams } from './Exams';
import { Checkout, GuardianFees, Receipt, Reconciliation, Refunds, StaffFees } from './Fees';
import { Guardian } from './Guardian';
import { Overview } from './Overview';
import { Link, navigate, usePath } from './router';
import { Empty, Loading, Status, useAction, useTheme } from './ui';
import type { Theme } from './ui';

const Logo = ({ size = 28 }: { size?: number }) => <img className="app-mark" src="/app/icon-192.png" width={size} height={size} alt="" />;
const ICONS: Record<string, string> = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  classes: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm2 14h13M8 7h7',
  learners: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m3 15a5 5 0 0 0-3-4.6',
  audit: 'M6 3h9l4 4v14H6V3Zm8 0v5h5M9 13h7M9 17h7',
  fees: 'M3 7h18v12H3V7Zm0 4h18M7 15h4M7 3l-.01 4M17 3v4',
  recon: 'M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5',
  exams: 'M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12h7M9 16h5',
  refunds: 'M4 8h13a3 3 0 0 1 0 6H8m-4-6 3-3M4 8l3 3M20 18H7',
  today: 'M5 5h14v15H5V5Zm0 5h14M9 3v4m6-4v4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};
const Icon = ({ name }: { name: string }) => <svg className="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = () => api<{ me: Me | null }>('GET', '/session').then((r) => setMe(r.me), () => setMe(null));
  useEffect(() => { refresh(); }, []);
  useTheme();
  if (me === undefined) return <main className="center"><Loading /></main>;
  return me ? <Shell me={me} onSignOut={() => { setMe(null); navigate('/', true); }} /> : <Auth onAuthed={refresh} />;
}

const ROLE_LABEL: Record<Role, string> = { owner: 'Administrator', registrar: 'Registrar', teacher: 'Teacher', finance: 'Finance', guardian: 'Parent or guardian' };
const ORDER: Role[] = ['owner', 'registrar', 'teacher', 'guardian', 'finance'];
type Item = { to: string; label: string; icon: string };

function navFor(role: Role): Item[] {
  if (role === 'owner' || role === 'registrar') return [
    { to: '/', label: 'Overview', icon: 'overview' }, { to: '/classes', label: 'Classes', icon: 'classes' }, { to: '/learners', label: 'Learners', icon: 'learners' },
    { to: '/fees', label: 'Fees', icon: 'fees' }, { to: '/exams', label: 'Exams', icon: 'exams' }, { to: '/people', label: 'People', icon: 'people' },
    ...(role === 'owner' ? [{ to: '/reconciliation', label: 'Reconcile', icon: 'recon' }, { to: '/refunds', label: 'Refunds', icon: 'refunds' }, { to: '/audit', label: 'Audit log', icon: 'audit' }] : []),
  ];
  if (role === 'finance') return [{ to: '/', label: 'Fees', icon: 'fees' }, { to: '/reconciliation', label: 'Reconcile', icon: 'recon' }, { to: '/refunds', label: 'Refunds', icon: 'refunds' }];
  if (role === 'guardian') return [{ to: '/', label: 'Today', icon: 'today' }, { to: '/fees', label: 'Fees', icon: 'fees' }, { to: '/exams', label: 'Exams', icon: 'exams' }];
  return [{ to: '/', label: 'Today', icon: 'today' }];
}

function Shell({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const roles = ORDER.filter((r) => me.roles.includes(r));
  const [active, setActive] = useState<Role>(() => { try { const s = localStorage.getItem('schoolkick:role') as Role; return roles.includes(s) ? s : roles[0]; } catch { return roles[0]; } });
  const [theme, setTheme] = useTheme();
  const path = usePath();
  const items = navFor(active);
  const moreActive = items.slice(3).some((i) => i.to === '/' ? path === '/' : path.startsWith(i.to));
  const out = async () => { await api('POST', '/auth/logout').catch(() => {}); onSignOut(); };
  const switchRole = (r: Role) => { setActive(r); try { localStorage.setItem('schoolkick:role', r); } catch { /* ignore */ } navigate('/'); };
  const hallId = /^\/hall-ticket\/([0-9a-f-]{36})$/.exec(path)?.[1];
  const payId = /^\/pay\/([0-9a-f-]{36})$/.exec(path)?.[1];
  const receiptId = /^\/receipts\/([0-9a-f-]{36})$/.exec(path)?.[1];
  const classId = /^\/classes\/([0-9a-f-]{36})$/.exec(path)?.[1];

  let page: ReactNode, title = 'Not found';
  const staff = active === 'owner' || active === 'registrar';
  if (path === '/') {
    page = staff ? <Overview canAudit={active === 'owner'} /> : active === 'teacher' ? <Today /> : active === 'guardian' ? <Guardian /> : <StaffFees canEdit currency={me.currency} />;
    title = items[0].label;
  } else if (path === '/fees' && active === 'guardian') { page = <GuardianFees />; title = 'Fees'; }
  else if (path === '/fees' && staff) { page = <StaffFees canEdit={active === 'owner'} currency={me.currency} />; title = 'Fees'; }
  else if (path === '/exams' && active === 'guardian') { page = <GuardianExams />; title = 'Exams'; }
  else if (path === '/exams' && staff) { page = <StaffExams currency={me.currency} />; title = 'Exams'; }
  else if (path === '/refunds' && (active === 'owner' || active === 'finance')) { page = <Refunds canDecide={active === 'owner'} />; title = 'Refunds'; }
  else if (hallId && active === 'guardian') { page = <HallTicket key={hallId} id={hallId} />; title = 'Hall ticket'; }
  else if (path === '/reconciliation' && (active === 'owner' || active === 'finance')) { page = <Reconciliation />; title = 'Reconciliation'; }
  else if (payId && active === 'guardian') { page = <Checkout key={payId} id={payId} />; title = 'Payment'; }
  else if (receiptId && active !== 'teacher') { page = <Receipt key={receiptId} id={receiptId} />; title = 'Receipt'; }
  else if (classId && (staff || active === 'teacher')) { page = <Attendance key={classId} classId={classId} back={staff ? '/classes' : '/'} />; title = 'Attendance'; }
  else if (staff && path === '/classes') { page = <Classes />; title = 'Classes'; }
  else if (staff && path === '/learners') { page = <Learners />; title = 'Learners'; }
  else if (staff && path === '/people') { page = <People canAdd={active === 'owner'} />; title = 'People'; }
  else if (active === 'owner' && path === '/audit') { page = <Audit />; title = 'Audit log'; }
  else page = <Empty title="This page does not exist" hint="Use the menu to find what you need."><p><Link className="btn" to="/">Go to the start</Link></p></Empty>;
  useEffect(() => { document.title = `${title} | ${me.institution}`; }, [title, me.institution]);

  const account = (
    <div className="account">
      {roles.length > 1 && <label>Viewing as<select value={active} onChange={(e) => switchRole(e.target.value as Role)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>}
      <label>Theme<select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}><option value="auto">Match system</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <p className="who"><b>{me.name}</b><span className="muted">{ROLE_LABEL[active]}</span></p>
      <button className="btn secondary" onClick={out}>Sign out</button>
    </div>
  );
  const links = (cls: string, list = items) => list.map((i) => {
    const on = i.to === '/' ? path === '/' : path.startsWith(i.to);
    return <li key={i.to}><Link to={i.to} className={cls} aria-current={on ? 'page' : undefined}><Icon name={i.icon} />{i.label}</Link></li>;
  });

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side">
        <p className="inst"><Logo /><b>{me.institution}</b></p>
        <nav aria-label="Main"><ul className="nav">{links('nav-link')}</ul></nav>
        {account}
      </aside>
      <header className="mtop">
        <span className="inst"><Logo size={24} /><b>{me.institution}</b></span>
        <details className="menu"><summary>Account</summary>{account}</details>
      </header>
      <main id="main" tabIndex={-1}>{page}</main>
      <nav className="tabbar" aria-label="Main"><ul>
        {links('tab', items.slice(0, 3))}
        {items.length > 3 && <li className="more-item"><details className="more-nav" key={path}>
          <summary className={`tab${moreActive ? ' more-active' : ''}`} aria-label="More pages" aria-current={moreActive ? 'page' : undefined}><Icon name="more" /><span>More</span></summary>
          <ul aria-label="More pages">{links('more-link', items.slice(3))}</ul>
        </details></li>}
      </ul></nav>
    </div>
  );
}

function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const act = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const g = (n: string) => ((e.currentTarget as HTMLFormElement).elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
    act.run(async () => {
      if (mode === 'signin') await api('POST', '/auth/login', { email: g('email'), password: g('password') });
      else await api('POST', '/tenants', { institution: g('institution'), name: g('name'), email: g('email'), password: g('password'), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      onAuthed();
    });
  };
  return (
    <main className="auth" id="main">
      <p className="inst"><Logo /><b>SchoolKick</b></p>
      <form className="auth-card" onSubmit={submit} aria-labelledby="auth-h">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); act.clear(); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'on' : ''} onClick={() => { setMode('create'); act.clear(); }}>Create institution</button>
        </div>
        <h1 id="auth-h">{mode === 'signin' ? 'Sign in' : 'Set up your institution'}</h1>
        {mode === 'create' && <><label>Institution name<input name="institution" required minLength={2} maxLength={120} autoComplete="organization" /></label><label>Your name<input name="name" required minLength={2} autoComplete="name" /></label></>}
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password{mode === 'create' && ' (at least 10 characters)'}<input name="password" type="password" required minLength={mode === 'create' ? 10 : 1} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} /></label>
        {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
        <button className="btn" disabled={act.busy}>{act.busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create institution'}</button>
      </form>
      <p className="muted"><a href="/">About SchoolKick</a> · <a href="/docs">Documentation</a> · <a href="/license">AGPL-3.0</a></p>
      <p className="muted">Early release: review the security notes and your local privacy rules before using real learner data.</p>
    </main>
  );
}
