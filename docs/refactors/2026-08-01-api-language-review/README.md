# 2026-08-01 — Public-language and spacing review

Status: **recommendation recorded; source implementation pending**.

No 1.0 contract has been merged to `main`, tagged, or published. This review therefore treats every public name as changeable and does not propose aliases or a migration layer.

## Question

Can a developer who does not know HTML/CSS read a faux-ui application in plain English, while developers who do know the web avoid assuming unsupported CSS/DOM behavior?

The review also decides whether the foundation needs deterministic space outside a component in addition to space inside it and space between sequential children.

## Reading order

1. [Findings](01-findings.md) — public-vocabulary inventory, readability test, false expectations, and outer-spacing semantics.
2. [Three naming variants](02-naming-variants.md) — complete alternatives, examples, and comparison.
3. [Decision](03-decision.md) — selected language, exact rename map, spacing result, and implementation order.

## Result in one paragraph

The recommended direction is **Variant A: plain spatial English**. Keep universally clear `Text`, `Row`, and `Column`; replace the mixed CSS/engine dialect with `Area`, `ScrollArea`, `Action`, `spaceInside`, `spaceOutside`, `spaceBetween`, axis-specific `widths`/`heights`, `content`, and `share()`. Rename misleading `hotkey` to `keyHint`, remove ineffective container alignment props, use one full-word direction vocabulary, and rename host subpaths to `/browser` and `/terminal`. The existing source still uses the old names until the decision is implemented end to end.
