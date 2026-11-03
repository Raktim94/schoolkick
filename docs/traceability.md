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

## Fees, payments, receipts (this slice, v0.2)

| Feature | Status | Owner role | Route / API | Permissions | Evidence |
|---|---|---|---|---|---|
| Invoices (immutable, numbered, minor units) | working | finance, owner | `POST /fees/invoices` | finance/owner write; registrar read | fees.test |
| Bulk invoice per class | partial | finance, owner | `POST /fees/invoices/bulk` | finance/owner | fees.test; API only, no UI |
| Void with reason, never delete | working | finance, owner | `POST /fees/invoices/:id/void` | blocked once paid | fees.test |
| Hosted checkout, test provider | partial | guardian | `POST /guardian/invoices/:id/pay` | linked + `can_pay` | fees.test, e2e. **Sandbox only; no real provider adapter** |
| Never paid from return URL | working | guardian | `GET /guardian/payments/:id` | linked child | fees.test |
| Signed webhook, idempotent, out-of-order safe | working | system | `POST /webhooks/payments/sandbox` | HMAC-SHA256 | fees.test |
| One open online payment per invoice (no double pay) | working | guardian | partial unique index | DB-enforced | fees.test |
| "Do not pay again yet" + reference + case note | working | guardian | `GET /guardian/fees` | linked child | fees.test, e2e screenshot |
| Reconciliation queue, resolve with evidence, case ETA | working | finance, owner | `/fees/reconciliation`, `/fees/payments/:id/resolve` | finance/owner | fees.test |
| Cash / bank / cheque entry with receipt | working | finance, owner | `POST /fees/invoices/:id/payments/manual` | finance/owner | fees.test, e2e |
| Numbered receipt after verified payment only | working | all payers | `GET /receipts/:id` | staff or linked guardian | fees.test |
| Printable receipt | partial | guardian, staff | `/app/receipts/:id` + browser print | same | e2e. **No server-generated PDF, no verification QR** |
| Refund recording, history kept | partial | finance, owner | `POST /fees/payments/:id/refund` | finance/owner | fees.test. **No approval step, no provider-side refund** |
| Financial rows immutable at SQL level | working | n/a | triggers + grants | n/a | fees.test |
| Partial payments | working | guardian, finance | pay `amountMinor`; manual | outstanding cap | fees.test |
| Late fee, grace, installments, scholarships, sponsors | planned | | | | |
| Exam payment workflow (eligibility, form, admit card) | planned | | | | invoice kind `exam` exists; nothing else |
| Real provider adapters (card, UPI, bank) | planned | | | | webhook shape is provider-neutral; needs a provider contract |
| Ledger, cashbook, expenses, accounting export | planned | | | | |

## Not built

Admissions and applicant portal; student portal; teacher QR check-in and ID cards; timetable; gradebook, report cards, exam management; HR and payroll; messaging/inbox and channel adapters; website CMS; scoped API keys and outbound webhooks; AI/MCP; library, transport, hostel, health; country packs and the `/countries` page; i18n (UI is English only); MFA; background jobs/outbox; private file storage; Windows/macOS/mobile builds (Capacitor config only). All **planned**.
