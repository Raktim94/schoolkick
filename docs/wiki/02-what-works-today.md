# 2. What works today

Last verified: **2026-11-04**, against source at `main` (version 0.3.0) and [`traceability.md`](../traceability.md).

**Verification:** `npm run typecheck` and `npm run build` pass locally. The PostgreSQL-backed suite (`server/test/*.test.ts`, 37 test cases) could not be run locally (no database access), but **passes in CI** (GitHub Actions run 41798013140, 2026-11-04). CI had been failing on every earlier `main` run since 0.3.0 because the three test files ran concurrently and raced creating the cluster-wide `campusos_app` role; fixed by running test files serially (commit "Run API test files serially"). So "working" in the ledger had no green CI behind it until that fix.

**Release note:** the version in source is 0.3.0 but the only published GitHub release/tag is `v0.1.0`. A tagged 0.3.0 release is a maintainer decision.

| Area | Status | Notes |
|---|---|---|
| Institution sign-up, roles, sessions | Working | Default-deny route registry; CSRF header/origin check |
| Learners, guardians, class enrolment | Working | Manual entry and CSV import with dry run |
| Class attendance with kept corrections | Working | Append-only; reason required |
| Guardian view | Working | Linked learners only |
| Overview and audit log | Working | Staff / owner |
| Fee invoices, cash, UPI QR, receipts (PDF + verification), refunds | Working | Payment confirmed by staff against bank evidence |
| Reconciliation queue | Working | |
| Hosted online checkout | Partial | **Test provider only**; no real card/bank adapter |
| Exam registration, fee, hall tickets | Working | No marks or results |
| Dark theme, responsive layout | Working | 375/768/1440 screenshots in `docs/screenshots/` |
| Automated accessibility checks | Partial | axe-core on fee/exam screens; no manual screen-reader pass or specialist audit |
| Teacher home | Partial | A "Today" list of classes; no timetable |
| Learner/student portal, admissions, timetable, gradebook, messaging, HR/payroll, transport/GPS, i18n, MFA, password reset, API keys | Planned / not built | See [catalog](15-feature-catalog.md) |

Not claimed anywhere in this project: that it is complete, certified, fully compliant, audited or secure beyond the controls listed in [security](10-security-privacy-operations.md).
