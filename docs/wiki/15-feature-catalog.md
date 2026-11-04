# 15. Feature catalog (researched backlog)

A **backlog, not a promise.** Status uses: **Built** (see traceability), **Partial**, **Planned**, **Validate** (needs interviews, standards review, provider/jurisdiction research). Scope: **Core** = shared platform capability, **Module** = optional. Types: **S** school, **C** college/university, **T** coaching/training. Sources: F = Frappe, D = Fedena, O = OneRoster, A = APAAR/UDISE (see [sources](14-research-sources.md)); *own* = judgement, unsourced.

| Feature | User / job | Types | Scope | Status | Depends on | Privacy / security note | Source |
|---|---|---|---|---|---|---|---|
| Tenancy, roles, RLS, audit | Admin: separate institutions safely | all | Core | Built | – | Default deny | own |
| Campuses, departments | Governor: model multiple sites | all | Core | Planned | tenancy | Campus-scoped permissions | D |
| Academic years, terms, calendars, holidays | Admin: define the year | all | Core | Planned | tenancy | Configurable, no hardcoded locale | O (sessions) |
| Approval chains, delegated authority | Owner: control sensitive actions | all | Core | Partial (refund approval only) | roles | Auditable | own |
| Data export, retention, deletion | Operator: meet legal duties | all | Core | Planned | – | High sensitivity | own |
| Enquiries, applications, documents, offers, waitlist | Registrar: admit learners | S C T | Module | Planned | files, comms | Minors' data, documents | F D |
| Learner profile, guardians | Registrar: keep records | all | Core | Built (basic) | – | | F D O |
| Consent, custody/access restrictions, emergency contacts, accommodations | Registrar: safeguard | S T | Core | Planned | learner profile | Strict permissions | A (consent) |
| Health notes | Nurse/registrar | S | Module | Validate | permissions | Special category | own |
| Bulk import with preview | Registrar: onboard fast | all | Core | Built (CSV, learners) | – | | O (CSV) |
| Import rollback, duplicate detection | Registrar | all | Core | Planned | import | | own |
| Classes, teacher assignment, enrolment | Admin | S T | Core | Built | | Assigned-only access | F O |
| Programs, courses, credits, prerequisites, sections | Registrar/advisor | C | Module | Validate | academic calendar | | O F |
| Timetable, rooms, substitutions | Admin/teacher | S C T | Core | Planned | calendar, staff | | F D |
| Class attendance + corrections | Teacher | S | Core | Built | | Append-only | F D |
| Session/course attendance | Teacher | C T | Core | Planned | timetable | | F |
| QR check-in | Gate/teacher | S C T | Module | Planned | signed sessions | Replay protection | D |
| Assignments, lesson plans, syllabus, resources | Teacher/learner | S C T | Module | Validate | files | Accessibility, captions | D O (resources) |
| Assessment plans, marks, moderation, results | Teacher/registrar | all | Core | Planned | exams | Human review of grades | F D O (gradebook) |
| Report cards, transcripts, certificates | Registrar | all | Core | Planned | marks | Immutable issued copies | D |
| Exam registration, hall tickets | Registrar/guardian | S C | Module | Built | fees | | F |
| Guardian portal | Guardian | S T | Core | Partial (attendance, fees, exams) | | Linked children only | F D |
| Learner portal (minors and adults) | Learner | all | Core | Planned | consent model | Age-aware | F |
| Teacher tools home | Teacher | all | Core | Partial | timetable | | own |
| Fee structures, invoices, receipts, refunds | Finance | all | Core | Built (one-off invoices) | | Immutable money rows | F D |
| Instalments, scholarships, waivers, late fees, payment plans | Finance | all | Core | Planned | invoices | | own |
| Ledger, cashbook, accounting export | Finance | all | Module | Planned | | Tally/QuickBooks seen in D | D |
| Card/bank payment provider | Guardian/finance | all | Core | Planned | provider contract | Verified webhooks, idempotency | F D |
| Budgets, purchasing, inventory, assets | Finance/ops | S C | Module | Validate | | | D |
| Staff records, leave, shifts | HR | all | Module | Planned | roles | Separate permission | D |
| Payroll | HR/finance | all | Module | Validate | jurisdiction rules | Versioned reviewed rules; no invented compliance | D |
| Transport routes, fleet | Transport lead | S | Module | Validate | | | D |
| GPS vehicle tracking | Parent/transport | S | Module | Validate | consent, retention | Never public; only during active trips; minimise | own |
| Announcements, inbox, SMS/email/push | All | all | Core | Planned | consent, quiet hours | Delivery status; human-reviewed translation | D |
| Public-website API | Marketing/admissions | all | Module | Validate | API keys | Published content only | own |
| Scoped API keys, webhooks, OpenAPI | Integrators | all | Core | Partial (OpenAPI route list) | | Rotation, rate limits, audit | O |
| OneRoster import/export | Integrators | S C | Module | Validate | | | O |
| UDISE+/APAAR export or ID field | Registrar (India) | S | Module | Validate | | Consent for minors | A |
| Hostel, library, labs, cafeteria, events, clubs | Ops | S C | Module | Validate | | | D |
| Coaching batches, practice tests, billing plans | Coach/guardian | T | Module | Validate | | | own |
| i18n (EN, HI, ES, ...) | All | all | Core | Planned | string externalisation | | own |
| MFA, password reset | All | all | Core | Planned | email | | own |
| Optional AI assist | Staff | all | Module | Validate | approved content | Off by default; no learner data to external services; human review | own |
