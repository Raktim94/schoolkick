<p align="center">
  <img src="docs/hero-animated.svg" alt="SchoolKick: animated overview. A class register is marked and saved, one mark is corrected, and the original entry stays in a history list" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Raktim94/schoolkick/blob/main/LICENSE"><img alt="License: AGPL-3.0-only" src="https://img.shields.io/github/license/Raktim94/schoolkick"></a>
  <img alt="Version 0.3.0 in source" src="https://img.shields.io/badge/version-0.3.0%20(early%20release)-blue">
  <img alt="Node.js 22.18 or newer" src="https://img.shields.io/badge/node-%E2%89%A522.18-339933">
  <img alt="PostgreSQL 16" src="https://img.shields.io/badge/postgresql-16-336791">
  <a href="https://github.com/Raktim94/schoolkick/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/Raktim94/schoolkick/actions/workflows/ci.yml/badge.svg"></a>
  <a href="docs/wiki/README.md"><img alt="Documentation" src="https://img.shields.io/badge/docs-wiki-informational"></a>
</p>

<p align="center">
  <a href="https://schoolkick.nodedr.com/app/"><b>Try the demo</b></a> &nbsp;·&nbsp;
  <a href="#install"><b>Install with Docker</b></a> &nbsp;·&nbsp;
  <a href="docs/wiki/README.md"><b>Read the docs</b></a> &nbsp;·&nbsp;
  <a href="docs/roadmap.md"><b>View the roadmap</b></a>
</p>

<p align="center">
  <sub>Maintainer: <a href="https://www.raktimranjit.com/"><b>Raktim Ranjit</b></a> &nbsp;·&nbsp; <a href="https://schoolkick.nodedr.com/">Website</a> &nbsp;·&nbsp; <a href="#what-works-today">What works today</a> &nbsp;·&nbsp; <a href="#install">Quick start</a> &nbsp;·&nbsp; <a href="#see-schoolkick">Screenshots</a> &nbsp;·&nbsp; <a href="docs/wiki/README.md">Docs</a> &nbsp;·&nbsp; <a href="CONTRIBUTING.md">Contributing</a> &nbsp;·&nbsp; <a href="docs/roadmap.md">Roadmap</a></sub>
</p>

<p align="center">
  <img src="docs/overview-animated.svg" alt="Animated overview with an illustrative sample screen: a class register is marked, then one mark is corrected and the original entry stays in a history list with its reason" width="100%">
</p>

# SchoolKick — Free, Open-Source School Management Software

**Self-hosted school attendance and administration software with a clear history of every correction.**

