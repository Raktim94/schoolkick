# AI implementation brief

For a coding agent working in this repository. Read fully before changing anything.

## Before you start
1. Read `AGENTS.md` if present, `CONTRIBUTING.md`, `SECURITY.md`, `docs/architecture.md`, `docs/decisions/`, `docs/design.md` (section 13 = what is implemented), and `docs/design-alignment.md`.
2. `docs/traceability.md` is the **implementation status ledger**. Only `working` rows with named test evidence count as available. Update it, with evidence, in the same change as the code.
3. `docs/wiki/15-feature-catalog.md` is a **researched backlog, not a promise**. `docs/wiki/13-roadmap-and-modules.md` lists the recommended next slices. `docs/wiki/16-page-audit.md` is the page-by-page UX baseline.
4. Inspect the existing code for the pattern you will extend (`server/src/kernel.ts`, one module in `server/src/modules/`, one screen in `web/src/`). Do not invent a parallel pattern.

## How to work
- Pick **one** coherent, end-to-end, high-value workflow (schema → API → UI → tests → docs). Do not implement many catalog items at once, and avoid broad rewrites or unrelated changes. If the user's request is vague, choose the next slice from the roadmap and say so.
- Do not stop for ordinary implementation choices. Ask only when a missing decision blocks safe or correct work (e.g. payment provider contract, jurisdiction rules).
- Preserve: default-deny route registration (`k.secure` / `k.pub` with reason), tenant scoping and RLS, append-only history for attendance, audit and financial rows, and the self-hosted one-container-plus-PostgreSQL architecture. Schema changes = a new numbered migration; never edit an applied one.
- Never expose secrets or sensitive learner, guardian, staff, payment or location data in public APIs, browser bundles, logs, test fixtures or screenshots. Redact personal data and precise GPS from routine logs. Demo data must be fictional and labelled.
- Payroll, GPS, health, custody and AI features need their own permissions, retention rules and human review before any code. Keep humans in the loop for grades, admissions, discipline, payroll, safeguarding and external communications. No learner data to external AI services by default.
- Do not claim compliance, security guarantees, "complete" coverage or adoption outcomes anywhere (code, docs, README, site).

## UI work
Do the page-by-page visual and interaction pass first (user, job, states, keyboard/screen reader, data scope; see the template in wiki page 16). Follow existing tokens in `web/src/styles.css`. Cover loading, empty, error, offline, permission-denied, pending, conflict, success and destructive-confirm states. Target WCAG 2.2 AA. For nontrivial frontend changes, verify in a real browser at ~375, 768 and 1440 px (light and dark), keyboard-only, and look at the screenshots yourself.

## Checks
```sh
npm run typecheck && npm run build
TEST_ADMIN_URL=postgres://user:pass@localhost:5432/postgres npm test   # needs a disposable PostgreSQL 16
npm run e2e                                                            # needs running app + Chrome
```
Add focused tests for changed behaviour (the default-deny sweep must still pass). **Report exactly what passed and what you could not run.**

## Finish
Update, where applicable: `docs/traceability.md`, `docs/roadmap.md`, wiki pages, OpenAPI summaries, `CHANGELOG.md`, migration notes, screenshots (real, fictional data). Then report: changed files; verified feature status; risks; migration and deployment steps; the next recommended slice. Commit with the repository owner's identity only; no co-author trailers.
