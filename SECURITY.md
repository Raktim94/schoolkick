# Security

CampusOS is an early release without an independent audit. Report vulnerabilities privately through GitHub's "Report a vulnerability" on this repository, not in public issues. Include steps to reproduce. Expect an acknowledgement, not a guaranteed timeline.

Controls in place: scrypt password hashing, hashed opaque session tokens, HttpOnly SameSite cookies, CSRF header and origin check, strict CSP, per-route role checks with default deny, PostgreSQL row-level security, append-only attendance and audit tables, rate-limited login and signup. See [architecture](docs/architecture.md).

Not in place: password reset, MFA, distributed rate limiting, backup tooling, data-retention jobs.
