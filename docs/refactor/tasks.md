# faux-ui refactor tasks

> Execution plan for the clean-break vNext described in [report.md](report.md). Tasks are ordered. Do not add compatibility aliases: nothing has been released.

## Status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` complete
- `[!]` blocked by an explicit decision

## Phase 0 — Lock the reset contract

### R0.1 Approve the product/package boundary

- [ ] Confirm `@faux-ui/ui` as the only app-author package.
- [ ] Confirm subpaths: `.`, `/dom`, `/tui`, `/testing`, JSX runtimes.
- [ ] Confirm there will be no environment-detecting root `render()` export.
- [ ] Confirm current packages may be deleted without aliases.

**Acceptance**

- Decision is reflected in `docs/spec.md`, `docs/strategy.md`, and package export tests.

### R0.2 Resolve four bounded design questions with spikes

- [ ] Pick and pin the Unicode grapheme/cell-width implementation and Unicode version.
- [ ] Prove a DOM scene renderer that groups cells into row/style runs without one element per cell.
- [ ] Decide the minimal DOM accessibility contract for the single application surface.
- [ ] Validate host-derived DOM sizing versus explicit sizing; keep explicit engine bounds in both cases.

**Acceptance**

- Spike renders ASCII, box drawing, combining text, and a wide emoji identically in the logical scene.
- Pointer tests map real browser pixels to the expected cells.
- No spike code imports TUI/Node modules into a browser bundle.
- Decisions are written into the spec before the main rewrite.

## Phase 1 — Establish executable parity gates

### R1.1 Add a vNext behavior fixture

- [ ] Create a queue/detail/metadata/action-bar fixture modeled on the useful parts of `g-calendar-cleanup`.
- [ ] Keep fixture data synthetic and repository-local.
- [ ] Cover long text, borders, split panes, scroll overflow, semantic tones, 11 compact actions, and global hotkeys.

**Acceptance**

- Fixture has fixed expected logical sizes and interaction outcomes.
- It contains no consumer-specific code/data and creates no compatibility obligation.

### R1.2 Preserve only valuable old behavior as tests

- [ ] Port fraction-rounding invariants.
- [ ] Port clipping and deepest-hit behavior.
- [ ] Port scroll offset clamping and render-only offset semantics.
- [ ] Port focus traversal and direct React handler behavior.
- [ ] Mark tests for generic renderers, compact schema, token actions, named placement, and dead measurement APIs for deletion.

**Acceptance**

- A small test manifest maps each preserved behavior to the vNext spec.
- No test preserves an API solely because it exists today.

### R1.3 Add consumer-level package tests first

- [ ] Add a fixture that installs the packed package rather than workspace source aliases.
- [ ] Typecheck a shared app and separate DOM/TUI entry files.
- [ ] Bundle DOM with Bun and Vite.
- [ ] Execute TUI with fake IO.

**Acceptance**

- The test fails if `/dom` reaches `node:process` or terminal-host code.
- Tests themselves are included in a TypeScript check.

## Phase 2 — Establish the new package boundary

### R2.1 Create the single package skeleton alongside the prototype

- [ ] Create one `packages/ui` package containing public exports and internal modules.
- [ ] Add isolated export-map subpaths.
- [ ] Keep React as a peer dependency.
- [ ] Use internal folders, not workspace packages, for core/reconciler/hosts.

**Acceptance**

- A clean fixture installs exactly one faux-ui package.
- Root import is browser-safe and host-neutral.
- `/dom` and `/tui` resolve independently.

Keep old packages temporarily as reference while the new package is built. Do not add adapters from the new API back to old implementations unless a short-lived test harness requires one.

## Phase 3 — Rewrite the semantic kernel

### R3.1 Implement deterministic cellization

- [ ] Add pinned grapheme segmentation and width lookup.
- [ ] Represent lead/continuation cells for width-2 graphemes.
- [ ] Define newline, combining, control, tab, and ambiguous-width behavior.
- [ ] Add clip and start/middle/end ellipsis helpers.

**Acceptance**

- No layout or paint path uses UTF-16 `string.length` as display width.
- Unit tests cover ASCII, box drawing, combining clusters, variation selectors, emoji, and explicit newlines.

### R3.2 Replace mutable cached layout state

