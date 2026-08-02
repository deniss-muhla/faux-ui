# 2026-08-01 — Public-language and spacing review

Status: **recommendation recorded; source implementation pending**.

No 1.0 contract has been merged to `main`, tagged, or published. This review therefore treats every public name as changeable and does not propose aliases or a migration layer.

## Question

Which vocabulary is shortest and easiest for the likely React + TypeScript user to read, distinguish, and remember without claiming behavior faux-ui does not provide?

The review also decides whether the foundation needs deterministic space outside a component in addition to padding and gap.

## Reading order

1. [Findings](01-findings.md) — public-vocabulary inventory, readability test, false expectations, and outer-spacing semantics.
2. [Three naming variants](02-naming-variants.md) — complete alternatives, examples, and comparison.
3. [Decision](03-decision.md) — selected language, exact rename map, spacing result, and implementation order.

## Result in one paragraph

The revised recommendation is **Variant C: restrained React/TypeScript vocabulary**. Optimize for the likely React + TypeScript user: keep short familiar components, `tracks`, `auto`/fraction tracks, `padding`, `gap`, `x`/`y`, `style`, `/dom`, `/tui`, and existing lifecycle names. Make only correctness-oriented changes: `hotkey` → `keyHint`, `styleFocus` / `styleHover` → `focusStyle` / `hoverStyle`, and remove ineffective `Box.alignX` / `Box.alignY`. Do not add outer spacing for 1.0. The existing source still uses the old names until this small cutover is implemented end to end.
