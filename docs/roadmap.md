# Roadmap

Built: v0.1 core (tenant, auth/roles, learners, guardians, classes, attendance with correction history, guardian view, overview, CSV import, audit). v0.2 fees: invoices, verified payments, reconciliation, receipts, refunds (see `traceability.md` for what is partial).

Decision needed before real money: pick a payment provider (card/UPI/bank) per market and sign its contract; the webhook, state machine and reconciliation are already provider-neutral.

Next slices, each tested and handed off on its own:
1. Real provider adapter + server-side receipt PDF with verification QR; refund approval step.
2. Student record depth (guardian restrictions, consent history, correction requests) and admissions pipeline.
3. Exam registration with the fee flow (eligibility, deadline, form status, admit card).
4. Teacher QR check-in (short-lived signed sessions, replay protection, manual fallback) and ID cards.
5. Inbox and notifications (email first, quiet hours, deduplication, draft save).
6. `/countries` page with honest statuses, i18n framework (EN, ES, HI, JA, FR), then country packs one at a time with acceptance checks.
7. Payroll as a separate, restricted module with versioned, reviewed rule sets.
8. Security review, accessibility audit, MFA for privileged roles before any production-readiness claim.
