# 2026-08-01 — Public-language and spacing review

Status: **implemented in the unreleased 0.9.1 candidate**.

No package version had been published, so the review changed the public surface directly without aliases or a migration layer. Version 0.9.1 remains pre-1.0 so real-use evidence can still refine the contract.

## Question

Which vocabulary is shortest and easiest for the likely React + TypeScript user to read, distinguish, and remember without claiming behavior faux-ui does not provide?

The review also decides whether the foundation needs deterministic space outside a component in addition to padding and gap.

## Reading order

1. [Findings](01-findings.md) — public-vocabulary inventory, readability problems, false expectations, and spacing evidence.
2. [Three naming variants](02-naming-variants.md) — initial complete alternatives and comparison.
3. [Decision](03-decision.md) — final audience-adjusted language, follow-up `Rows` / `Columns` choice, spacing result, and implemented contract.

## Result

Keep the familiar React/TypeScript surface, `tracks`, `auto`/fraction tracks, `padding`, `gap`, `x`/`y`, `/dom`, `/tui`, and existing lifecycle names. Use plural `Rows` and `Columns`: children of `Rows` occupy row tracks whose numbers are heights; children of `Columns` occupy column tracks whose numbers are widths. Rename display-only `hotkey` to `keyHint`, use `focusStyle` / `hoverStyle`, replace paired text alignment props with `Text.align={{ x, y }}`, remove ineffective Box alignment, and add no outer-spacing feature.
