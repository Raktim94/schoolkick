# 13. Roadmap, launch profiles and discovery plan

Statuses agree with [`../traceability.md`](../traceability.md). Canonical short roadmap: [`../roadmap.md`](../roadmap.md).

## Status map
- **Available now:** [page 02](02-what-works-today.md).
- **In progress / partial:** hosted checkout (test provider only); teacher home (class list, no timetable); accessibility (automated only).
- **Planned (accepted, unbuilt):** real payment adapter; student-record depth; admissions; marks and results; QR check-in; inbox/notifications; i18n; payroll module; MFA, password reset, security and accessibility audits.
- **Needs validation:** everything in the [catalog](15-feature-catalog.md) not listed above, notably transport/GPS, HR/payroll rules per jurisdiction, public-website API, higher-education credit structures, hostel/library.

## Initial customer segment
Small private schools and coaching centres (roughly 100–1,500 learners) in India that self-host or have someone technical, currently using paper registers plus spreadsheets, who need trustworthy attendance, family visibility and fee collection with UPI. This is a hypothesis to test in discovery, not a market claim; INR/UPI support is the only region-specific finance feature built.

## Launch profiles
| Profile | Minimum to be credible | Gap today |
|---|---|---|
| Small school | Attendance, guardians, fees, receipts, exam registration, backups, password reset | Password reset, backup tooling, report cards |
| Larger multi-campus school | + campus scoping, timetable, messaging, bulk fee plans, MFA for staff | No campus level, timetable, messaging, MFA |
| College / university | + programs, credits, course registration, transcripts, advising | Entirely unbuilt; needs validation first |
| Coaching provider | + batches, session attendance, recurring billing, practice tests | Batches/sessions unbuilt; billing is one-off invoices |

## Next vertical slices (one at a time, each end-to-end)
1. **Account recovery + MFA for staff** (unblocks any production claim; small, high trust value).
2. **Guardian-facing correction notice and student-record depth** (consent, emergency contacts, access restrictions) – deepens the existing wedge.
3. **Marks entry → moderation → result release** on the exam registration already built.
4. **Inbox with email adapter** (quiet hours, delivery status, human-reviewed templates).
5. **Real payment adapter** once a provider contract exists.
6. Admissions pipeline; then timetable; payroll last, as a separate restricted module with versioned, reviewed rules.

## Module catalog (shared vs optional)
*Shared platform:* tenancy, auth/roles, audit, files, notifications, settings, i18n, API keys. *Core academic:* learners, classes, attendance, timetable, assessment. *Finance:* fees, payments, ledger. *Optional modules:* admissions, HR/payroll, transport/GPS, library, hostel, learning content, public-website API, higher-ed programs, coaching batches.

## Customer discovery plan
Interview 5–8 per group before committing a slice: owners/principals, administrators/registrars, finance/accounts, teachers, parents/guardians, IT or support staff, and students only where appropriate (adult learners; for minors, with guardian/school consent). Method: current-workflow walkthroughs, artefact review (registers, fee receipts), and a prototype task test. Record findings in a research repository; do not quote individuals or collect children's data.

**Outcome measures (no engagement metrics):** time to take a register; share of corrections with a reason; attendance-correction rate; days from payment to reconciliation; import success on first attempt; guardian activation (first successful sign-in within 14 days of link); support requests per 100 learners per month; tasks completed unaided in usability tests. Explicitly **not** optimised: notification volume, time in app, learner screen time.
