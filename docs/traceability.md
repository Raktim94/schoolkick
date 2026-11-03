# Traceability

Status: **working** = implemented, tested, reachable in the UI or API; **partial** = some of it is; **planned** = nothing built. A menu link alone never counts. Evidence names a test in `server/test/` or a browser check in `e2e/`.

## Core (v0.1)

| Feature | Status | Owner role | Route / API | Permissions | Evidence |
|---|---|---|---|---|---|
| Institution sign-up, tenants, currency | working | owner | `POST /tenants` | public, rate-limited | api.test signup; fees.test |
| Auth, roles, default deny, CSRF | working | all | `/auth/*`, kernel | role list per route, RLS | api.test default-deny sweep |
| Multi-role person, active role switcher | partial | all | UI "Viewing as" | per role | no campus switcher |
| Learners, guardians, CSV import dry run | working | owner, registrar | `/learners*` | staff; finance read | api.test import |
| Guardian link without payment rights | working | owner, registrar | `POST /learners/:id/guardians {canPay}` | per link | fees.test |
| Classes, teacher assignment | working | owner, teacher | `/classes*` | assigned classes only | api.test teacher scoping |
| Student attendance, append-only corrections | working | teacher, staff | `/classes/:id/attendance` | assigned class | api.test |
| Guardian today view | working | guardian | `/guardian/learners` | linked children | api.test, e2e |
| Overview dashboard | working | owner, registrar | `/insights/overview` | staff | api.test |
| Audit log | working | owner | `/audit` | owner | api.test |

## Fees, payments, receipts, exams (v0.2)

| Feature | Status | Owner role | Route / API | Permissions | Evidence |
|---|---|---|---|---|---|
| Invoices (immutable, numbered, minor units) | working | finance, owner | `POST /fees/invoices` | finance/owner write; registrar read | fees.test |
| Invoice a whole class | working | finance, owner | `POST /fees/invoices/bulk`, UI "Invoice a whole class" | finance/owner, confirm step | fees.test |
| Void with reason, never delete | working | finance, owner | `POST /fees/invoices/:id/void` | blocked once paid | fees.test |
| **Cash at the office, receipt printed** (no gateway needed) | working | finance, owner | `POST /fees/invoices/:id/payments/manual` | finance/owner | fees.test, e2e |
| **UPI payment QR** (school UPI id, exact amount, reference; INR only) | working | guardian, finance | `POST /guardian/invoices/:id/upi`, `GET /fees/invoices/:id/upi` | linked guardian with pay right; finance/owner at counter | fees.test, e2e |
| UPI is never "paid" from a claim: payer gives UTR, office confirms against bank statement | working | guardian, finance | `POST /guardian/payments/:id/claim`, `/fees/payments/:id/resolve` | linked guardian; finance/owner | fees.test, e2e |
| Hosted online checkout, test provider | partial | guardian | `POST /guardian/invoices/:id/pay` | linked + `can_pay` | fees.test, e2e. **Test provider only** |
| Real card/bank provider adapter | planned | | | | webhook and state machine are provider-neutral; needs a provider contract and keys |
| Never paid from return URL; signed idempotent webhook; out-of-order safe | working | system | `POST /webhooks/payments/sandbox` | HMAC-SHA256 | fees.test |
| One open online/UPI payment per invoice (no double pay) | working | guardian | partial unique index | DB-enforced | fees.test |
| "Do not pay again yet" + reference + case note | working | guardian | `GET /guardian/fees` | linked child | fees.test, e2e |
| Reconciliation queue with UTR, evidence, case ETA | working | finance, owner | `/fees/reconciliation`, `/fees/payments/:id/resolve` | finance/owner | fees.test, e2e |
| Numbered receipt after verified payment only | working | payers, staff | `GET /receipts/:id` | staff or linked guardian | fees.test |
| **Receipt PDF with verification QR** | working | payers, staff | `GET /receipts/:id/pdf`, public `GET /verify/:id/:sig` | same as receipt; verify shows no names | fees.test. Latin and Devanagari text; other scripts not rendered |
| **Refund request and owner approval** | working | finance requests, owner decides | `/fees/payments/:id/refund`, `/fees/refunds`, `/fees/refunds/:id/decide` | finance/owner; owner decides | fees.test. Money is paid back outside the system; no provider-side refund |
| Partial payments | working | guardian, finance | `amountMinor` | outstanding cap | fees.test |
| Payment settings (UPI id) | working | owner, finance | `GET/PUT /fees/settings` | finance/owner | fees.test |
| Financial rows immutable at SQL level | working | n/a | triggers + grants | n/a | fees.test |
| **Exam registration, fee, review, hall ticket** | working | owner, registrar; guardian | `/exams*`, `/guardian/exams*` | registrar/owner manage; guardian own children | exams.test, e2e |
| Exam windows (open, late with late fee, closed) and attendance eligibility, staff override with reason | working | registrar | `POST /exams`, `POST /exams/:id/register` | registrar/owner | exams.test |
| Late fees on invoices, instalments, scholarships, sponsors | planned | | | | late fee exists for exams only |
| Ledger, cashbook, expenses, accounting export | planned | | | | |

## Public site

| Feature | Status | Evidence |
|---|---|---|
| `/countries` page: seven markets, honest status (none Available or Pilot) | working | e2e/run.mjs SEO checks |

## Accessibility

Automated axe-core run (WCAG 2.0/2.1/2.2 A and AA rules) on parent fees, UPI checkout, parent exams, finance fees and reconciliation: no violations (harness checked against a deliberately broken page). **Not done:** manual screen-reader pass, keyboard-only walkthrough record, specialist audit. Status: partial.

## Not built

Admissions and applicant portal; student portal; teacher QR check-in and ID cards; timetable; gradebook, report cards, marks and results; HR and payroll; messaging/inbox and channel adapters; website CMS; scoped API keys and outbound webhooks; AI/MCP; library, transport, hostel, health; country packs; i18n (UI is English only); MFA; background jobs/outbox; private file storage; Windows/macOS/mobile builds (Capacitor config only). All **planned**.
