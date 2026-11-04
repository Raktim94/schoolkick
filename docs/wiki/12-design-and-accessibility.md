# 12. Design and accessibility principles

Canonical: [`../design.md`](../design.md) (design system and brief) and [`../design-alignment.md`](../design-alignment.md). Note: parts of `design.md` are an aspirational brief; section 13 records what is implemented.

Principles: calm and plain-language; one primary action per screen; role-specific homes; status never by colour alone; payment states that never imply "paid" early; no streaks, ranks or pressure copy; motion only to explain state, off under `prefers-reduced-motion`.

Accessibility target: WCAG 2.2 AA (2.2 adds Focus Not Obscured, Dragging Movements, Target Size (Minimum), Consistent Help, Redundant Entry, Accessible Authentication). **Status: partial.** axe-core automated checks on some screens; no manual screen-reader or keyboard-only record; no specialist audit. Do not state conformance.

Verification standard for UI work: real browser at ~375, 768 and 1440 px; light and dark; keyboard-only pass; error and empty states; reflow at 200% zoom. Page-level specs: [16](16-page-audit.md).
