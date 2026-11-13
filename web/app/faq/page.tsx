import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: 'Twelve plain answers about SchoolKick: cost, where data lives, installing, ports, signup, attendance corrections, UPI fees, security and what is not built yet.',
  alternates: { canonical: '/faq/' },
};

// Single source: the visible questions and the FAQPage JSON-LD are both generated from this list, so they cannot drift apart.
const faqs: [string, string][] = [
 [
  "Is SchoolKick really free?",
  "Yes. The software is free and open source under AGPL-3.0-only, with no per-student or per-teacher fee. You pay only for the server it runs on and for any optional help you choose to buy. Source and licence are on GitHub."
 ],
 [
  "Who owns the school's data, and where is it stored?",
  "The school does. SchoolKick runs on a server you control and keeps all records in your own PostgreSQL database, in a Docker volume on that machine. Nothing is sent to NodeDR, and the marketing site loads no analytics or third-party scripts."
 ],
 [
  "What does it cost to run?",
  "It needs a small Linux, Windows or macOS machine that can run Docker, or a Node.js and PostgreSQL setup. For the Ubuntu or Debian package, one command installs Docker if it is missing, then starts the app and its database as a service."
 ],
 [
  "How do I install it?",
  "On Ubuntu or Debian run the one-line installer from the install page. It checks the package's SHA-256 checksum before installing. Docker Compose, CasaOS and a plain Node.js setup are also documented, each with the commands and what they change."
 ],
 [
  "Which port does it use, and who can reach it?",
  "The Docker, source and current Debian package installs serve the app on port 3847 and listen on this machine only (127.0.0.1) by default. Put an HTTPS reverse proxy or tunnel in front of it, or set BIND_ADDRESS to expose it deliberately. Debian packages published as v0.1.0 used port 8480."
 ],
 [
  "Can anyone sign up and create a school on my server?",
  "On a fresh install, yes: the first visit creates your institution and owner account. After that, set ALLOW_SIGNUP to 0 and restart so strangers cannot create institutions. Staff and guardians are invited from inside the school."
 ],
 [
  "What happens when a teacher corrects attendance?",
  "The original mark is kept. A correction is a new entry with a required reason, written to an append-only history, so the register shows who changed what and when instead of silently overwriting it."
 ],
 [
  "Do families need an app?",
  "No. Guardians use a normal web browser on a phone or computer and see only the learners linked to them. There is no native mobile app yet."
 ],
 [
  "Does it handle fees and UPI payments?",
  "It issues fee invoices, records cash and UPI QR payments, and produces receipts with a verification page and PDF. A member of the school office confirms each payment against bank evidence; SchoolKick does not move money. Hosted checkout currently supports a test provider only, with no real card or bank adapter."
 ],
 [
  "How do I move from a spreadsheet?",
  "Upload a CSV of learners and guardians. SchoolKick validates it in a dry run and shows the result row by row before anything is saved, so you can fix errors first."
 ],
 [
  "Is it secure? Has it been audited?",
  "Access is role-checked and data is separated with PostgreSQL row-level security. No independent security, accessibility or legal audit has been done, and the early release says so. Back up your data and read the security notes before holding real records."
 ],
 [
  "What is not built yet?",
  "Card or bank payment processing, marks entry and result release, messaging, a timetable, password reset by email, teacher QR check-in, learning content and native mobile apps. The roadmap page tracks what is available now and what is planned."
 ]
];

export default function Faq() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })),
  };
  return (
    <main id="main" className="wrap policy-page">
      <p className="crumbs"><a href="/">Home</a> / FAQ</p>
      <p className="eyebrow">Before you try it</p>
      <h1>Questions before you try SchoolKick.</h1>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqs.map(([q, a]) => (
        <section key={q}>
          <h2>{q}</h2>
          <p className="lede">{a}</p>
        </section>
      ))}
      <p>Something missing? <a href="/contact/">Ask us</a> or <a href="https://github.com/Raktim94/schoolkick/issues">open an issue</a>. Never include real learner data.</p>
    </main>
  );
}