- [ ] Keep the reconciler's semantic tree minimal.
- [ ] Remove dirty intrinsic/layout/paint flags and subtree revision caches initially.
- [ ] Return an immutable derived layout tree per committed render.
- [ ] Preserve stable internal node identity only where focus/scroll reconciliation requires it.

**Acceptance**

- Layout is a pure function of semantic tree plus explicit root size.
- Re-rendering the same inputs yields deeply equal layout output.
- No semantic prop stores derived dimensions.

### R3.3 Implement the two-phase one-axis allocator

- [ ] Implement preferred-size calculation.
- [ ] Implement parent-to-child exact frame allocation.
- [ ] Support `Row`, `Column`, and single-child `Box` behavior.
- [ ] Support integer, `auto`, and positive fraction tracks.
- [ ] Support integer gap, padding, border, and start/center/end content alignment.
- [ ] Define deterministic overflow and fraction rounding.
- [ ] Remove named tracks, child row/column placement, general grid cells, spans, and min constraints.

**Acceptance**

- Each child is laid out once in the allocation phase.
- Every node has an absolute frame and effective clip.
- Nested rows/columns reproduce the real-tool fixture.
- Property tests prove non-negative integer geometry and stable fraction sums.

### R3.4 Implement scroll geometry

- [ ] Separate viewport frame, content extent, and render offset.
- [ ] Compute scroll content from preferred sizes/allocated child positions.
- [ ] Keep offset out of semantic layout inputs.
- [ ] Clamp offsets after tree/size changes.

**Acceptance**

- Changing only offset does not change layout output.
- Horizontal, vertical, and both-axis clipping are covered.

## Phase 4 — Create one canonical scene and controller

### R4.1 Move framebuffer/scene into shared internals

- [ ] Define logical cells with glyph/style/owner.
- [ ] Paint backgrounds, inherited style, text, clipping, and wide-cell continuations.
- [ ] Paint box borders/titles, fills/dividers, optional scrollbars, and focus/hover state.
- [ ] Group scene runs for efficient host projection.

**Acceptance**

- Borders and dividers use allocated frames; there are no 256/512 fill constants.
- Scene snapshots are independent of host.
- TUI and DOM tests consume the same scene object.

### R4.2 Implement one interaction controller

- [ ] Own focus, hover path, active pointer, and scroll offsets once.
- [ ] Route key events to the focused path and root handlers.
- [ ] Synthesize one `press` event from Enter, Space, and pointer click.
- [ ] Implement tree-order next/previous focus.
- [ ] Implement scroll target selection/clamping.
- [ ] Reconcile blur/leave when nodes disappear or the app unmounts.
- [ ] Define bubbling and `stopPropagation()`.

**Acceptance**

- Identical command sequences produce identical handler traces for DOM and TUI adapters.
- Global hotkeys work with no focused child.
- A button handler fires once per activation.

## Phase 5 — Rebuild React authoring

### R5.1 Internalize and minimize the reconciler

- [ ] Adapt the current React reconciler to internal `box`/`text` hosts.
- [ ] Remove string action identifiers and resolver generics from JSX/core.
- [ ] Keep direct typed handlers only.
- [ ] Keep raw strings legal only inside `Text`.
- [ ] Keep JSX runtime exports in the public package.

**Acceptance**

- React hooks rerender automatically.
- Type errors reject HTML/SVG intrinsic elements in faux-ui JSX.
- Public app code never imports reconciler/node handles.

### R5.2 Implement the release-foundation components

- [ ] `Text`
- [ ] `Box`
- [ ] `Row`
- [ ] `Column`
- [ ] `Fill` plus a thin `Divider` convenience
- [ ] `ScrollView`
- [ ] `Button`
- [ ] root input/focus hooks
- [ ] palette/theme provider that contains no runtime adapter

**Acceptance**

- Components compile only to shared semantic nodes.
- `Button` supports compact padding, semantic tone, selected/disabled state, optional hotkey label, and unified press.
- `ScrollView` needs no React ref, node-ID lookup, or UI/runtime bridge.
- Real-tool fixture uses no private host tags.

## Phase 6 — Rebuild hosts as thin adapters

### R6.1 TUI vertical slice first

- [ ] Project canonical scenes to ANSI.
- [ ] Apply configurable palette consistently.
- [ ] Translate terminal key/mouse/resize input into controller commands.
- [ ] Preserve raw mode, alternate screen, cleanup, and fake-IO testability.

