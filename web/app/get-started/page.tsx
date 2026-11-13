import type { Metadata } from 'next';
import CopyCommand from '../copy-command';

export const metadata: Metadata = {
  title: 'Install on Ubuntu, Debian, Docker or CasaOS',
  description: 'Install SchoolKick with one command or follow complete Docker Compose and source setup steps. Default app port: 3847.',
  alternates: { canonical: '/get-started/' },
};
const compose = 'docker compose -f deploy/docker-compose.yml --env-file deploy/.env';
type Before = { needs: string[]; does: string[]; changes: string[] };
type Step = { title: string; text: string; command: string };
type Route = { id: string; n: string; name: string; status: string; desc: string; steps: Step[]; next: string; before?: Before };
const routes: Route[] = [
  {
    id: 'deb', n: '01', name: 'Ubuntu or Debian, one command',
    status: 'Linux · amd64 and arm64 · runs in Docker',
    desc: 'Installs Docker if it is missing, downloads the latest release package, verifies its SHA-256 checksum, installs it and starts SchoolKick and PostgreSQL as a service. The package wraps Docker; it is not a native application.',
    before: { needs: ['Ubuntu or Debian with apt and systemd, on amd64 or arm64', 'sudo (root) access and internet access to GitHub and the Docker registries'], does: ['Installs Docker and the Compose plugin if they are missing', 'Downloads the latest release .deb from GitHub and checks its SHA-256 before installing', 'Installs a systemd service that runs the version-pinned SchoolKick and PostgreSQL containers'], changes: ['Adds the schoolkick systemd service and /etc/schoolkick/schoolkick.env (random database secrets are generated)', 'Stores learner data in a Docker volume on this machine', 'Stops with a message and changes nothing without systemd, root, or a Debian/Ubuntu system'] },
    steps: [
      { title: 'Install and start', text: 'Run as a user with sudo. The first start pulls the container images and can take a few minutes.', command: 'curl -fsSL https://schoolkick.nodedr.com/install-linux.sh | sudo bash' },
      { title: 'Manage the service', text: 'Settings, including the port and database password, live in the env file. Restart after changing it.', command: 'systemctl status schoolkick\nsudoedit /etc/schoolkick/schoolkick.env\nsudo systemctl restart schoolkick' },
    ],
    next: 'Open http://localhost:3847/app/ (the port is HOST_PORT in /etc/schoolkick/schoolkick.env) and choose Create institution. The package listens on this machine only until you set BIND_ADDRESS, so put an HTTPS reverse proxy or tunnel in front of it to reach it from other devices.',
  },
  {
    id: 'casaos', n: '02', name: 'CasaOS or ZimaOS',
    status: 'Custom Install · amd64 and arm64',
    desc: 'Uses the published image, so nothing is built on the box. PostgreSQL is not exposed on any port and its data is kept under /DATA/AppData/schoolkick.',
    steps: [
      { title: 'Import the app', text: 'In CasaOS open App Store, choose Custom Install, then Import, and paste the contents of this file (or download it first).', command: 'curl -fsSL https://raw.githubusercontent.com/Raktim94/schoolkick/main/deploy/docker-compose.casaos.yml' },
      { title: 'Set a database password', text: 'Before you click Install, replace change-this-password in both places with a long random value.', command: 'openssl rand -hex 24' },
    ],
    next: 'Open the SchoolKick tile, or http://YOUR-BOX:3847/app/, and choose Create institution. Set ALLOW_SIGNUP to 0 afterwards.',
  },
  {
    id: 'quick', n: '03', name: 'One-command installation',
    status: 'Current source · Docker required',
    desc: 'For Linux, macOS or Windows through WSL. Install Git, curl, OpenSSL and Docker with Compose v2 first; Docker must be running and accessible to your user.',
    before: { needs: ['git, curl, openssl, and Docker with Compose v2, with Docker running and usable by your user', 'Internet access to GitHub and the Docker registries; no sudo is needed if Docker already works for your user'], does: ['Clones the current main branch of the SchoolKick repository into a new schoolkick folder', 'Generates a random database password and writes deploy/.env (readable only by you)', 'Builds the app image, starts the app and PostgreSQL, waits up to 3 minutes, then checks /readyz'], changes: ['Creates the schoolkick folder, container images, containers and a Docker data volume', 'Binds the app to 127.0.0.1 only, on port 3847 unless you set SCHOOLKICK_PORT', 'Refuses to run, and changes nothing, if a SchoolKick Docker project, data volume or target folder already exists'] },
    steps: [
      { title: 'Install and start', text: 'Run this in the folder where you want SchoolKick. It downloads the current main branch, creates a random database password, builds the app and starts the services. It refuses to overwrite an existing schoolkick folder.', command: 'curl -fsSL https://schoolkick.nodedr.com/install.sh | bash' },
      { title: 'Prefer to read the script first?', text: 'Download and inspect the same installer before running it.', command: 'curl -fsSL https://schoolkick.nodedr.com/install.sh -o install-schoolkick.sh\nless install-schoolkick.sh\nbash install-schoolkick.sh' },
    ],
    next: 'Open http://localhost:3847/app/ on the machine running Docker. This route binds to the local machine by default. For a remote server, configure HTTPS and the public address before inviting people.',
  },
  {
    id: 'docker', n: '04', name: 'Docker Compose, step by step',
    status: 'Linux · macOS · Windows',
    desc: 'Requires Git and Docker with Compose v2. Docker Desktop supplies Compose on Windows and macOS. The database stays in a persistent Docker volume.',
    before: { needs: ['Git and Docker with Compose v2 (Docker Desktop on Windows and macOS)', 'A text editor to set a database password in deploy/.env'], does: ['Builds the app image from the source you cloned and starts the app and PostgreSQL', 'Waits until both are healthy; /readyz then returns {"ok":true}'], changes: ['Creates containers, images and the schoolkick-db Docker volume (your data)', 'Publishes the port set by HTTP_PORT on the address in BIND_ADDRESS (127.0.0.1 in the example)', 'Removing containers keeps the volume; deleting the volume deletes the data'] },
    steps: [
      { title: 'Download the project', text: 'These commands also work in PowerShell, where cp is an alias for Copy-Item.', command: 'git clone https://github.com/Raktim94/schoolkick.git\ncd schoolkick\ncp deploy/.env.example deploy/.env' },
      { title: 'Configure your installation', text: 'Open deploy/.env in your text editor. Replace the password below with a long random value containing letters and numbers. Keep localhost for local use, or set SITE_URL to your HTTPS domain.', command: 'POSTGRES_PASSWORD=replace-with-a-long-random-password\nSITE_URL=http://localhost:3847\nHTTP_PORT=3847\nBIND_ADDRESS=127.0.0.1\nALLOW_SIGNUP=1' },
      { title: 'Build and start', text: 'The first build takes a few minutes. Wait for both the database and app to become healthy.', command: `${compose} up -d --build --wait` },
      { title: 'Check the app', text: 'The readiness check should return {"ok":true}. In Windows PowerShell, use curl.exe instead of curl.', command: `curl http://localhost:3847/readyz\n${compose} ps` },
    ],
    next: 'Open http://localhost:3847/app/ and choose Create institution. After creating your owner account, set ALLOW_SIGNUP=0 in deploy/.env and run the start command again.',
  },
  {
    id: 'source', n: '05', name: 'Run from source',
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
      <p className="lede">Start with one command, or follow each step yourself. Every route opens the app on port 3847. Only the older v0.1.0 Debian package used port 8480.</p>
      <p className="install-meta"><span>Default port 3847</span><span>AGPL-3.0-only</span><span>No cloud account required</span></p>
    </div></section>
    <section className="wrap install-chooser"><p className="eyebrow">Choose your setup</p><h2>A quick start, with the details close by.</h2>
      <div className="install-options">{routes.map(r => <a key={r.id} href={`#${r.id}`}><span>{r.n}</span><b>{r.name}</b><small>{r.status}</small><i aria-hidden="true">↗</i></a>)}</div>
    </section>
    <section className="wrap install-guides">{routes.map(r => <article className="install-guide" id={r.id} key={r.id}>
      <header><span className="guide-number">{r.n}</span><div><p className="eyebrow">{r.status}</p><h2>{r.name}</h2><p>{r.desc}</p></div></header>
      {r.before && <details className="before-run" open><summary>Before you run it</summary><div className="before-grid"><div><h3>You need</h3><ul>{r.before.needs.map(x => <li key={x}>{x}</li>)}</ul></div><div><h3>What it does</h3><ul>{r.before.does.map(x => <li key={x}>{x}</li>)}</ul></div><div><h3>What it changes</h3><ul>{r.before.changes.map(x => <li key={x}>{x}</li>)}</ul></div></div></details>}
      <ol className="install-steps">{r.steps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p><CopyCommand command={step.command} label={step.title} /></li>)}</ol>
      <p className="guide-status"><b>Next:</b> {r.next}</p>
    </article>)}</section>
    <section className="wrap install-guides"><article className="install-guide"><h2>Need a different port?</h2><p>For the quick installer, set SCHOOLKICK_PORT on the first run:</p><CopyCommand label="Quick installer with a different port" command={'curl -fsSL https://schoolkick.nodedr.com/install.sh | SCHOOLKICK_PORT=3848 bash'} /><p>With Compose, change HTTP_PORT and SITE_URL in deploy/.env, then run the start command again. Existing installations keep their configured port.</p><h3>Already installed through the Debian package?</h3><p>Packages up to v0.1.0 used port 8480, and from 0.3.0 the package uses 3847 and listens on this machine only. Settings are in /etc/schoolkick/schoolkick.env; running the installer again installs the latest package, and an existing settings file keeps its current port. The quick installer above builds current source; it does not upgrade or move an existing package installation.</p></article></section>
    <section className="wrap install-guides"><article className="install-guide" id="tested"><h2>What has been tested</h2>
      <p>Run on 12 November 2026 against SchoolKick source commit 8a884a9 and the published v0.1.0 release, on Debian 13 (x86-64) with Docker 29.9.2, in throwaway containers with synthetic data only. Passing one route does not mean every platform works.</p>
      <div className="info-table-wrap"><table className="info-table">
        <caption className="sr-only">Installation routes and what was verified</caption>
        <thead><tr><th scope="col">Route</th><th scope="col">Result</th></tr></thead>
        <tbody>
          <tr><th scope="row">04 Docker Compose, from current source</th><td>Tested end to end: build, health check, first launch, institution created, class and learner saved, restart, re-run, port conflict refused, default removal kept the data, explicit purge removed it.</td></tr>
          <tr><th scope="row">01 Ubuntu or Debian package (v0.1.0)</th><td>Inspected, not fully installed: amd64 and arm64 checksums match, the package wraps Docker and pins the 0.1.0 image (both architectures exist), and the installer stops safely without systemd, without root, or on a non-Debian system. The package’s own install, re-install, remove and purge scripts were run in a throwaway container: the settings file was created with owner-only permissions, re-installing left it unchanged, and removal and purge both keep it. Starting the service needs systemd, so a full install on a systemd host was not run.</td></tr>
          <tr><th scope="row">03 One-command installation</th><td>Prerequisite check verified (stops with “Install git first”). The full script could not be run on the test host, which already has a SchoolKick project (the script refuses to run in that case, by design); its steps match route 04, which was run in full.</td></tr>
          <tr><th scope="row">02 CasaOS or ZimaOS, 05 Run from source</th><td>Not tested.</td></tr>
          <tr><th scope="row">macOS, Windows, arm64</th><td>Not tested. No such environment was available; the test host has no arm64 emulation.</td></tr>
        </tbody>
      </table></div>
    </article></section>
    <section className="install-next"><div className="wrap"><p className="eyebrow">After the first sign-in</p><h2>Make the first register useful.</h2><ol><li>Create your school and owner account.</li><li>Create classes, teacher accounts and guardian accounts.</li><li>Add learners, enrol them and link their guardians.</li><li>Take attendance and check the family view.</li></ol><a className="btn" href="/docs/">Open the documentation</a></div></section>
    <section className="wrap install-safety"><p className="eyebrow">Before inviting your school</p><h2>Set up HTTPS and backups.</h2><p>Set SITE_URL to your public HTTPS address. Keep the local binding when a reverse proxy or tunnel runs on the same host. Set ALLOW_SIGNUP=0 once your school exists and restart the app.</p><div><a href="/security/">Security notes</a><a href="/privacy/">Privacy notice</a><a href="/self-hosting/">Hosting and backups</a></div></section>
  </main>;
}
