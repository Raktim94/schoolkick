# Design alignment

Updated 3 November 2026 after inspecting the live Mavri and Brands Mac sites and their local source styles. The public SchoolKick site uses its own forest, paper and coral identity; the signed-in product keeps the shared blue-and-neutral work UI described in the product brief.

| Existing project pattern | Evidence | Shared rule retained | Intentional difference in SchoolKick |
|---|---|---|---|
| Mavri uses an uncluttered paper surface, direct product photography, restrained action color, practical navigation and visible docs links. | `~/mavri-src/docs/DESIGN.md`, `~/mavri-src/web/src/styles.css`, live `https://mavri.nodedr.com/` | Keep generous reading space, a real product screenshot, few competing actions, clear install/docs paths, and a compact system font stack. | Use the SchoolKick forest-green, parchment and coral palette; keep attendance records and families at the centre. |
| Brands Mac uses a clear navigation, large type, deliberate light/dark section contrast, strong photography and a visible mobile menu. | `~/acweb/brandsmac.com/assets/site.css`, live `https://www.brandsmac.com/` | Preserve hierarchy, readable paragraphs, explicit mobile navigation, visible focus, and imagery with a clear subject. | Use a calmer light page and restrained sections instead of the service site's dark hero, rounded controls and bright accent treatment. |
| The prior SchoolKick product brief calls for quiet, task-first screens and warns against overloaded dashboard cards. | PRD and design brief researched in the previous project; not bundled in this repository. | Keep the app on white and cool-neutral surfaces with a restrained blue action color, compact navigation, table-first detail and role-aware links. | Marketing uses a warmer editorial palette; the app remains operational and neutral for daily attendance work. |

No product-specific logo, copy, code or private imagery was copied from the reference projects.

Fees slice (2026-11-03) — additional evidence:

| Existing pattern | Inspected evidence | SchoolKick rule retained | Intentional difference |
|---|---|---|---|
| Tokens as CSS variables at the top of one stylesheet; dark theme redefines the same tokens | `mavri-src/web/src/styles.css` lines 2-23, `--bg --panel --text --muted --line --accent --danger` | Same approach in `web/src/styles.css`; dark theme is token-only | SchoolKick adds `--ok --bad --info-bg` and attendance colours |
| Status never colour-only; badges carry text | Mavri `DESIGN.md` Accessibility | Every invoice and payment state is a glyph plus a word (`Badge` in `web/src/Fees.tsx`) | Adds a bordered "Do not pay again yet" notice, so the warning does not rely on colour |
| Payment QR never says "paid" | Mavri `DESIGN.md` Components | Paid is shown only after a verified provider message or an authorised staff action; the return page only reports state | n/a |
| One easing curve, only transform/opacity animated, `prefers-reduced-motion` turns it all off | Mavri `DESIGN.md` Motion; `styles.css` line 951 | Reduced-motion rule kept; SchoolKick uses almost no motion | No page-change rise, shimmer or drifting orbs |
| Paper is the product; invoice/print designed first | Mavri `DESIGN.md` principle 3 | Receipt is a `.paper` article with an `@media print` layout (hides navigation) | PDF is the browser's Save as PDF for now; no server PDF |
| Marketing: Apple/Google-clean multi-page site, depth on dedicated pages | `brandsmac.com/assets/site.css`; Brands Mac `design.md` section 1 | Public site stays multi-page with a short home | Different art direction (serif display, register hero) |
| Evidence vocabulary SUPPLIED / OBSERVED / PROPOSED / VERIFY / HOLD | Brands Mac `design.md` 1.1 | Used in `traceability.md` status wording (working / partial / planned) and in the country page rules | Three statuses, not five |

The app shell uses the supplied PNG logo; no SVG logo exists in the product.