**Acceptance**

- TUI is the first fully working vertical slice.
- Box drawing, wide text, focus, hotkeys, buttons, and scroll work in the real-tool fixture.
- Stop/unmount always restores terminal state.

### R6.2 DOM mirror

- [ ] Render scene rows/style runs in a single application surface.
- [ ] Install minimal host reset/default monospace style internally.
- [ ] Implement explicit size and container-fit modes.
- [ ] Convert pointer pixels to cells correctly.
- [ ] Route browser keyboard/pointer/wheel/resize to the shared controller.
- [ ] Implement the approved accessibility labels/focus exposure.

**Acceptance**

- No app CSS is required.
- No default body margin or root overflow bug.
- Bun and Vite browser bundles contain no TUI/Node code or warnings.
- Logical scene and event traces match TUI for the fixture.

## Phase 7 — Prove the author experience

### R7.1 Replace examples with public-API examples

- [ ] Keep one small hello/counter example.
- [ ] Keep one serious real-tool fixture.
- [ ] Give shared app code separate 2–5 line DOM/TUI entry files.
- [ ] Remove direct internal aliases from normal example build config.

**Acceptance**

- Examples install/use the package as consumers do.
- No example normalizes renderer internals, manual rerender, bridge setup, or custom CSS.

### R7.2 Add recipes, not premature components

- [ ] Document app shell, panel/card, action bar, split panes, key hints, and empty/loading/error states as compositions.
- [ ] Record repeated friction from future apps.
- [ ] Promote only patterns repeated in at least two real applications.

**Acceptance**

- Recipe code uses release-foundation components only.
- Core/public component count stays intentionally small.

### R7.3 Establish quality gates

- [ ] Include tests in typecheck.
- [ ] Add package tarball smoke test.
- [ ] Add cross-host scene and event contract suites.
- [ ] Add DOM visual tests as secondary checks.
- [ ] Add performance measurements for the real-tool fixture before introducing caches.

**Acceptance**

- Root `check` runs typecheck, unit/contract tests, package smoke, and production builds.
- No tracked transient test/log output.

### R7.4 Cut over and delete the prototype

- [ ] Point all retained examples/tests at the vNext package.
- [ ] Remove `packages/app`.
- [ ] Remove `packages/renderer`.
- [ ] Remove `packages/render-inspect`.
- [ ] Remove `packages/mcp` and `packages/devtools`.
- [ ] Remove `packages/schema` compact/readable prototype.
- [ ] Remove `packages/create-faux-ui` and `packages/exec-faux-ui` until the API stabilizes.
- [ ] Remove old standalone render/core/reconciler packages after their retained code has moved internally.
- [ ] Remove `apps/example-renderer` and obsolete prototype examples.
- [ ] Remove stale path aliases, references, manifests, scripts, lock entries, and docs.

**Acceptance**

- No alias/shim re-exports an old package name.
- `rg '@faux-ui/(app|renderer|render-|core|schema|mcp|devtools)'` returns only historical/refactor documentation where intentional.
- The new package's typecheck, tests, builds, and packed consumer smoke tests pass after deletion.

## Phase 8 — Documentation and 0.1 readiness

### R8.1 Make docs describe implemented reality

- [ ] Update architecture after each phase lands.
- [ ] Keep spec normative and roadmap status-only.
- [ ] Add external install, DOM-only, TUI-only, and dual-host guides.
- [ ] Document explicit logical root sizing and host fitting separately.
- [ ] Document text/Unicode/overflow limitations plainly.

### R8.2 Release gate

- [ ] Complete all success criteria in `report.md`.
- [ ] Verify a clean install from a packed artifact.
- [ ] Verify no old package names are required.
- [ ] Tag only after the real-tool fixture passes both hosts.

## Deferred backlog (not part of the reset critical path)

- [ ] Controlled text input with caret/selection.
- [ ] Select/list component if recipes repeat state/scroll logic.
- [ ] Width-explicit wrapped-text helper.
- [ ] Readable JSON document adapter generated from shared semantic types.
- [ ] Inspection CLI over `/testing`.
- [ ] MCP integration over a stable inspection contract.
- [ ] Third-party renderer API only after a real external renderer exists.
