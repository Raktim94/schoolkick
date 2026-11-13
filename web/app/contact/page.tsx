import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact and support',
  description: 'Ask a setup question, report a bug, send a security report or reach the NodeDR team about SchoolKick.',
  alternates: { canonical: '/contact/' },
};

export default function Contact() {
  return <main id="main" className="wrap editorial-section">
    <p className="crumbs"><a href="/">Home</a> / Contact</p>
    <p className="eyebrow">Contact and support</p>
    <h1>Get help with SchoolKick.</h1>
    <p className="lede info-prose">Pick the route that matches your question. Please do not send learner names, guardian details or other real school records when asking for help.</p>
    <div className="info-cards">
      <article><h2>Setup or usage question</h2><p>Start with the <a href="/get-started/">install guide</a>, the <a href="/docs/">documentation</a> and the <a href="/faq/">FAQ</a>.</p></article>
      <article><h2>Bug or feature request</h2><p>Open an issue on <a href="https://github.com/Raktim94/schoolkick/issues">GitHub</a>. Include the version, how you installed it and the steps to reproduce.</p></article>
      <article><h2>Security report</h2><p>Follow the <a href="/security/">security notes</a> and report privately. Do not post vulnerabilities in public issues.</p></article>
      <article><h2>Talk to NodeDR</h2><p>For deployment help or custom work, email <a href="mailto:info@nodedr.com">info@nodedr.com</a> or use the <a href="https://www.nodedr.com/contactus">NodeDR contact page</a>.</p></article>
    </div>
  </main>;
}
