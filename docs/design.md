# CampusOS — Product design system and experience brief

**Audience:** school and college administrators, teachers, families, adult learners, coaching students, and support staff.  
**Product job:** help each person complete today’s education task quickly, understand what changed, and trust the record.  
**Design posture:** quiet confidence. A real working tool shaped by the Mavri and Brands Mac projects: restrained blue, paper-white surfaces, direct language, clear structure, and purposeful motion. Do not transplant either project’s logos, product copy, or unique visual assets.

## 1. Design read

Education software is used between classes, during fee collection, at a school gate, and at home on a small phone. The same interface must give a teacher a fast roster, a guardian an understandable child view, a registrar an accurate record, and a finance officer an auditable ledger. The design risk is operational overload: many modules can easily become a noisy dashboard of cards, charts, badges, and alerts. Resist that. Every home screen should answer “What matters for me now?” and give a clear next action.

## 2. Reference alignment with existing projects

Before implementation, inspect these existing products and their current local design tokens/components:

- `/home/raktim-ranjit/mavri-src/docs/DESIGN.md`
- `/home/raktim-ranjit/mavri-src/web/src/styles.css`
- `/home/raktim-ranjit/acweb/brandsmac.com/assets/site.css`
- `/home/raktim-ranjit/Documents/Codex/2026-10-25/referenced-chatgpt-conversation-this-is-an-2/outputs/design.md`

Retain the shared design language: restrained blue action color, white and cool-neutral surfaces, compact readable typography, generous spacing where it improves scanning, thin separators, visible keyboard focus, concise Indian/British English, responsive behavior, inline SVG iconography, and animations that communicate state. Build a small tokenized system. Do not imitate unrelated site layouts or copy product-specific design assets. The implementation prompt must include a short source-pattern → retained-rule alignment table before UI coding.

## 3. Product structure and navigation

### Shared shell

- A persistent top bar with institution/campus context, academic cycle/term, global search or command access, help, notification inbox and account menu.
- A compact left navigation on desktop with sections based on role and enabled modules. Use labels and icon+text; icons alone only in a collapsed state with accessible names.
- A mobile bottom/navigation drawer with a small set of primary destinations and a visible “More” route. Do not squeeze desktop sidebars onto phone widths.
- A context header on each page: section title, one-sentence purpose where useful, current campus/course/date filters, and one primary action.
- A consistent right-side detail panel for inspecting/editing a record without losing list context, where it works on desktop; full-screen route on mobile.

### Navigation principles

- Avoid 30 independent portals. One person account can switch context between their staff role and guardian role, with the active role always visible.
- Keep roles and data scope obvious. A guardian sees a child switcher; teachers see only assigned groups; finance views never imply a balance is verified when it is pending.
- Use progressive disclosure: common actions first, advanced setup in a labeled settings area.
- Show active campus, term, cohort and filters in page context; preserve them on back navigation.

### Role homes

**Teacher:** Today’s schedule, roster attendance action, work needing review, message follow-ups, substitute/leave state. Use an agenda plus compact actionable lists rather than four rows of metric cards.

**Guardian:** learner switcher, next school event, attendance status, one useful notice, due fee with status and receipt, current learning update. Allow a web link; no app installation gate.

**Learner:** next class, continue course, next deadline, feedback and help. Age-aware; avoid streak pressure, public ranks, or engagement bait.

**Administrator/registrar:** admissions queue, records to complete, schedule conflicts and exceptions. Lists with bulk preview and clear ownership.

**Finance:** unsettled payments, items requiring reconciliation, refunds awaiting action, cash/settlement close. Avoid celebratory financial gamification.

## 4. Visual direction

### Core palette

Use a neutral canvas with blue as the single primary action/accent, matching Mavri’s calm product style and the Brands Mac brand’s clear blue usage. Institutions can configure a logo and an accent only after contrast checks.

| Token | Default | Use |
|---|---|---|
| `canvas` | `#F5F7FA` | App background |
| `surface` | `#FFFFFF` | Main work surface, form and table areas |
| `surface-muted` | `#EEF2F6` | Subtle selected/secondary surface |
| `ink` | `#17212F` | Primary content |
| `ink-muted` | `#536174` | Secondary content; maintain WCAG contrast |
| `line` | `#DCE3EB` | Dividers, input boundaries, table rules |
| `brand` | `#2459A6` | Primary action, links, selected navigation |
| `brand-hover` | `#194987` | Hover/pressed interaction |
| `focus` | `#F2A900` | High-visibility keyboard focus ring |
| `success` | `#20734A` | Confirmed states only |
| `warning` | `#875700` | Needs attention; pair with label/icon |
| `danger` | `#B42318` | Destructive or failed state; pair with text |
| `info` | `#2A5E8A` | Neutral informational state |

