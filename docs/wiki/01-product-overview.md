# 1. Product overview and terminology

SchoolKick is an open-source (AGPL-3.0-only), self-hosted system for school attendance and learner records, with family access, fee records and exam registration. Teachers take a register from a phone, guardians see only their linked learners in a browser, and staff review attendance, imports, fees and recent changes.

**Long-term direction (not a current claim):** one configurable, modular platform for schools, colleges and coaching providers. Today it is an early release for a narrow segment; see [roadmap](13-roadmap-and-modules.md).

## Terms

| Term | Meaning in SchoolKick |
|---|---|
| Institution (tenant) | One school/organisation. All data is scoped to it and enforced by PostgreSQL row-level security. |
| Owner | Shown in the app as *Administrator*. Full control, approves refunds, sees the audit log. |
| Registrar | Staff role for learners, classes, exams. |
| Teacher | Sees only classes assigned to them. |
| Finance | Invoices, payments, reconciliation, refund requests. Cannot approve refunds. |
| Guardian | Parent/guardian account linked to specific learners; may or may not have a "can pay" right per link. |
| Learner | A student record. Learners do **not** have accounts today. |
| Correction | A changed attendance mark. Needs a reason; the original entry is kept. |
| Minor units | Money is stored as integers (e.g. paise/cents) to avoid rounding errors. |
| Office-confirmed payment | UPI/cash recorded as paid only after a staff member verifies it against a bank statement or the counter. |
