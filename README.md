![SchoolKick demo: overview, teacher attendance, family view and import checks](docs/screenshots/schoolkick-demo.gif)

# SchoolKick

Open-source school attendance software that keeps a clear history of every correction.

[Live demo](https://schoolkick.nodedr.com/) · [Features](https://schoolkick.nodedr.com/features) · [Documentation](https://schoolkick.nodedr.com/docs) · [Installation](https://schoolkick.nodedr.com/get-started) · [AI access](https://schoolkick.nodedr.com/ai) · [Changelog](CHANGELOG.md) · [Security notes](https://schoolkick.nodedr.com/security) · AGPL-3.0-only

---

SchoolKick is a self-hosted school attendance and learner-record system. Teachers can take a class register from a phone, guardians can see linked learners in a browser, and school staff can review attendance, imports and recent changes in one place.

It is an early release (v0.3.0). Review the [current scope](https://schoolkick.nodedr.com/roadmap), [security notes](https://schoolkick.nodedr.com/security) and [privacy notice](https://schoolkick.nodedr.com/privacy) before using real learner information.

## At a glance

| | |
|---|---|
| Product | School attendance, learner records and family access |
| Hosting | Your server, with PostgreSQL |
| License | [GNU AGPL v3.0 only](LICENSE) |
| Current release | 0.3.0 |
| Browser app | [schoolkick.nodedr.com](https://schoolkick.nodedr.com/) |
| Install guide | [Choose a setup](https://schoolkick.nodedr.com/get-started) |

## See SchoolKick

### School overview

![SchoolKick dashboard showing today's attendance, class registers and items needing attention](docs/screenshots/dashboard-desktop.png)

### Teacher attendance on a phone

![SchoolKick teacher roster on a phone](docs/screenshots/teacher-roster-mobile.png)

### Family view

![SchoolKick guardian view on a phone](docs/screenshots/guardian-mobile.png)

All names and records in screenshots are fictional demonstration data.

## What is included

- **Class attendance:** mark unmarked learners present, record exceptions and save a register from a responsive browser interface.
- **Kept correction history:** changing a submitted mark requires a reason and preserves the original entry, new entry, actor and time.
- **Guardian browser view:** show a guardian only the learners linked to their account, with recent attendance history.
- **CSV learner import:** review row and column validation before import; invalid input does not create a partial set of records.
- **School overview:** review attendance totals, missing registers, recent corrections and school trends.
- **Fee management:** numbered invoices, cash or UPI QR payments confirmed by the school office, receipts, refund approval and payment history. Card and bank payment provider integrations are not available yet.
- **Exam registration:** publish subjects, registration windows, attendance eligibility and fees; families can register learners and view hall tickets. Marks entry and result release are not available yet.
- **Self-hosted data:** run the app with a PostgreSQL database you administer.

### Current release limits

Card or bank payment-provider integration, marks entry and result release, messaging, timetable, password reset by email, teacher QR check-in, learning content and native mobile apps are not available yet. See the [release roadmap](https://schoolkick.nodedr.com/roadmap) for the current list.

## Install

Choose the path that matches your setup. The [installation guide](https://schoolkick.nodedr.com/get-started) includes requirements, current test status and follow-up steps.

### One command (Docker)

Requires Bash, Git, curl, OpenSSL and Docker with Compose v2. On Windows, use WSL with Docker Desktop integration.

```sh
curl -fsSL https://schoolkick.nodedr.com/install.sh | bash
```

This builds the current main branch, generates a database password, and starts the app at http://localhost:3847/app/. It creates a new `schoolkick` directory and refuses to overwrite an existing installation. Review [the script](packaging/install.sh) before running it.

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

SchoolKick processes learner, guardian, staff, account and attendance information in the PostgreSQL database configured by the operator. The project does not include advertising trackers or analytics in the public site. The app uses a protected session cookie. A school operator remains responsible for HTTPS, account access, backups, retention, notices and local requirements for children's information.

This early release has **not** had an independent security, accessibility or legal audit. Do not use the hosted demonstration for real learner information. Read the [privacy notice](https://schoolkick.nodedr.com/privacy), [accessibility statement](https://schoolkick.nodedr.com/accessibility), [security notes](https://schoolkick.nodedr.com/security) and [legal information](https://schoolkick.nodedr.com/legal) before deployment.

Report suspected vulnerabilities privately using the contact described in [SECURITY.md](SECURITY.md). Please do not file an undisclosed vulnerability in a public issue.

## Technology

- **Web application:** React, TypeScript and Vite
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

## License

SchoolKick is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**. See [`LICENSE`](LICENSE). If you run a modified version for other people over a network, the license requires you to offer those users the corresponding source code. The SchoolKick name and logo are not granted under the software license. See [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) for the separate commercial licensing contact.

---

Built for a clearer school day. Maintained by [Raktim Ranjit](https://www.raktimranjit.com/).
