import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
import type { Me } from './api';
import { Link } from './router';
import { Empty, fmtTime, Loading, Meter, PageHead, Status, useAction, useApi } from './ui';

const Field = ({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => <label>{label}<input {...p} /></label>;
const val = (f: FormEvent, n: string) => ((f.currentTarget as HTMLFormElement).elements.namedItem(n) as HTMLInputElement).value;

export function Classes() {
  const classes = useApi<{ classes: { id: string; name: string; learners: number; markedToday: number; teachers: string[] }[] }>('/classes');
  const users = useApi<{ users: { id: string; name: string; email: string; roles: string[] }[] }>('/users');
  const learners = useApi<{ learners: { id: string; name: string }[] }>('/learners');
  const act = useAction();
  const create = (e: FormEvent) => { e.preventDefault(); const f = e.currentTarget as HTMLFormElement; act.run(async () => { await api('POST', '/classes', { name: val(e, 'name') }); f.reset(); classes.reload(); return 'Class created.'; }); };
  const link = (e: FormEvent, id: string, path: 'teachers' | 'enrollments', field: 'userId' | 'learnerId') => {
    e.preventDefault();
    act.run(async () => { await api('POST', `/classes/${id}/${path}`, { [field]: val(e, 'pick') }); classes.reload(); return path === 'teachers' ? 'Teacher assigned.' : 'Learner enrolled.'; });
  };
  const teachers = users.data?.users.filter((u) => u.roles.includes('teacher')) ?? [];
  return (
    <>
      <PageHead title="Classes" sub="Create classes, assign teachers and enrol learners." />
      <form className="row" onSubmit={create}><Field label="New class name" name="name" required maxLength={120} /><button className="btn" disabled={act.busy}>Create class</button></form>
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      {classes.loading ? <Loading /> : !classes.data?.classes.length ? <Empty title="No classes yet" hint="Create a class, then assign a teacher and enrol learners." /> : (
        <ul className="cards wide">
          {classes.data.classes.map((c) => (
            <li key={c.id} className="card static">
              <b>{c.name}</b>
              <span className="muted">{c.learners} learner{c.learners === 1 ? '' : 's'}. Teachers: {c.teachers.join(', ') || 'none yet'}</span>
              <Meter value={c.markedToday} max={c.learners} label={`${c.name} attendance today`} />
              <Link className="link" to={`/classes/${c.id}`}>Attendance today: {c.markedToday} of {c.learners} marked</Link>
              <form className="row" onSubmit={(e) => link(e, c.id, 'teachers', 'userId')}>
                <label>Assign teacher<select name="pick" required defaultValue=""><option value="" disabled>Choose…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                <button className="btn secondary">Assign</button>
              </form>
              <form className="row" onSubmit={(e) => link(e, c.id, 'enrollments', 'learnerId')}>
                <label>Enrol learner<select name="pick" required defaultValue=""><option value="" disabled>Choose…</option>{learners.data?.learners.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
                <button className="btn secondary">Enrol</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type Issue = { row: number; field: string; message: string };
type Preview = { rows: number; issues: Issue[]; imported: number; dryRun: boolean };

export function Learners() {
  const { data, loading, reload } = useApi<{ learners: { id: string; name: string; external_id: string | null; guardians: string[] }[] }>('/learners');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const act = useAction();
  const add = (e: FormEvent) => { e.preventDefault(); const f = e.currentTarget as HTMLFormElement; act.run(async () => { await api('POST', '/learners', { name: val(e, 'name'), externalId: val(e, 'ext') || undefined }); f.reset(); reload(); return 'Learner added.'; }); };
  const post = (dry: boolean) => act.run(async () => {
    const r = await api<Preview>('POST', `/learners/import?dryRun=${dry ? 1 : 0}`, csv, 'text/csv');
    setPreview(r);
    if (!dry && r.imported) { setCsv(''); setPreview(null); reload(); return `Imported ${r.imported} learners.`; }
    return dry ? (r.issues.length ? '' : `Checked ${r.rows} rows. No problems found.`) : '';
  });
  return (
    <>
      <PageHead title="Learners" sub="Add learners one at a time or import a CSV." />
      <form className="row" onSubmit={add}><Field label="Name" name="name" required maxLength={120} /><Field label="Student ID (optional)" name="ext" maxLength={64} /><button className="btn" disabled={act.busy}>Add learner</button></form>
      <details className="import">
        <summary>Import from CSV</summary>
        <p className="muted">Columns: <code>name</code> (required), <code>external_id</code>, <code>guardian_email</code> (must already have a guardian account). Check first. Nothing is saved until every row is clean.</p>
        <input type="file" accept=".csv,text/csv" aria-label="Choose a CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setPreview(null); } }} />
        <textarea aria-label="CSV contents" rows={5} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} placeholder={'name,external_id,guardian_email\nAsha Rao,A-1,parent@example.com'} />
        <div className="row"><button className="btn secondary" disabled={!csv || act.busy} onClick={() => post(true)}>Check file</button><button className="btn" disabled={!csv || act.busy || !preview || preview.issues.length > 0} onClick={() => post(false)}>Import {preview?.rows ?? ''} rows</button></div>
        {preview && preview.issues.length > 0 && (
          <table className="table"><caption>{preview.issues.length} problem{preview.issues.length === 1 ? '' : 's'} to fix before importing</caption><thead><tr><th>Row</th><th>Column</th><th>Problem</th></tr></thead>
            <tbody>{preview.issues.map((i, k) => <tr key={k}><td>{i.row}</td><td>{i.field}</td><td>{i.message}</td></tr>)}</tbody></table>
        )}
      </details>
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      {loading ? <Loading /> : !data?.learners.length ? <Empty title="No learners yet" hint="Add one above or import a CSV." /> : (
        <table className="table"><thead><tr><th>Name</th><th>Student ID</th><th>Guardians</th></tr></thead>
          <tbody>{data.learners.map((l) => <tr key={l.id}><td>{l.name}</td><td>{l.external_id ?? '—'}</td><td>{l.guardians.join(', ') || '—'}</td></tr>)}</tbody></table>
      )}
    </>
  );
}

export function People({ canAdd }: { canAdd: boolean }) {
  const { data, loading, reload } = useApi<{ users: { id: string; name: string; email: string; roles: string[] }[] }>('/users');
  const learners = useApi<{ learners: { id: string; name: string }[] }>('/learners');
  const act = useAction();
  const add = (e: FormEvent) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    act.run(async () => { await api('POST', '/users', { name: val(e, 'name'), email: val(e, 'email'), password: val(e, 'pw'), roles: [val(e, 'role')] }); f.reset(); reload(); return 'Account created. Share the temporary password privately.'; });
  };
  const link = (e: FormEvent) => { e.preventDefault(); act.run(async () => { await api('POST', `/learners/${val(e, 'learner')}/guardians`, { email: val(e, 'gemail') }); return 'Guardian linked to learner.'; }); };
  return (
    <>
      <PageHead title="People" sub="Staff and guardian accounts, and which guardian belongs to which learner." />
      {canAdd && (
        <form className="row" onSubmit={add}>
          <Field label="Name" name="name" required /><Field label="Email" name="email" type="email" required />
          <Field label="Temporary password (10+ characters)" name="pw" type="password" minLength={10} required autoComplete="new-password" />
          <label>Role<select name="role" defaultValue="teacher"><option value="teacher">Teacher</option><option value="guardian">Parent or guardian</option><option value="registrar">Registrar</option><option value="finance">Finance</option></select></label>
          <button className="btn" disabled={act.busy}>Create account</button>
        </form>
      )}
      <form className="row" onSubmit={link}>
        <label>Learner<select name="learner" required defaultValue=""><option value="" disabled>Choose…</option>{learners.data?.learners.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <Field label="Guardian’s account email" name="gemail" type="email" required /><button className="btn secondary" disabled={act.busy}>Link guardian</button>
      </form>
      {act.msg && <Status kind={act.msg.kind}>{act.msg.text}</Status>}
      {loading ? <Loading /> : (
        <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Roles</th></tr></thead>
          <tbody>{data?.users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.roles.join(', ')}</td></tr>)}</tbody></table>
      )}
    </>
  );
}

export function Audit() {
  const { data, loading } = useApi<{ events: { id: number; action: string; actor: string | null; at: string; meta: Record<string, unknown> }[] }>('/audit');
  return (
    <>
      <PageHead title="Audit log" sub="The latest 200 events. Entries cannot be edited or deleted." />
      {loading ? <Loading /> : (
        <table className="table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>{data?.events.map((e) => <tr key={e.id}><td>{fmtTime(e.at)}</td><td>{e.actor ?? 'System'}</td><td>{e.action}</td><td>{Object.keys(e.meta).length ? JSON.stringify(e.meta) : '—'}</td></tr>)}</tbody></table>
      )}
    </>
  );
}
