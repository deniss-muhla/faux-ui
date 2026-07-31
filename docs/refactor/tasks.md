# faux-ui refactor tasks

> Completed execution record for the clean-break 1.0 reset described in [report.md](report.md). Nothing was released before this replacement, so no compatibility aliases were retained.

## Phase 0 — Lock the reset contract

### R0.1 Product/package boundary — complete

- [x] `@faux-ui/ui` is the only app-author package.
- [x] Root, `/dom`, `/tui`, `/testing`, and JSX runtime subpaths are explicit.
- [x] Root exports no environment-detecting renderer.
- [x] Prototype packages were deleted without aliases.

### R0.2 Bounded design spikes — complete

- [x] Unicode 17.0.0 tables are generated and vendored with no runtime Unicode dependency.
- [x] DOM groups cells into rows/style runs without per-cell elements.
- [x] DOM accessibility uses one application tab stop and hidden labeled semantic actions.
- [x] DOM supports explicit size plus viewport/container fitting through fixed calibration.
- [x] Real Chromium maps actual surface pixels to expected cells.
- [x] Browser bundles contain no Node/TUI imports.

## Phase 1 — Executable parity gates

### R1.1 Serious behavior fixture — complete

- [x] Synthetic queue/detail/metadata/action-bar application added.
- [x] Covers long text, borders, split panes, scroll overflow, semantic tones, Unicode, 11 compact actions, and global hotkeys.
- [x] Contains no consumer code/data or migration obligation.

### R1.2 Valuable behavior preservation — complete

- [x] Fraction remainder invariants retained as deterministic/property tests.
- [x] Clipping and scene ownership/deep hit behavior retained.
- [x] Scroll clamping and paint-only offset semantics retained.
- [x] Focus traversal and direct React handlers retained.
- [x] Generic-renderer/schema/token/named-placement/dead-measurement tests deleted.
- [x] [Testing matrix](../testing.md) maps behavior to executable coverage.

### R1.3 Consumer package tests — complete

- [x] Build and install a packed tarball in a clean temporary project.
- [x] Typecheck shared app plus separate DOM/TUI entries with TypeScript 7.
- [x] Bundle DOM with Bun and Vite.
- [x] Execute packed TUI with fake IO.
- [x] Reject every `node:` or terminal marker in browser output.

## Phase 2 — Single package boundary

### R2.1 Package skeleton/cutover — complete

- [x] All public and internal modules live in `packages/ui`.
- [x] React remains a peer.
- [x] `react-reconciler` is the only direct implementation dependency.
- [x] Core/reconciler/hosts are internal folders, not workspace packages.
- [x] Clean consumer installs exactly one faux-ui package.

## Phase 3 — Semantic kernel

### R3.1 Deterministic cellization — complete

- [x] Pinned UAX #29 grapheme segmentation and East Asian/emoji width lookup.
- [x] Width-2 lead/continuation representation.
- [x] Explicit combining/control/tab/ambiguous policy.
- [x] Clip and start/middle/end ellipsis helpers.
- [x] Complete official Unicode 17 grapheme conformance fixture.

### R3.2 Pure derived layout — complete

- [x] Semantic nodes contain no dirty flags, revisions, dimensions, or caches.
- [x] Preferred and layout trees are immutable derived output.
- [x] Stable internal IDs exist only for reconciliation/focus/scroll.
- [x] Equal tree/root size produces deeply equal layout.

### R3.3 Two-phase one-axis allocator — complete

- [x] Preferred-size pass.
- [x] Parent-to-child exact allocation pass.
- [x] Row, Column, and single-child Box semantics.
- [x] Integer, `auto`, and positive fraction tracks.
- [x] Integer gap/padding/border and start/center/end text alignment.
- [x] Stable overflow and first-to-last remainder distribution.
- [x] Named placement/general grid/spans/min negotiation removed.
- [x] 1,000 randomized geometry/property cases pass.

### R3.4 Scroll geometry — complete

- [x] Viewport frame, content extent, and paint offset are separate.
- [x] Child preferred extent drives scroll content.
- [x] Offset is absent from layout input/output.
- [x] Offsets clamp after tree/size changes.

## Phase 4 — Canonical scene and controller

### R4.1 Shared scene — complete

- [x] Logical cells contain glyph/style/owner/continuation.
- [x] Background, inherited style, text, Unicode, and clipping paint once.
- [x] Borders/titles/fills/dividers/focus/hover/scroll transforms paint once.
- [x] Scene row runs drive DOM; the same cells drive ANSI/testing.
- [x] Arbitrary 256/512 fill constants removed.

