# 16. Page-by-page audit and UX specification

**Method and limits.** Pages were identified from the route table in `web/src/App.tsx` and the components in `web/src/*.tsx` (read 2026-11-04). Existing screenshots in `docs/screenshots/` were used as evidence of appearance. **This review did not run the app in a browser** (no database/Docker access), so state coverage below is "present in code/screenshots" or "not evidenced", not freshly observed. Re-verify at 375/768/1440 px before changing any page.

## Design read
**Users:** a teacher between lessons on a phone; a registrar and finance officer at a desk; a guardian at home on a small phone, often anxious about money or absence. **Job per page:** one task, one primary action. **Design risk addressed:** operational overload (many modules → noisy dashboards). Hence role homes with a short "what needs me now" list, plain status words, and no decorative metrics. The signed-in app keeps its existing blue/neutral token system (`docs/design.md`); no new visual language is introduced.

## Existing pages
Legend for states: L loading · E empty · Err error · P permission-denied · S success · Pend pending/processing · C conflict. ✔ = evidenced in code/screenshot; ? = not evidenced.

| Page (route) | Role(s) | Purpose / primary action | Data scope | Mobile pattern | States | Gaps to fix next |
|---|---|---|---|---|---|---|
| Sign in / Create institution (`/`, signed out) | All | Sign in, or create the first owner | Public | Single column | Err ✔ busy ✔ | No password reset, no MFA; `ALLOW_SIGNUP` open by default; no offline notice evidenced |
| Overview (`/`) | Owner, registrar | See today's attendance, missing registers, recent corrections | Institution | Cards + chart with table view | L E ✔ (charts have keyboard/table view) | Not role-tailored beyond owner/registrar; no "needs me now" list |
| Today (`/`) | Teacher | Open an assigned class register | Assigned classes | Tab bar | L E ✔ | No timetable; no leave/messages |
| Attendance (`/classes/:id`) | Teacher, staff | Save register; correct with reason | One class/day | Roster list | L Err S ✔; C ? | Offline save not supported; no period attendance |
| Classes (`/classes`) | Owner, registrar | Create class, assign teacher, enrol | Institution | Under "More" | E ✔ | Bulk enrol absent |
| Learners (`/learners`) | Owner, registrar | Add learner / import CSV with preview | Institution | List | Err ✔ dry-run ✔ | No search/filter evidenced; no guardian restrictions |
| People (`/people`) | Owner, registrar (owner adds) | Create staff/guardian accounts | Institution | | ? | No invite email; no deactivate flow evidenced |
| Audit log (`/audit`) | Owner | Review latest 200 events | Institution | Table | ? | No filter/export; capped at 200 |
| Fees – staff (`/fees`) | Owner, registrar(read), finance | Create invoice, record cash, void, bulk-invoice class | Institution | Cards on phone; table scrolls | L E Err S Pend ✔ (design.md §13) | UPI counter QR flow needs keyboard re-check |
| Reconciliation (`/reconciliation`) | Owner, finance | Settle/fail unresolved payments with evidence | Institution | Cards | ✔ | |
| Refunds (`/refunds`) | Owner decides, finance requests | Approve/reject | Institution | | ? | Confirm copy states exact amount |
| Receipt (`/receipts/:id`) | Payers, staff | View/print/PDF | One payment | Print layout | ✔ | Non-Latin/Devanagari scripts don't render in PDF |
| Guardian home (`/`) | Guardian | See linked learners' recent attendance | Linked children | Today tab | L E ✔ | No child switcher beyond list; no next-event/notice |
| Guardian fees (`/fees`) | Guardian | Pay or see status; "Do not pay again yet" | Linked, `can_pay` | Cards | Pend ✔ | |
| Checkout (`/pay/:id`) | Guardian | Complete payment (test provider) | One payment | | Pend ✔ | Real provider absent |
| Guardian exams (`/exams`), Hall ticket | Guardian | Register child; view ticket once approved | Linked | | ✔ | No results |
| Staff exams (`/exams`) | Owner, registrar | Create exam; approve registrations | Institution | | ? | |
| 404 | All | Recover | – | | ✔ ("This page does not exist") | |
| Finance home (`/`) | Finance | Fees list (same screen as `/fees`) | Institution | Fees, Reconcile, Refunds tabs | ✔ | No "unsettled first" home |

## Cross-cutting findings
1. **No campus, term or academic-period selector** anywhere; the shell shows only institution and active role.
2. **Role homes are thin:** finance and registrar land on list screens, not on "what needs me". Highest-value design change: a short ordered worklist per role (unreconciled payments; missing registers; pending registrations).
3. **Offline/expired-session/conflict states** are not evidenced beyond error messages; the service worker caches only the shell.
4. **Accessibility:** automated axe checks only on fees/exams. Needed: keyboard-only walk of each page above, screen-reader pass, 200% reflow, WCAG 2.2 target size and focus-not-obscured checks on the bottom tab bar.
5. Design doc `docs/design.md` is still titled with the former name "CampusOS".

## Specification template for every new page (roadmap)
Every new page must document, before code: user · purpose · key task · data scope and required permission · nav placement · desktop/tablet/mobile behaviour · loading, empty, populated, partial, error, offline, permission-denied, pending, conflict, success and destructive-confirmation states · keyboard and screen-reader behaviour, validation and focus management · sensitive-data visibility.

### Planned pages (specs summarised; all **Planned**, none exist)
| Page | User / task | Scope & permission | Notes |
|---|---|---|---|
| Role homes | Each role: see what needs action now | Role-scoped | Ordered worklist + one primary action; no metric-card grid |
| Account recovery / MFA | Any: regain access safely | Self | No account-existence leak; accessible authentication (WCAG 3.3.8) |
| Learner record (detail) | Registrar: consent, contacts, restrictions | `registrar`; health only to named role | Right-side panel on desktop, full route on mobile; correction history |
| Marks entry | Teacher: enter and submit marks | Assigned subject | Grid with keyboard nav, draft/published states, moderation by registrar |
| Results / report card | Guardian, learner | Linked | Release only after approval; print layout |
| Inbox | All | Role-scoped | Urgent vs routine; audience count before send; draft saved offline |
| Admissions queue | Registrar | Staff | Applicant data minimised; offers need approval |
| Timetable | Teacher, learner, guardian | Role-scoped | Day agenda on mobile, grid on desktop |
| Payroll, HR | HR/payroll only | Separate permission | Versioned rule sets, two-person approval |
| Transport & GPS | Operator; guardian sees own child's bus only during trips | Strict | Stale-data and permission-denied states mandatory |
