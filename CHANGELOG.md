# Changelog

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
