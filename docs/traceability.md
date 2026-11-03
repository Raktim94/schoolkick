# Traceability: first slice

| Requirement | Status | Evidence |
|---|---|---|
| Tenant, institution signup | Done | api.test: signup, tenant isolation |
| Auth, roles, default deny | Done | api.test: roles, default-deny sweep, login throttle |
| Learner and guardian | Done | api.test: guardian visibility |
| Classes, teacher scoping | Done | api.test: teacher scoping |
| Attendance with correction history | Done | api.test: correction, history, future date rejected |
| Guardian view | Done | api.test, e2e guardian flow |
| Append-only audit | Done | api.test: append-only SQL |
| CSV import dry run | Done | api.test: dry-run then import |
| Row-level security | Done (local PostgreSQL only) | api.test: direct SQL |
| Docker Compose, CasaOS metadata | Written, not run | no Docker daemon in build environment |
| Capacitor wrapper | Config only | mobile/README.md |
| Accessibility WCAG 2.2 AA | Partial | design targets, keyboard and contrast checks; no specialist audit |
| Fees, messaging, learning | Not built | roadmap |
