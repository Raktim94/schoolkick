import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SchoolKick compared: self-hosted, hosted and spreadsheet attendance',
  description: 'A fair comparison of SchoolKick with hosted school management software and spreadsheets or paper registers: data ownership, setup effort, what is available today and where another option fits better.',
  alternates: { canonical: '/compare/' },
};

const rows: [string, string, string, string][] = [
  ['Where records live', 'On a server you run, in PostgreSQL', 'On the provider’s servers', 'Files or paper you manage'],
  ['Setup effort', 'You install and maintain it (one command on Ubuntu/Debian or Docker)', 'Sign up and configure', 'None, but every layout is built by hand'],
  ['Cost model', 'Free software (AGPL-3.0-only); you pay for hosting and backups', 'Usually a per-school or per-learner subscription', 'Free apart from your tools'],
  ['Attendance history', 'A correction adds to the record; earlier marks are kept', 'Varies by product', 'Edits usually overwrite earlier values'],
  ['Family access', 'A browser view for guardians; no separate app', 'Often a mobile app and notifications', 'Manual sharing'],
  ['Fees and exams today', 'Fee invoices, cash or UPI QR payments confirmed by the office, receipts, exam registration, fees and hall tickets', 'Commonly broader, including online card payments', 'Manual'],
  ['Not available yet', 'Card or bank payment integration, marks entry and results, messaging, timetable, email password reset, teacher QR check-in, learning content, native apps', 'Depends on the provider', 'Not applicable'],
  ['Maturity and review', 'Early release; no independent security audit has been completed', 'Established products usually publish audits and support terms; check them', 'Not applicable'],
  ['Support', 'Documentation and GitHub issues', 'Provider support, depending on plan', 'None'],
];

export default function Compare() {
  return <main id="main" className="wrap editorial-section">
    <p className="crumbs"><a href="/">Home</a> / Compare</p>
    <p className="eyebrow">Before you choose</p>
    <h1>Find the right fit for your school.</h1>
    <p className="lede info-prose">This comparison is written by the SchoolKick project, so weigh it accordingly. It compares kinds of tools rather than named products, because features and plans change. Check each provider&apos;s current documentation and terms.</p>
    <div className="info-table-wrap"><table className="info-table">
      <caption className="sr-only">SchoolKick compared with hosted school software and spreadsheets</caption>
      <thead><tr><th scope="col">Question</th><th scope="col">SchoolKick</th><th scope="col">Hosted school software</th><th scope="col">Spreadsheet or paper register</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}</tbody>
    </table></div>
    <div className="info-prose">
      <h2>SchoolKick is a good fit when</h2>
      <ul><li>You want attendance, fees and exam registration records on a server you control.</li><li>You can run Docker or an Ubuntu/Debian server, or have someone who can.</li><li>A clear history of corrections matters more than a long feature list.</li></ul>
      <h2>Something else may suit you better when</h2>
      <ul><li>You need marks entry, results, messaging, a timetable or native apps today.</li><li>You want a provider to host, back up and support everything.</li><li>You need an independently audited product before handling real learner data.</li></ul>
      <p><a href="/roadmap/">See exactly what is and is not included →</a> · <a href="/security/">Security notes →</a> · <a href="/get-started/">Install →</a></p>
    </div>
  </main>;
}
