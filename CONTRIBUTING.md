# Contributing

1. `npm install`, start PostgreSQL 16, set `TEST_ADMIN_URL`, then `npm test` and `npm run typecheck`. People who contribute are listed in [contributors.html](contributors.html).
2. Keep changes small. Prefer deleting code to adding it. New routes must use `k.secure` (or `k.pub` with a reason) so the default-deny test passes.
3. Schema changes go in a new numbered file in `server/migrations`. Never edit an applied migration.
4. UI changes: keep status non-colour-only, keyboard operable, and check light, dark and 375px widths. `npm run e2e` must pass with no console errors.
5. By opening a pull request you agree to the contribution terms in [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md): you keep your copyright and grant the maintainer the right to also distribute it under other licences.
6. Do not add real learner data to tests, screenshots or issues.

7. Re-recording the README clips after a UI change: start the app with `PAYMENTS_SANDBOX=1 PAYMENT_WEBHOOK_SECRET=x`, run `FRAMES=/tmp/sk-frames node e2e/gifs.mjs`, then `python3 e2e/gifs.py /tmp/sk-frames` (needs Pillow). Output goes to `docs/gifs/`.
