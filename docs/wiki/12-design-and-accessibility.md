# 12. Design and accessibility principles

Canonical: [`../design.md`](../design.md) (design system and brief) and [`../design-alignment.md`](../design-alignment.md). Note: parts of `design.md` are an aspirational brief; section 13 records what is implemented.

Principles: calm and plain-language; one primary action per screen; role-specific homes; status never by colour alone; payment states that never imply "paid" early; no streaks, ranks or pressure copy; motion only to explain state, off under `prefers-reduced-motion`.

Accessibility target: WCAG 2.2 AA (2.2 adds Focus Not Obscured, Dragging Movements, Target Size (Minimum), Consistent Help, Redundant Entry, Accessible Authentication). **Status: partial.** axe-core automated checks on some screens; no manual screen-reader or keyboard-only record; no specialist audit. Do not state conformance.

Verification standard for UI work: real browser at ~375, 768 and 1440 px; light and dark; keyboard-only pass; error and empty states; reflow at 200% zoom. Page-level specs: [16](16-page-audit.md).

## Component system (2026-11-04)
The signed-in app uses source copied from the free tier of [BoardUI](https://www.boardui.com/) (MIT; notices in [`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md)) on Tailwind CSS v4 and React Aria. SchoolKick keeps its own role-aware screens and class names; legacy rules sit in a lower CSS layer (`web/src/styles.css`) so BoardUI styles win, and are removed as screens migrate. Dark mode is the `.dark` class on `<html>` (set from the user's Light/Dark/System choice). A Ctrl/Cmd+K command palette jumps between pages. Pro components are deliberately not used (per-user licence, unsuitable for an open-source repo). Contributors: add components with `npx boardui@latest add <name> -d web` and keep `THIRD-PARTY-NOTICES.md` accurate.
