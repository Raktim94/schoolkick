# 3. Installation and first-day setup

Canonical commands live in the [README](../../README.md#install); this page adds context. Last verified against `packaging/install.sh`, `deploy/docker-compose.yml`, `deploy/.env.example`: 2026-11-04. (Not executed in the review environment: Docker was not accessible.)

## Options
1. **One command (Docker):** `curl -fsSL https://schoolkick.nodedr.com/install.sh | bash`. Builds the current `main`, generates a database password, starts on port 3847, refuses to overwrite an existing install. **Read [`packaging/install.sh`](../../packaging/install.sh) before piping any script to a shell.**
2. **Docker Compose** with `deploy/.env` (set `POSTGRES_PASSWORD`, `SITE_URL`; consider `ALLOW_SIGNUP=0` after setup so strangers cannot create institutions on your server).
3. **From source:** Node.js 22.18+, PostgreSQL 16. Migrations run at start and need permission to create the `campusos_app` role.
4. Debian package: see `packaging/deb/` (port differs from the Docker default; check the install guide).

The container runs read-only with `no-new-privileges` and all capabilities dropped. Put HTTPS in front before inviting staff or families.

## Payments configuration
Online payment is off unless `PAYMENT_WEBHOOK_SECRET` is set. `PAYMENTS_SANDBOX=1` enables a **fake** provider: no real money moves.

## First-day checklist
1. Create the owner account on first visit; then decide on `ALLOW_SIGNUP`.
2. Create classes; create teacher, registrar, finance and guardian accounts.
3. Add learners or import CSV (`name`, `external_id`, `guardian_email`); fix every previewed error first.
4. Assign teachers; enrol learners; link guardians (and set who may pay).
5. Take one register as a teacher; open the guardian account and confirm only linked children appear.
6. Set the school UPI id in Fee settings if using UPI.
7. Test a backup **and a restore** (see [operations](10-security-privacy-operations.md)).
