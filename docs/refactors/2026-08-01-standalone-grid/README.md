# 2026-08-01 — Standalone Grid extension

Status: **implemented; unreleased**.

This dossier records why a CSS-grid-like component could not be implemented faithfully as only nested one-axis wrappers, the minimal public layout extension added to the foundation, and the completed standalone `@faux-ui/grid@0.1.0` package.

## Reading order

1. [Constraints](01-constraints.md) — external-package boundary and composition limits.
2. [Design](02-design.md) — selected `/layout`, Grid/GridItem, algorithm, package, and Skill design.
3. [Result](03-result.md) — delivered surface, package contents, and verification.

## Result

`@faux-ui/grid` is optional and independently publishable. It imports only React, `@faux-ui/ui`, and `@faux-ui/ui/layout`; UI and React are peers. It supports deterministic fixed/auto/fraction tracks, `repeat()`, source-ordered automatic placement, explicit numeric placement, two-axis spans, implicit `auto` tracks, independent gaps, overlap, and clipping. `GridItem` is only a placement-aware Box; text and scrolling compose through core `Text` and `ScrollView`. Its tarball includes source, README, changelog, license, and one Agent Skills-standard `faux-ui-grid` skill exposed through Pi, Codex/ChatGPT, and Claude Code metadata.

No package was tagged or published.
