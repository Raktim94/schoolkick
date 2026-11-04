# 4. Roles, permissions and data boundaries

Roles in code (`server/src/auth.ts`): `owner`, `registrar`, `teacher`, `finance`, `guardian`. A person can hold several roles and switches the active one in the app ("Viewing as").

Every API route is registered with either an explicit role list (`secure`) or an explicit public declaration (`pub`); a test sweeps for undeclared routes. Tenant isolation is enforced in query code **and** by PostgreSQL RLS under the unprivileged `campusos_app` role.

| Capability | Owner | Registrar | Teacher | Finance | Guardian |
|---|---|---|---|---|---|
| Create accounts | ✔ | read list | – | – | – |
| Learners: add/import/link guardians | ✔ | ✔ | – | read | – |
| Classes: create/assign/enrol | ✔ | ✔ | – | – | – |
| Attendance in class | ✔ | ✔ | assigned only | – | – |
| Overview | ✔ | ✔ | – | – | – |
| Audit log | ✔ | – | – | – | – |
| Invoices, record payments, reconcile | ✔ | read | – | ✔ | – |
| Request refund | ✔ | – | – | ✔ | – |
| Approve/reject refund | ✔ | – | – | – | – |
| Exams: create/register/decide | ✔ | ✔ | – | read | – |
| Own linked children, fees, exams | – | – | – | – | ✔ (pay needs `can_pay`) |

*Derived from route registrations in `server/src/modules/*.ts`; the authoritative list is `GET /api/v1/openapi.json`.*

## Data boundaries
- Public routes: sign-up, login/logout/session, OpenAPI, receipt verification (no personal data), payment webhook (HMAC-signed).
- Sensitive today: learner and guardian identity, attendance, fees. Not yet modelled: health notes, custody restrictions, consent history, payroll, GPS (all *Planned*; would need their own permissions before being built).
- Known gap: no campus level, no MFA, in-memory single-process rate limiting.
