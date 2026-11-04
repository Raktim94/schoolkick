# 10. Security, privacy, backups, operations

Canonical: [`SECURITY.md`](../../SECURITY.md) (reporting: GitHub private vulnerability report or the contact there; do not file public issues).

## Controls present (verified in source/tests)
scrypt password hashing · hashed opaque session tokens · HttpOnly SameSite cookies · CSRF header + origin check · strict CSP · default-deny role checks · PostgreSQL RLS · append-only attendance, audit and financial rows · rate-limited login and sign-up (in-memory, single process) · read-only container, dropped capabilities.

## Not present
Independent security, accessibility or legal audit · MFA · email password reset · distributed rate limiting · backup tooling · retention/deletion jobs · data export tooling beyond what you do in PostgreSQL · incident process · encryption at rest (rely on disk/DB encryption you configure).

## Operator responsibilities
You run the server: HTTPS, OS patching, database access, backups, retention, notices to families, and compliance with local children's-data law. Jurisdiction-specific legal review is needed before any compliance claim (for India, the DPDP Rules 2025 include verifiable parental consent duties with a limited school exemption; commentary disagrees on rule numbers, so read the Gazette text with counsel).

## Backup and restore (generic PostgreSQL practice; the project ships no tested procedure)
```sh
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T db \
  pg_dump -U schoolkick -Fc schoolkick > schoolkick-$(date +%F).dump
# restore into an empty database:
docker compose ... exec -T db pg_restore -U schoolkick -d schoolkick --clean --if-exists < schoolkick-YYYY-MM-DD.dump
```
Store dumps encrypted and off the server. **Practise a restore on a spare machine before relying on it.** Treat dumps as sensitive: they hold children's data.

## High-sensitivity data (design rule for future modules)
GPS, health, payroll, payments and minors' identity: deny by default, minimise, keep out of logs and screenshots, define retention before collecting.