Blue and status colors must be checked for contrast on all backgrounds and in high-contrast settings. Never convey state through color alone. Do not use colored dots without a readable label or accessible text.

### Dark theme

Support a complete dark theme using semantic tokens rather than per-component overrides. Follow the system preference by default and offer a user-level setting; never force an institution-wide dark palette that reduces readability. Suggested starting surfaces: canvas `#101722`, surface `#17212F`, muted surface `#202D3D`, primary text `#F3F6FA`, secondary text `#BCC7D4`, borders `#344255`, and a lightened blue action `#8AB4F8`. Recheck status and focus colors for contrast, charts, QR camera mode, receipts and printable pages. `forced-colors` and high contrast must remain usable.

### Type

- System UI sans-serif stack for speed and continuity with owner’s other products; include Noto Sans and script-appropriate fallbacks for Hindi, Bengali, Spanish, Catalan, Galician and Basque.
- Body 15–16px desktop and 16px mobile; compact dense tables may use 14px with adequate line height and zoom/reflow support.
- Page heading 24–30px, section headings 18–21px, compact labels 12–14px. Use weight and spacing to build hierarchy, not many colors.
- Tabular numerals for amounts, attendance counts, IDs and dates where available. Never truncate currency amounts or dates into ambiguity.
- Avoid all-caps labels except familiar short abbreviations.

### Geometry and surfaces

- 8px spacing base; denser table rhythm on desktop and touch-friendly row actions on mobile.
- 8–10px control/surface radius. Use no pill-shaped everything, no over-round dashboard panels.
- Hairline borders and restrained shadow only for floating menus/dialogs. Avoid glass blur, decorative gradients, fake depth and generic stock illustrations.
- Use inline SVG from a consistent icon set. Icons must have stable stroke weight, no emoji replacing core controls.
- Use real sample names and records only in clearly labeled demo environments. Never imply a real school partnership or student outcome without evidence.

## 5. Information display and key patterns

### Tables and lists

- Sticky table headers when useful; clear sort state; column chooser for staff; persistent filters; pagination that announces result count; downloadable filtered export with permission check.
- First column identifies the record; actions live in a predictable final column or row menu. Avoid hover-only actions.
- Bulk operations require a selection summary and preview. Destructive or financial actions require confirmation, reason where appropriate, and audit event.
- Empty state explains the absence and offers one useful next action. Do not fill empty space with decorative artwork or made-up activity.
- Loading state uses stable skeletons for content shape; do not shimmer indefinitely. Error states preserve user input and offer retry or a clear contact path.

### Forms and dialogs

- Labels persist above inputs; examples and validation are local and specific. Do not use placeholder text as the sole label.
- Group long setup by task and save progress. Show required vs optional, privacy implications, and why sensitive data is needed.
- Draft and autosave where loss would be costly. Unsaved-change warning only when there are actual unsaved edits.
- Confirmation copy states the exact action and effect (“Issue refund of £… to …”), not generic “Are you sure?”.

### Gradebook and learner visibility

- Support fast keyboard navigation and safe paste/import for a roster; keep row/column headers visible, preserve focus after save, and announce validation errors without moving the user unexpectedly.
- Each grade item shows draft/published/hidden state, due date, grade scale, and whether learners can view feedback. “Preview as learner” must show the same effective visibility and never grant extra data access.
- Mark sync state and the source system for imported grades. Conflicts require comparison and human selection; do not silently overwrite. Provide accessible print and current CSV/XLSX export if supported.

### Status and trust

Payment states distinguish `Due`, `Checkout started`, `Payment processing`, `Paid`, `Partially paid`, `Failed`, `Refund pending`, `Refunded`, and `Needs reconciliation`. Attendance distinguishes the institution’s codes. Every state includes timestamp/source and next step where useful.

Corrections to academic, attendance and finance records appear as a linked history with actor, reason, original value, changed value, timestamp and approval. Never suggest a saved amount is settled until the provider/ledger confirms it.

### Search and command access

- Search respects current tenant/role; types show source and context. Do not expose sensitive result previews to unauthorized roles.
- Keyboard shortcut palette is optional and discoverable; every action still works without it. Avoid hidden gestures.
- Result lists are grouped by learners, courses, messages, fees and settings; recent items are user-local and clearable.

### QR attendance

- Gate mode uses a large legible camera frame, session/school name, active window countdown, explicit connection/sync state and reachable manual roster entry.
- A successful scan gives a short confirmation with learner name/photo only when institution policy permits, class and timestamp. Staff can correct a wrong match and must be able to undo an accidental scan with a reason.
- Failure states distinguish expired QR, wrong session, duplicate scan, offline queue, camera permission and unknown learner. Provide accessible manual fallback, never a flashing red-only message.

