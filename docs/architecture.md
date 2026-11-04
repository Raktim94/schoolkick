# Architecture

```
Browser (PWA, React)  ──►  Hono server (Node 22)  ──►  PostgreSQL 16
 /app/*  static            /api/v1/*  JSON API         row-level security
 /      public site        kernel: authn, roles,       append-only tables
                           scoped transaction, audit
```

**Server** (`server/src`): `kernel.ts` is the only way to register an API route. `secure(method, path, roles, summary, handler)` authenticates, checks roles, opens a transaction, switches to the unprivileged `campusos_app` role and sets `app.tenant_id`, then runs the handler. `pub` is for explicitly public routes. Modules (`auth`, `people`, `classes`, `attendance`, `insights`) hold the business rules. The OpenAPI document is generated from the same registry.

**Data** (`server/migrations`): plain SQL, applied under an advisory lock. `attendance_events` and `audit_events` reject UPDATE and DELETE by trigger and by privilege. The current mark is the latest event per class, learner and day. Corrections require a reason and create an `attendance.correct` audit event.

**Web** (`web/src`): History API routing under `/app`. UI built on Tailwind CSS v4 with source copied from the free tier of [BoardUI](https://www.boardui.com/) (MIT, see `THIRD-PARTY-NOTICES.md`) and React Aria for accessible primitives; the older screen styles live in a lower CSS layer (`web/src/styles.css`) and are being migrated. No chart library: charts are SVG/CSS grid with tooltip, keyboard reading and a table view. A service worker caches only the app shell, never API responses.

**Public site** (`site/`, `server/src/site.ts`): static HTML with unique title, description, canonical, Open Graph and JSON-LD per page, sitemap, robots.txt, real 404 status. `/app` and `/api` send `X-Robots-Tag: noindex`.

**Deployment**: one container plus PostgreSQL. State lives only in the database volume.

## Threat notes
Cross-tenant access is blocked in query code and by RLS (tested with direct SQL). Session theft is mitigated by HttpOnly cookies and hashed storage. Brute force is slowed by in-memory limits (single process only). Not covered: insider database access, compromised host, denial of service at scale.