SchoolKick is free, open-source school management software for schools that want to run their own system. Teachers can take attendance from a phone, guardians can check linked learners in a browser, and staff can manage learner imports, fee records, exam registration and recent changes. Families do not need to install an app. The current release is an early-stage school management system focused on core attendance and administration workflows; see [what works today](#what-works-today) and the [roadmap](docs/wiki/13-roadmap-and-modules.md) for the exact scope.

Looking for the best free school management software for your school? Compare SchoolKick’s available features, deployment requirements and current limitations below. SchoolKick is self-hosted open-source software under AGPL-3.0-only; server, backup and support costs depend on how you choose to run it.

> **Before using real learner data:** this release has had no independent security, accessibility or legal audit, and you, the operator, are responsible for HTTPS, backups, access control and local children's-data requirements. See [security, privacy and operations](docs/wiki/10-security-privacy-operations.md).

<p align="center">
  <img src="docs/features-animated.svg" alt="Animated strip of five working features: attendance, corrections, family view, fees with UPI, and CSV import" width="100%">
</p>

## What works today

Each item is backed by a named test in the status ledger, [`docs/traceability.md`](docs/traceability.md) (last reviewed 2026-11-04).

- **Class attendance:** mark exceptions, save a register from a phone.
- **Kept correction history:** a changed mark needs a reason; the original entry, new entry, person and time are preserved and cannot be edited or deleted.
- **Guardian view:** guardians see only linked learners, with recent attendance, fees and exams.
- **CSV learner import** with a preview of row and column errors; invalid input creates no partial records.
- **School overview and audit log** for staff.
- **Fees and UPI QR payments:** numbered invoices, cash and UPI QR payments confirmed by the office, PDF receipts with a verification code, refund approval and a reconciliation queue. The QR code is for fee payment; QR attendance check-in and a live card or bank payment gateway are **not** available (test provider only).
- **Exam registration:** windows, attendance eligibility, fees and hall tickets. Marks and results are **not** available.
- **Self-hosted data** in PostgreSQL you administer; the container runs read-only.

**Not available yet:** real payment gateway, marks and results, messaging, timetable, admissions, learner accounts, email password reset, MFA, teacher QR check-in, HR/payroll, transport/GPS, learning content, native apps. Details: [what works today](docs/wiki/02-what-works-today.md) and the [feature catalog](docs/wiki/15-feature-catalog.md).

## Who it is for

| Role | Today they can |
|---|---|
| Administrator (owner) | Set up the institution, accounts and classes; review overview, audit log; approve refunds |
| Registrar | Manage learners, classes, imports and exams |
| Teacher | Take and correct attendance for assigned classes |
| Finance | Invoice, record cash/UPI, reconcile, request refunds |
| Parent or guardian | See linked learners, pay or check fees, register for exams |

Permissions in detail: [roles and data boundaries](docs/wiki/04-roles-and-permissions.md).

## See it work

Recorded from the running app with fictional demonstration data. Each clip comes from `e2e/gifs.mjs`, so it can be re-recorded after any UI change.

| Teacher: attendance and a kept correction | Family: today, fees and exams |
|---|---|
| ![Teacher takes a class register on a phone, saves it, then corrects one mark with a reason that is kept in the history](docs/gifs/attendance.gif) | ![Guardian signs in on a phone and sees only their own learner, a corrected mark, fees and exam registration](docs/gifs/family.gif) |

| Fees: UPI payment confirmed by the office | Import: CSV preview before anything is saved |
|---|---|
| ![Guardian pays a fee with a UPI QR code and enters the transaction ID; finance confirms it against the bank statement and a receipt is issued](docs/gifs/upi-payment.gif) | ![Owner pastes a CSV, sees the problem row in the preview, fixes it and imports two learners](docs/gifs/csv-import.gif) |

| Overview, Ctrl+K search and dark theme |
|---|
| ![Owner overview with an animated attendance figure, then a Ctrl+K command palette to jump to Fees, then the dark theme](docs/gifs/overview-palette.gif) |

## Screenshots

All names and records in screenshots are fictional demonstration data.

![SchoolKick school overview on desktop in the redesigned interface](docs/screenshots/dashboard-desktop.png)

| Fees (finance) | Teacher register on a phone | Family view on a phone |
|---|---|---|
| ![SchoolKick fees list for finance staff with status pills and invoice actions](docs/screenshots/fees-staff-desktop.png) | ![SchoolKick teacher roster on a phone](docs/screenshots/teacher-roster-mobile.png) | ![SchoolKick guardian view on a phone](docs/screenshots/guardian-mobile.png) |

## Install

Choose the path that matches your setup. The [installation guide](https://schoolkick.nodedr.com/get-started) includes requirements, current test status and follow-up steps.

<p align="center">
  <img src="docs/install-animated.svg" alt="Animated terminal: one curl command installs SchoolKick on Ubuntu or Debian and prints the address to open" width="100%">
</p>

### One command (Ubuntu / Debian, amd64 and arm64)

```sh
curl -fsSL https://schoolkick.nodedr.com/install-linux.sh | sudo bash
```

Installs Docker if missing, downloads the latest release `.deb`, verifies its SHA-256 checksum, installs it and starts SchoolKick at http://localhost:3847. Settings live in `/etc/schoolkick/schoolkick.env`. **Review [the script](packaging/deb/install-linux.sh) before piping it to a shell.**

### CasaOS / ZimaOS

In CasaOS choose **App Store → Custom Install → Import**, paste the contents of [`deploy/docker-compose.casaos.yml`](deploy/docker-compose.casaos.yml) and click **Install**. It pulls the published multi-arch image, keeps PostgreSQL private (no published port), stores data under `/DATA/AppData/schoolkick/` and adds a tile that opens `http://<your-box>:3847/app/`. Change the database password in the file before first start if the box is reachable by others.

### One command (Docker, builds from source)

Requires Bash, Git, curl, OpenSSL and Docker with Compose v2. On Windows, use WSL with Docker Desktop integration.

```sh
curl -fsSL https://schoolkick.nodedr.com/install.sh | bash
```

This builds the current main branch, generates a database password, and starts the app at http://localhost:3847/app/. It creates a new `schoolkick` directory and refuses to overwrite an existing installation. **Review [the script](packaging/install.sh) before piping it to a shell**, as you would any installer.

### Docker Compose

```sh
git clone https://github.com/Raktim94/schoolkick.git
cd schoolkick
cp deploy/.env.example deploy/.env
```

Set a strong `POSTGRES_PASSWORD` and the external `SITE_URL` in `deploy/.env`, then start the application:

```sh
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
curl http://localhost:3847/readyz
```

The ready endpoint returns `{"ok":true}` when the server is accepting requests. Open `http://localhost:3847/app/` to create the first school owner. Configure HTTPS before inviting staff or families.

### From source

Needs Node.js 22.18+, npm and PostgreSQL 16.

```sh
git clone https://github.com/Raktim94/schoolkick.git
cd schoolkick
npm install
npm run build
createdb schoolkick
DATABASE_URL=postgres://user:pass@localhost:5432/schoolkick npm start
```

Then open `http://localhost:3847/app/`. Database migrations run when the server starts. The migration connection needs permission to create the restricted `campusos_app` role.

## First day setup

1. Create the school owner account during first sign-in.
2. Create classes, teacher accounts and guardian accounts.
3. Add learners individually or prepare a CSV with `name`, `external_id` and `guardian_email` columns.
4. Use the import preview to resolve all validation issues before saving.
5. Assign teachers, enrol learners and link each learner to a guardian.
6. Take attendance as a teacher, then sign in as a guardian to review the linked learner view.

The [full documentation](https://schoolkick.nodedr.com/docs) covers operations, hosting and API details.

## Privacy, security and accessibility

The app uses a protected session cookie and includes no advertising trackers or analytics. Controls and gaps are listed in [`SECURITY.md`](SECURITY.md) and the [security page](docs/wiki/10-security-privacy-operations.md); notably there is no MFA, email password reset or backup tooling yet. Accessibility work is partial: automated checks only, no specialist audit ([details](docs/wiki/12-design-and-accessibility.md)). Do not use the hosted demonstration for real learner information. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues. Read the [privacy notice](https://schoolkick.nodedr.com/privacy), [accessibility statement](https://schoolkick.nodedr.com/accessibility) and [legal information](https://schoolkick.nodedr.com/legal).

**Backups and restore:** a generic `pg_dump`/`pg_restore` procedure is in the [operations guide](docs/wiki/10-security-privacy-operations.md#backup-and-restore-generic-postgresql-practice-the-project-ships-no-tested-procedure); practise a restore before relying on it.

## Documentation

[Wiki index](docs/wiki/README.md) · [Roadmap](docs/roadmap.md) · [Status ledger](docs/traceability.md) · [Architecture](docs/architecture.md) · [Design system](docs/design.md) · [API and integrations](docs/wiki/09-api-and-integrations.md) · [Research sources](docs/wiki/14-research-sources.md) · [AI implementation brief](docs/AI-IMPLEMENTATION-BRIEF.md) · [Changelog](CHANGELOG.md) · [Website](https://schoolkick.nodedr.com/)

## Support

Questions and bugs: [open an issue](https://github.com/Raktim94/schoolkick/issues) (never include real learner data). Vulnerabilities: see [SECURITY.md](SECURITY.md).

## Technology

- **Web application:** React, TypeScript, Vite, Tailwind CSS v4 and the free [BoardUI](https://www.boardui.com/) components (MIT; see [third-party notices](THIRD-PARTY-NOTICES.md))
- **Public website:** Next.js static export, TypeScript and React
- **API and web server:** Node.js, Hono and PostgreSQL
- **Mobile packaging:** Capacitor
- **Deployment:** Docker Compose; Debian package installer for supported Linux systems

## Development

```sh
npm install
npm run build
npm run typecheck
```

The API tests use PostgreSQL. Set `TEST_ADMIN_URL` to a disposable PostgreSQL database before running `npm test`. Browser end-to-end checks also need a running app and Chrome; see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Contributing

Bug reports, accessibility feedback, documentation improvements and code contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), read [`SECURITY.md`](SECURITY.md) for vulnerability reports and open a focused issue for larger changes.

## License and maintainer

SchoolKick is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**. See [`LICENSE`](LICENSE). If you run a modified version for other people over a network, the license requires you to offer those users the corresponding source code. The SchoolKick name and logo are not granted under the software license. See [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) for the separate commercial licensing contact.

Maintained by [Raktim Ranjit](https://www.raktimranjit.com/) for **NODEDR INFOTECH PRIVATE LIMITED** (India CIN: **U62091WR2026PTC294027**). Company details: [nodedr.com](https://www.nodedr.com/).

---

Built for a clearer school day by [Raktim Ranjit](https://www.raktimranjit.com/) · [NODEDR INFOTECH PRIVATE LIMITED](https://www.nodedr.com/) (CIN: U62091WR2026PTC294027).
