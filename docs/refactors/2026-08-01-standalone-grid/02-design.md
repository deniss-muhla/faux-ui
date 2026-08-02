# Design

## Package boundary

`@faux-ui/grid@0.1.0` is a normal workspace only for development. Its publish contract matches an outside package:

- peer dependencies: `@faux-ui/ui ^0.9.1` and React 19;
- no direct runtime dependencies;
- source imports only documented package entrypoints;
- independent manifest, exports, version, README, changelog, and license;
- declaration/JavaScript/source maps plus reference TypeScript source in the tarball;
- clean consumer installs packed UI and Grid tarballs together.

## Public layout extension

`@faux-ui/ui/layout` exports:

- `Layout`;
- `LayoutEngine`;
- preferred/exact input-output geometry types.

`preferred(children)` returns intrinsic content size. `layout({ size, children })` returns one content-local `Rect` per child and optional content size. The semantic engine validates and converts these to normal absolute layout nodes.

## Grid API

`Grid` owns only two-dimensional geometry:

- `columns` and optional `rows` track templates;
- implicit tracks fixed to the meaningful `auto` default;
- one sparse row-major automatic placement order;
- integer or independent x/y gap;
- ordinary Box surface/event props.

`GridItem` is a direct-child placement/container marker with:

- one-based `row` / `column`;
- `rowSpan` / `columnSpan`;
- ordinary Box appearance/events/accessibility.

Ordinary semantic children auto-place without a wrapper. Arrays and fragments are flattened while keys are preserved. Text alignment/style/overflow stays on explicit `Text`; scrolling composes through `ScrollView`. Grid-specific area, alignment, text, and scrolling shortcuts were removed before release.

## Algorithm

1. Parse and validate tracks, gaps, and item metadata.
2. Place definite items first and reserve their occupied cells.
3. Auto-place remaining items in source-ordered row-major positions, creating bounded implicit tracks.
4. Compute Unicode-aware intrinsic auto/fraction contributions from child preferred sizes, including spans.
5. Resolve concrete fixed/auto/fraction tracks from the explicit content-frame size.
6. Convert each occupied area, including internal gaps, to one continuous rectangle.
7. Return stretched item frames in source order so paint, overlap, and focus behavior remain deterministic.

## Agent Skill

`skills/faux-ui-grid/SKILL.md` follows the Agent Skills standard and remains the only instruction source. Pi discovers it through `package.json#pi.skills`; Codex/ChatGPT and Claude Code use thin `.codex-plugin/plugin.json` and `.claude-plugin/plugin.json` manifests. It teaches agents when Grid is justified, when core sequences are clearer, canonical placement patterns, interaction rules, and a review checklist.