### Payments

- Show fee description, itemized amount, due date, scholarship/discount and policy link before checkout. Explain which payment methods are available and when status will update.
- After checkout, show pending until a verified provider event confirms it. If the amount may have been debited but status is unresolved, tell the payer not to submit again yet, show the provider reference and support case, and keep an update timeline. Receipt is downloadable and printable with accessible text.
- Refund, cancellation and recurring mandate screens state timeline, amount, remaining balance and how to stop future debits.

### Communication

- Inbox separates urgent operational alerts from routine announcements and direct conversation, with shared search and filters.
- Parent can control channels and digest frequency. Critical alerts may use fallback channels set by institution.
- Message composer shows audience count and recipient scope; translation appears as a reviewable draft; attachments show file size and upload state. Preserve a draft after network loss.
- Respect teacher availability; never imply immediate response outside configured hours.

## 6. Motion and animation specification

Motion should make state easier to understand and should not increase pressure or delay work.

| Interaction | Motion | Limit and behavior |
|---|---|---|
| Button press/hover | Color and 1px surface response | 120–160ms, no scale bounce |
| Menu/popover | Fade + 4px translate | 140–180ms, anchor remains clear |
| Route change | Subtle content fade | 120–180ms, no whole-screen transition |
| Save/sync | Small inline progress then check/status label | Keep action usable; label state in text |
| Attendance scan | Camera guide pulse only while scanning | Stop when captured/paused; no persistent ambient loop |
| Attendance confirmation | Brief checkmark draw/fade | 180–240ms; also announce with text/screen reader |
| Progress | Static progress bar/ring update | Avoid confetti and reward fireworks |
| Skeleton | Soft tonal pulse | Roughly 1.0–1.3s cadence; stop when content loads |
| Dialog | Fade and slight vertical shift | Focus trap and restore focus; no parallax |

Respect `prefers-reduced-motion: reduce`; remove nonessential movement and transitions. Never autoplay audio/video, use scroll-triggered reveal, bounce/elastic movement, endless decorative animation, or animation as the only state cue. No celebratory confetti for attendance, grades, fee collection, or student milestones.

## 7. Responsive behavior

### 375px

- Single-column flow, no horizontal body scroll. Forms become vertical; tables become record cards or focused column views with access to all fields. Primary actions remain reachable without covering content.
- Bottom navigation or simple menu, thumb-friendly controls (target at least 44×44 CSS px where practical), learner switcher that does not consume the whole header.
- Camera/scanner controls, payment details, attachment upload and status should work with mobile browser constraints.

### 768px

- Two-column layout only when both columns remain readable; collapsible sidebar; tablet roster density that permits touch; modal panels become full-height sheets where appropriate.

### 1440px

- Useful max-width on forms and reading content; tables may use available width; avoid stretching paragraphs across the screen. Sidebar and detail panel can coexist for high-workflow tasks.

Support browser zoom/reflow to 200% and dynamic text size without hidden controls. Do not use fixed heights for important copy or forms.

## 8. Accessibility and localization

- Target WCAG 2.2 AA, including keyboard order, visible focus, contrast, text resize, accessible name, error identification, status announcements and touch target size.
- Semantic headings/landmarks; skip link; screen-reader labels; announce async save/attendance/payments; focus management in dialogs and route changes.
- Captions/transcripts for learning media, alternative content, accessible PDF guidance and keyboard-accessible quiz formats.
- Externalize every string. Support long translations, plural rules, locale-specific punctuation and right-to-left layout readiness. Do not use flags as language identifiers.
- Use localized dates, time, decimal/grouping, currency and calendar through locale libraries; display timezone for cross-region schedules.
- Avoid red/green-only distinctions, motion-only cues, text embedded in images, and “click here.”

## 9. Product voice and content patterns

Voice: calm, precise, warm. Prefer short sentences and specific next steps. Use straightforward English; locale packs can adapt spelling and terminology.

- Good: “Payment received. Receipt #F-1048 is ready.”
- Good: “Attendance saved for 28 learners. 1 scan needs review.”
- Good: “This message is scheduled for 4:30 pm IST. Edit or cancel.”
- Avoid vague “Something went wrong.” State what failed and what to try.
- Avoid pressure copy: “Your child is falling behind!”, fake urgency, streak shame, “unlock premium” prompts in guardian/learner flows, or public rank comparisons.
- Avoid unsupported claims, including pass rates, success stories, user counts and “AI-powered” labels with no clear user benefit.

