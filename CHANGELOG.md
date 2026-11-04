# Changelog

## Unreleased

- Added five recorded workflow clips (`docs/gifs/`, re-recordable with `e2e/gifs.mjs`) and a second animated README component; replaced the stale demo GIF. Hero attendance figure now counts up (not under reduced motion); loading states use skeletons; theme choice is a segmented control; CSV import textarea is full width.
- Content-Security-Policy now allows exactly one hashed stylesheet that React Aria injects at runtime (no `unsafe-inline`).
- Redesigned the signed-in app on BoardUI's free, MIT-licensed design system (Tailwind CSS v4, React Aria): floating sidebar, neutral/blue token system with a proper dark mode, pill segmented controls, rounded panels and tables, an avatar account row, and a Ctrl/Cmd+K command palette for pages, theme, role switching and sign-out. All screenshots retaken. Third-party notices added.
- Fixed low-contrast text on the teacher "Take attendance" button, the cramped guardian two-week strip (weekday labels now sit above the marks; present is shown as a check), the unreadable stacked fee actions (now clear expandable panels) and overlapping date labels on the mobile attendance chart.
- Standardized new source, Docker and package configurations on app port 3847; configured host port overrides are preserved.
- Added a current-source one-command installer with generated database credentials, readiness checks and existing-installation protection.
- Expanded the installation page with complete setup commands and the older Debian package’s port distinction.

## 0.3.0 — 2026-11-03

### Added

- Exam registration with subject selection, registration windows, attendance eligibility, fee tracking and hall tickets.
- Office-confirmed UPI QR payment records, receipt verification and refund approval alongside cash payment records.
- A Next.js product website with installation guidance, product documentation, screenshots, privacy, security, accessibility and legal pages.
- AI-readable product guides at `/llms.txt` and `/llms-full.txt`, a public OpenAPI route map and an AI access page that explains privacy boundaries.
- A mobile-first demo GIF, refreshed social preview and GitHub issue forms.

### Changed

- Updated the README with current feature scope, installation steps, screenshots, contribution guidance and the AGPL-3.0-only license.
- Added a GitHub Actions workflow for the web build, type checks and PostgreSQL integration tests.
- Updated public product descriptions for exam registration and office-confirmed payments.

### Limits

- Card and bank payment provider integrations, marks entry, result release, messaging, timetable, email password reset, teacher QR check-in, learning content and native mobile apps are not included.
- The OpenAPI document lists routes and access requirements; request and response schemas are incomplete.
- No independent security, accessibility or legal audit has been completed.
