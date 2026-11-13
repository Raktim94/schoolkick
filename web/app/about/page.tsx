import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About the project',
  description: 'Who makes SchoolKick, why it is self-hosted and open source, how it is licensed, and where it fits in the NodeDR software family.',
  alternates: { canonical: '/about/' },
};

export default function About() {
  return <main id="main" className="wrap editorial-section">
    <p className="crumbs"><a href="/">Home</a> / About</p>
    <p className="eyebrow">About the project</p>
    <h1>School attendance that keeps its history.</h1>
    <div className="info-prose">
      <p className="lede">SchoolKick is open-source attendance, fee and exam-registration software for schools, colleges and coaching centres. Teachers take the register, families see a simple browser view, and a correction adds to the record instead of erasing what was there.</p>
      <h2>Who makes it</h2>
      <p>SchoolKick is maintained by <a href="https://www.raktimranjit.com/">Raktim Ranjit</a> with contributions from the open-source community, and is part of the <a href="https://www.nodedr.com/software">NodeDR software family</a>. The source is on <a href="https://github.com/Raktim94/schoolkick">GitHub</a>.</p>
      <h2>Why self-hosted</h2>
      <p>Learner records are sensitive. Running SchoolKick on your own server keeps them with the school, and lets the school decide who can reach the server, how long records are kept and how they are backed up. That also makes the school responsible for those things.</p>
      <h2>Licence and cost</h2>
      <p>The software is free and open source under AGPL-3.0-only. Your server, domain, backups and any optional setup help have their own costs. <a href="/license/">Read the licence page</a>.</p>
      <h2>Where it stands</h2>
      <p>This is an early release. It has not had an independent security audit, and several features, such as marks entry, messaging and native apps, are not available yet. See the <a href="/roadmap/">release scope</a> and <a href="/security/">security notes</a> before using real learner data.</p>
      <p><a href="/contact/">Contact the team →</a> · <a href="/contributors/">Contributors →</a> · <a href="/contribute/">Contribute →</a></p>
    </div>
  </main>;
}
