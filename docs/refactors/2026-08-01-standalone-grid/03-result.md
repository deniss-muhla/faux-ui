# Result

## Delivered

### Foundation

- Added public browser-safe `@faux-ui/ui/layout` subpath.
- Added pure preferred/exact layout callback types.
- Extended semantic boxes with an optional mutually exclusive custom engine.
- Validated callback shape, child count, content size, and every integer rectangle.
- Preserved canonical clipping, scene painting, events, scrolling, and DOM/TUI projection.

### Standalone package

- `@faux-ui/grid@0.1.0` with UI/React peers and no runtime dependency.
- `Grid`, `GridItem`, `repeat()`, public prop/value types, and runtime validation.
- Fixed, `auto`, and fraction tracks.
- Explicit tracks plus implicit `auto` rows and columns.
- Sparse row-major source-ordered automatic placement.
- One-based placement, row/column spans, overlap, independent gaps, and clipping.
- Ordinary semantic children auto-place; `GridItem` remains only a placement-aware Box container.
- Explicit `Text` and `ScrollView` composition instead of Grid-specific text/alignment/scroll props.
- 10,000-track-per-axis safety bound.
- Publish metadata, source/declarations/maps, README, changelog, MIT license, one portable Agent Skill, and Pi/Codex/Claude discovery manifests.

## Verification

- Positive and negative TypeScript public API assertions.
- Core custom-layout geometry and malformed-output tests.
- Grid examples for shared tracks, Unicode-aware `auto`, spans, implicit tracks, overlap, focus/press, `Text` alignment, `ScrollView`, fragments, and failures.
- 500 randomized deterministic non-overlapping auto-placement cases.
- Real Chromium Grid rendering/accessibility/keyboard activation through `/dom`.
- Clean packed Grid + UI consumer using only tarballs.
- Bun/Vite browser bundles reject Node/TUI leakage.
- Packed TUI and static scene execution.
- Packed source, peer manifest, Agent Skill frontmatter, Pi/Codex/Claude manifests, and no-internal-import checks.

## Release state

Both packages remain unreleased. UI stays at 0.9.1 for evidence gathering; Grid begins independently at 0.1.0. No tag or publication was performed.
