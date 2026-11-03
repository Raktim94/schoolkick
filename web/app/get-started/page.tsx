import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Install SchoolKick on port 3847',
  description: 'Install SchoolKick with one command or follow complete Docker Compose and source setup steps. Default app port: 3847.',
  alternates: { canonical: '/get-started/' },
};
const compose = 'docker compose -f deploy/docker-compose.yml --env-file deploy/.env';
const routes = [
  {
    id: 'quick', n: '01', name: 'One-command installation',
    status: 'Current source · Docker required',
    desc: 'For Linux, macOS or Windows through WSL. Install Git, curl, OpenSSL and Docker with Compose v2 first; Docker must be running and accessible to your user.',
    steps: [
      { title: 'Install and start', text: 'Run this in the folder where you want SchoolKick. It downloads the current main branch, creates a random database password, builds the app and starts the services. It refuses to overwrite an existing schoolkick folder.', command: 'curl -fsSL https://schoolkick.nodedr.com/install.sh | bash' },
      { title: 'Prefer to read the script first?', text: 'Download and inspect the same installer before running it.', command: 'curl -fsSL https://schoolkick.nodedr.com/install.sh -o install-schoolkick.sh\nless install-schoolkick.sh\nbash install-schoolkick.sh' },
    ],
    next: 'Open http://localhost:3847/app/ on the machine running Docker. This route binds to the local machine by default. For a remote server, configure HTTPS and the public address before inviting people.',
  },
  {
    id: 'docker', n: '02', name: 'Docker Compose, step by step',
    status: 'Linux · macOS · Windows',
    desc: 'Requires Git and Docker with Compose v2. Docker Desktop supplies Compose on Windows and macOS. The database stays in a persistent Docker volume.',
    steps: [
      { title: 'Download the project', text: 'These commands also work in PowerShell, where cp is an alias for Copy-Item.', command: 'git clone https://github.com/Raktim94/schoolkick.git\ncd schoolkick\ncp deploy/.env.example deploy/.env' },
      { title: 'Configure your installation', text: 'Open deploy/.env in your text editor. Replace the password below with a long random value containing letters and numbers. Keep localhost for local use, or set SITE_URL to your HTTPS domain.', command: 'POSTGRES_PASSWORD=replace-with-a-long-random-password\nSITE_URL=http://localhost:3847\nHTTP_PORT=3847\nBIND_ADDRESS=127.0.0.1\nALLOW_SIGNUP=1' },
      { title: 'Build and start', text: 'The first build takes a few minutes. Wait for both the database and app to become healthy.', command: `${compose} up -d --build --wait` },
      { title: 'Check the app', text: 'The readiness check should return {"ok":true}. In Windows PowerShell, use curl.exe instead of curl.', command: `curl http://localhost:3847/readyz\n${compose} ps` },
    ],
    next: 'Open http://localhost:3847/app/ and choose Create institution. After creating your owner account, set ALLOW_SIGNUP=0 in deploy/.env and run the start command again.',
  },
  {
    id: 'source', n: '03', name: 'Run from source',
    status: 'Developer route · Node.js 22.18+ · PostgreSQL 16',
    desc: 'The commands below use Bash and a local PostgreSQL installation on Ubuntu or Debian. PostgreSQL must be running; the account needs database ownership and permission to create the restricted application role.',
    steps: [
      { title: 'Download and build', text: 'Install Node.js, npm, Git and PostgreSQL before continuing.', command: 'git clone https://github.com/Raktim94/schoolkick.git\ncd schoolkick\nnpm ci\nnpm run build' },
      { title: 'Create the database account', text: 'Enter a new strong password when prompted. Use the same password in DATABASE_URL below; URL-encode any reserved characters. Run these commands once for a fresh installation.', command: 'sudo -u postgres createuser --pwprompt --createrole schoolkick\nsudo -u postgres createdb --owner=schoolkick schoolkick' },
      { title: 'Start the server', text: 'Replace YOUR_DATABASE_PASSWORD before running. Database migrations run automatically. Keep this terminal open while using the app.', command: "DATABASE_URL='postgres://schoolkick:YOUR_DATABASE_PASSWORD@127.0.0.1:5432/schoolkick' PORT=3847 SITE_URL='http://localhost:3847' npm start" },
      { title: 'Check readiness in another terminal', text: 'A successful response is {"ok":true}.', command: 'curl http://localhost:3847/readyz' },
    ],
    next: 'Open http://localhost:3847/app/ and create the school owner. For a long-running server, configure a process manager, HTTPS and backups.',
  },
];

export default function Install() {
  return <main id="main" className="install-page">
    <section className="install-hero"><div className="wrap">
      <p className="crumbs"><a href="/">Home</a> / Install</p>
      <p className="eyebrow">Your server · your school · your records</p>
      <h1>Install SchoolKick.<br />Open your first register.</h1>
      <p className="lede">Start with one command, or follow each step yourself. Every route below opens the app on port 3847.</p>
      <p className="install-meta"><span>Default port 3847</span><span>AGPL-3.0-only</span><span>No cloud account required</span></p>
    </div></section>
    <section className="wrap install-chooser"><p className="eyebrow">Choose your setup</p><h2>A quick start, with the details close by.</h2>
      <div className="install-options">{routes.map(r => <a key={r.id} href={`#${r.id}`}><span>{r.n}</span><b>{r.name}</b><small>{r.status}</small><i aria-hidden="true">↗</i></a>)}</div>
    </section>
    <section className="wrap install-guides">{routes.map(r => <article className="install-guide" id={r.id} key={r.id}>
      <header><span className="guide-number">{r.n}</span><div><p className="eyebrow">{r.status}</p><h2>{r.name}</h2><p>{r.desc}</p></div></header>
      <ol className="install-steps">{r.steps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p><div className="install-command"><pre><code>{step.command}</code></pre></div></li>)}</ol>
      <p className="guide-status"><b>Next:</b> {r.next}</p>
    </article>)}</section>
    <section className="wrap install-guides"><article className="install-guide"><h2>Need a different port?</h2><p>For the quick installer, set SCHOOLKICK_PORT on the first run:</p><div className="install-command"><pre><code>{'curl -fsSL https://schoolkick.nodedr.com/install.sh | SCHOOLKICK_PORT=3848 bash'}</code></pre></div><p>With Compose, change HTTP_PORT and SITE_URL in deploy/.env, then run the start command again. Existing installations keep their configured port.</p><h3>Already installed through the Debian package?</h3><p>The currently published v0.1.0 package uses port 8480. Its settings are in /etc/schoolkick/schoolkick.env. The quick installer above builds current source; it does not upgrade or move an existing package installation.</p></article></section>
    <section className="install-next"><div className="wrap"><p className="eyebrow">After the first sign-in</p><h2>Make the first register useful.</h2><ol><li>Create your school and owner account.</li><li>Create classes, teacher accounts and guardian accounts.</li><li>Add learners, enrol them and link their guardians.</li><li>Take attendance and check the family view.</li></ol><a className="btn" href="/docs/">Open the documentation</a></div></section>
    <section className="wrap install-safety"><p className="eyebrow">Before inviting your school</p><h2>Set up HTTPS and backups.</h2><p>Set SITE_URL to your public HTTPS address. Keep the local binding when a reverse proxy or tunnel runs on the same host. Set ALLOW_SIGNUP=0 once your school exists and restart the app.</p><div><a href="/security/">Security notes</a><a href="/privacy/">Privacy notice</a><a href="/self-hosting/">Hosting and backups</a></div></section>
  </main>;
}
