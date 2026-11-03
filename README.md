# CampusOS

Open-source school software. Teachers take attendance from a phone, families see today's status in a browser, and every correction stays on the record.

![School overview dashboard with today's attendance, trend and class register](docs/screenshots/dashboard-desktop.png)

**Status: early release (v0.1).** Attendance, guardian view, classes, CSV import and the owner dashboard work and are tested. Fees, messaging, learning content and native mobile apps are planned, not built. It has not had a security audit or legal review. Read [what is and is not covered](docs/traceability.md) before putting real learner data in it.

## What works today

| Area | Details |
|---|---|
| Institutions and roles | Create an institution; owner, registrar, teacher, finance (placeholder), guardian roles; default-deny API |
| People | Learners, guardians, staff accounts; guardian-to-learner links |
| Classes | Create classes, assign teachers, enrol learners; teachers only see their classes |
| Attendance | One-tap "all present", per-learner status, mandatory reason to change a mark, full history per day, drafts survive a dropped connection |
| Guardian view | Today's status per child and a 14-day strip, with a "Corrected" tag |
| Overview | Today's split, attendance trend, class-by-day register heatmap, items needing attention; each chart has a table view and keyboard support |
| CSV import | `name, external_id, guardian_email`; dry run lists every problem, real run is all-or-nothing |
| Audit log | Append-only, enforced by database triggers and restricted privileges |

## Run it

Needs Docker, or Node 22.18+ and PostgreSQL 16.

```sh
cp deploy/.env.example deploy/.env      # set POSTGRES_PASSWORD
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
# open http://localhost:8080  (public site)   http://localhost:8080/app/  (the app)
```

Without Docker:

```sh
npm install && npm run build
DATABASE_URL=postgres://user:pass@localhost:5432/campusos npm start
```

The database role needs permission to create roles on first start (migration 002 creates the unprivileged `campusos_app` role used for row-level security).

More: [self-hosting and CasaOS](site/self-hosting.html), [mobile wrapper](mobile/README.md).

| Platform | Status |
|---|---|
| Linux, Windows, macOS | Node server or Docker. Linux server tested here; others not yet. |
| Docker, CasaOS | Compose file with CasaOS metadata written. **Not run** in the build environment (no Docker daemon). |
| Android, iOS | Works as an installable PWA. Capacitor shell is configuration only and unbuilt. |

## Develop

```sh
npm run dev:server   # API on :8080
npm run dev:web      # Vite on :5173/app/
npm test             # 18 API tests against a throwaway PostgreSQL database
npm run e2e          # Chrome end-to-end run, writes docs/screenshots
```

Tests need PostgreSQL reachable at `TEST_ADMIN_URL` (default `postgres://postgres@127.0.0.1:54329/postgres`).

## Design in brief

- **One small TypeScript server** (Hono, `pg`, no ORM) serves the API, the public site and the app. See [architecture](docs/architecture.md) and the [decision records](docs/decisions).
- **Tenant isolation twice:** every query is scoped in code, and PostgreSQL row-level security rejects cross-tenant access even if a query forgets.
- **Default-deny routes:** a route must declare its roles or be explicitly public. A test walks the route table to prove it. OpenAPI 3.1 is generated at `/api/v1/openapi.json`.
- **Interface:** React 19 and Vite, hand-built SVG charts, WCAG 2.2 AA targets, dark theme, reduced-motion support. Status is never colour-only.

## Known limits

- No security audit, penetration test, or accessibility audit by a specialist. Automated and manual checks only.
- Rate limiting is in memory, so it is per process.
- No email, so there is no password reset yet. An owner can create accounts, not reset them.
- Single timezone per institution; no academic calendar or holidays.
- Reference projects named in the design brief were not available, so [design alignment](docs/design-alignment.md) is not asserted.

## Licence

MIT. See [LICENSE](LICENSE). Security reports: [SECURITY.md](SECURITY.md).