## 10. UI states required for every important feature

Design loading, empty, populated, partial, error, offline, permission denied, expired session, disabled, success, pending, conflict, retry, and destructive confirmation states. Include long names, multiple guardians, siblings, a learner who is an adult, absent and unverified payment, no-photo, large roster, translated text, keyboard-only path and narrow viewport examples.

## 11. Design review checklist

- Does the screen serve a real user and one clear job?
- Can the person understand institution, role, learner, class, date and status at a glance?
- Is there one primary action? Does its label state the outcome?
- Does the page avoid duplicate data entry and excessive notification pressure?
- Is the data scope visible and least-privilege?
- Can a user recover from a mistake or network failure without losing work?
- Are loading, empty, error, offline, success, pending and permission states designed?
- Does the interaction work by keyboard, touch, screen reader, reduced motion, 200% zoom, 375/768/1440 widths?
- Does the design align with the user’s own Mavri/Brands Mac conventions through measured reuse, not imitation?
- Are claims and demo content clearly truthful?

## 12. Implementation note

Treat the table above as the starting design contract, then inspect the actual referenced projects before implementation. Extract existing tokens and component patterns, build accessible tokens/components, and show the user at least one realistic teacher roster, guardian overview, and fee reconciliation screen before expanding every module. The production UI must be exercised in a browser at phone, tablet, and desktop sizes and reviewed with keyboard/accessibility checks before release.

## 13. Implemented design decisions (update 2026-11-03)

Evidence base: the four referenced files were read; findings are in the repository's `docs/design-alignment.md`. Screenshots at 375/768/1440 px are in `docs/screenshots/` (`fees-*`, `receipt-mobile`, `reconcile-desktop`), produced by `e2e/fees.mjs` with synthetic data.

**Palette.** The app now uses the blue brand tokens (`#2459a6` light, `#8ab4f8` dark) with neutral surfaces, matching section 3; the public marketing site keeps its own forest/parchment/coral identity. Measured contrast (WCAG formula, 2026-11-03): white on `#2459a6` 6.87:1; `#101722` on dark brand `#8ab4f8` 8.53:1; `--ok #20734a` on `#e6f4ec` 5.13:1; `--bad #b42318` on `#fdecea` 5.75:1; dark `#6fcf97` on `#16301f` 7.48:1; `#ff9a8f` on `#3a1c19` 7.55:1; ink on canvas 15.11:1. Muted ink and focus ring were not re-measured; a specialist accessibility audit is still pending.

**Logo.** Supplied PNG only (`/app/icon-192.png`, round, `border-radius:50%`). The earlier inline SVG mark in the shell was removed (upstream commit e81945e).

**Money and trust states (implemented).**
- Invoice states: Due, Overdue, Partly paid, Paid, Cancelled. Payment states: Checkout started, Waiting for the bank to confirm, Paid, Not completed, Under review by the school, Reversed. Each is a glyph plus a word in a `.pill`.
- "Paid" appears only after a verified provider message or an authorised staff entry. The return page reads state from the server and never assumes success.
- While money may have moved (processing, under review) the family sees a bordered notice: **Do not pay again yet**, the provider reference, start time and the school's latest note, owner and expected date. The server also refuses a second online payment for that invoice.
- Receipts are immutable snapshots; refunds appear beneath as history, with net paid stated. Print layout hides navigation.
- Amounts are integer minor units on the wire; formatting uses `Intl.NumberFormat` for the invoice currency, tabular numerals, right-aligned in tables.

**Responsive patterns used.** 375 px: top bar plus bottom tab bar (Today, Fees for parents; Fees, Reconcile for finance); invoices as cards; staff table in an intentional horizontal scroll area (`.scroll`, `position:relative` so visually hidden text cannot widen the page). 768 px: same table, bottom bar until 860 px. 1440 px: compact sidebar and full table with inline actions. Verified no horizontal page scroll at each width.

**Component inventory.** AppShell, Badge/pill, Status banner, Empty, Loading, PageHead, chips (filter with counts, `aria-pressed`), invoice card, invoice table row with inline record/void form, reconciliation card, checkout (sandbox), receipt paper.

**State coverage.** Done: loading, empty, error, online-off notice, permission-denied (server 403/404), conflict (409 messages shown verbatim), success confirmation that survives the form closing, processing/under-review. Not yet: offline queue for fees (attendance has it), expired-session prompt, high-contrast and RTL verification, long-translation tests, screen-reader pass. These are open, not claimed.

**Still to apply from this brief:** dashboards per role beyond the current overview, child switcher, timetable, inbox, QR check-in, i18n, `/countries` page. See `docs/traceability.md`.