### R4.2 Shared interaction — complete

- [x] One controller owns focus, hover, active press, and offsets.
- [x] Focused-path/root key dispatch and `useInput` app hotkeys.
- [x] One press from Enter, Space, or completed primary click.
- [x] Tree-order focus traversal.
- [x] Wheel, mouse, arrow, page, home/end scroll controls.
- [x] Reconciliation of disappearing focus/hover/offset owners.
- [x] Bubbling, prevention, and stop-propagation contract.

## Phase 5 — React authoring

### R5.1 Internal reconciler — complete

- [x] Internal `faux-box`/`faux-text` hosts.
- [x] Function handlers only; no action strings/resolver generics.
- [x] Raw strings only inside `Text`.
- [x] Root package owns restricted JSX runtimes.
- [x] HTML/SVG intrinsics fail typechecking.
- [x] React hooks rerender automatically.

### R5.2 Release foundation — complete

- [x] `Text`
- [x] `Box`
- [x] `Row`
- [x] `Column`
- [x] `Fill` plus `Divider`
- [x] `ScrollView`
- [x] `Button`
- [x] `useInput` and `useFocusManager`
- [x] shared `ThemeProvider` palette

## Phase 6 — Thin hosts

### R6.1 TUI — complete

- [x] Canonical scene to true-color ANSI.
- [x] Shared palette.
- [x] Terminal key/CSI/SGR mouse/resize translation.
- [x] Raw mode, alternate screen, cursor, mouse, cleanup, and fake IO.
- [x] One-call mount with idempotent stop/start/unmount.

### R6.2 DOM — complete

- [x] One scene surface with positioned rows/style runs.
- [x] Internal host reset/default monospace presentation.
- [x] Explicit and viewport/container-fit modes.
- [x] Actual-rectangle pointer conversion.
- [x] Shared keyboard/pointer/wheel/resize commands.
- [x] Approved application/action accessibility projection.
- [x] No app CSS/body-margin/root-overflow issue.
- [x] Bun/Vite bundles contain no TUI/Node code.

## Phase 7 — Authoring proof and deletion

### R7.1 Public examples — complete

- [x] Tiny package/root README examples.
- [x] Serious real-tool fixture.
- [x] Separate minimal DOM/TUI entries over shared app code.
- [x] No renderer internals, bridge, manual rerender, or custom CSS.

### R7.2 Recipes — complete

- [x] App shell, panel, action bar, split panes, key/value metadata, status, queue, and divider recipes documented in [recipes.md](../recipes.md).
- [x] Public component count remains intentionally small.

### R7.3 Quality gates — complete

- [x] Source, tests, and negative API examples are typechecked.
- [x] Packed tarball smoke test.
- [x] Shared scene/event contract tests.
- [x] Chromium DOM behavior tests.
- [x] No caches were introduced before profiling.
- [x] No tracked transient output.
- [x] CI runs the full release gate.

### R7.4 Prototype deletion — complete

- [x] All retained examples/tests point at 1.0.
- [x] Old app/core/reconciler/renderer/schema/CLI/MCP/devtools packages removed.
- [x] Inspect/canvas/gallery and obsolete examples removed.
- [x] Old paths, manifests, scripts, lock entries, and docs removed/rewritten.
- [x] No old package alias remains.

## Phase 8 — Documentation and release readiness

### R8.1 Implemented-reality documentation — complete

- [x] Architecture describes only 1.0 implementation.
- [x] Spec is normative and roadmap is status-focused.
- [x] Root/package install and DOM/TUI/testing guides added.
- [x] Explicit logical sizing and host fitting documented separately.
- [x] Unicode/overflow/non-goals documented.

### R8.2 Release gate — complete

- [x] Success criteria in `report.md` are implemented.
- [x] Clean packed install passes.
- [x] No old package name is required.
- [x] Serious fixture passes both hosts.
- [x] Package manifests are versioned 1.0.0.

Tagging and npm publication remain explicit maintainer release actions.

## Deferred post-1.0 backlog

- [ ] Controlled text input with caret/selection.
- [ ] Select/list component if recipes repeat state/scroll logic.
- [ ] Width-explicit wrapped-text helper.
- [ ] Readable JSON adapter generated from shared semantic types.
- [ ] Inspection CLI over `/testing`.
- [ ] MCP integration over a stable inspection contract.
- [ ] Third-party renderer API after a real external renderer exists.
