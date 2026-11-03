# Contributing

1. `npm install`, start PostgreSQL 16, set `TEST_ADMIN_URL`, then `npm test` and `npm run typecheck`. People who contribute are listed in [contributors.html](contributors.html).
2. Keep changes small. Prefer deleting code to adding it. New routes must use `k.secure` (or `k.pub` with a reason) so the default-deny test passes.
3. Schema changes go in a new numbered file in `server/migrations`. Never edit an applied migration.
4. UI changes: keep status non-colour-only, keyboard operable, and check light, dark and 375px widths. `npm run e2e` must pass with no console errors.
5. Do not add real learner data to tests, screenshots or issues.
