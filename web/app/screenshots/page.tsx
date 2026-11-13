import type { Metadata } from 'next';
export const metadata:Metadata={title:'Product screenshots',description:'See SchoolKick attendance, family access, fees and exam registration screens on phone and desktop. Every screenshot uses fictional demonstration records.',alternates:{canonical:'/screenshots/'}};
const shots=[
 ['dashboard-desktop.webp','School overview','Attendance today, recent changes, class register and items needing attention.'],
 ['teacher-roster-mobile.webp','Teacher register','A phone-sized class roster with status controls and a clear save action.'],
 ['guardian-mobile.webp','Guardian view','Linked learner attendance in a browser, without a separate family app.'],
 ['import-check-desktop.webp','CSV import preview','Validation results by row before any learners are saved.'],
 ['fees-staff-desktop.webp','Fee management','Invoice totals and payment status for school finance staff.'],
 ['fees-parent-mobile.webp','Family fee view','A guardian’s fee status and payment information for linked learners.'],
 ['reconcile-desktop.webp','Payment reconciliation','Unresolved provider events ready for staff review.'],
 ['receipt-mobile.webp','Receipt','A readable payment receipt on a phone.'],
 ['upi-checkout-mobile.webp','UPI QR payment','A guardian scans a QR code; the school office confirms receipt of payment.'],
 ['exams-parent-mobile.webp','Exam registration','A guardian reviews exam subjects, eligibility, fees and the hall ticket.'],
];
export default function Screenshots(){return <main id="main" className="screenshots-page"><section className="docs-hero"><div className="wrap"><p className="crumbs"><a href="/">Home</a> / Screenshots</p><p className="eyebrow">Real screens · fictional records</p><h1>See the school work inside SchoolKick.</h1><p className="lede">Attendance, family access, imports, fees and exams on phone and desktop.</p></div></section><section className="wrap screenshot-gallery" aria-label="SchoolKick product screenshots">{shots.map(([file,title,description])=><figure className="screenshot-card" key={file}><img src={`/s/${file}`} alt={`${title}: ${description}`} loading="lazy"/><figcaption><b>{title}</b><span>{description}</span></figcaption></figure>)}</section><section className="wrap screenshots-note"><p className="eyebrow">For privacy</p><p>All names and records shown here are fictional. Do not upload real learner screenshots to public reports or issues.</p></section></main>}
