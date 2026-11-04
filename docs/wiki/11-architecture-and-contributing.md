# 11. Architecture and contributing

Architecture: see [`../architecture.md`](../architecture.md) and ADRs in [`../decisions/`](../decisions/). Summary: React/Vite PWA at `/app` → Hono (Node 22) JSON API at `/api/v1` → PostgreSQL 16 with RLS; a static public site; one container plus database.

Layout: `server/src/kernel.ts` (only way to register routes) · `server/src/modules/*` · `server/migrations/*.sql` (numbered, never edit applied ones) · `web/src` (app) · `web/app` (Next.js public site) · `site/` (static pages) · `e2e/` (Puppeteer + axe-core) · `mobile/` (Capacitor config only).

Contributing: [`CONTRIBUTING.md`](../../CONTRIBUTING.md). Tests need PostgreSQL 16 and `TEST_ADMIN_URL` pointing at a disposable database. Never put real learner data in tests, screenshots or issues. Future coding agents: read the [AI implementation brief](../AI-IMPLEMENTATION-BRIEF.md).
