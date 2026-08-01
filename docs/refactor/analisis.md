# Refactor analysis notebook

> Living evidence log for the TUI-first simplification. This file intentionally records findings as they are gathered; consolidated conclusions belong in `report.md` and executable work belongs in `tasks.md`.

## 2026-07-31 — Scope and directional hypotheses

The supplied last ideas are inspiration to test against implementation and consumer evidence, not requirements to copy mechanically. They suggest the following hypotheses:

- TUI behavior should probably be canonical and DOM should reproduce it closely, potentially 1:1 where hosts permit it.
- Explicit integer root width and height may be the simplest and most reliable contract, but the usability cost and host-resize story must be evaluated.
- Coordinates and sizes can use virtual cells: one x unit approximates one terminal character cell wide and one y unit one terminal character cell high.
- Layout should be deterministic and predominantly parent-to-child; browser layout and unconstrained child negotiation should not silently become semantic inputs.
- Base text likely should not wrap; clipping/cutting is the simplest default, while an explicit higher-level helper could remain possible if real use justifies it.
- Text extent should come from deterministic text analysis rather than browser font measurement. The exact Unicode/cell-width policy still needs a deliberate decision.
- TUI glyphs, including borders and Unicode pseudo-graphics, should be preserved in DOM when possible.
- DOM should be a monospace cell projection and alternative paint/input host, not a second semantic layout system.
- The implementation and package graph should become substantially smaller and easier for both agents and humans.
- The public layer should provide the minimum indispensable building blocks; specialized patterns should be composed on top unless repeated real use proves they belong in the library.
- Because the project was never released, obsolete code and package boundaries can be removed outright; no aliases, compatibility shims, deprecation phase, or consumer migration path are required.
- `/home/den/Source/g-calendar-cleanup` is a one-time case study only. It will not be upgraded and must not constrain the new API; its value is evidence about setup friction and missing building blocks.

## Repository baseline

- Branch: `main` at `527abe7` (`ui: unify public surface, named tracks, dividers, scroll-aware Panel (#2)`).
- `origin/main` is identical; `git pull --ff-only` reported `Already up to date`.
- Working tree was clean before this notebook was created.
- Tracked project size: 129 files and about 19,308 lines across tracked TypeScript/TSX/Markdown/JSON files.
- Runtime/package surface: 13 packages (`app`, `core`, `create-faux-ui`, `devtools`, `exec-faux-ui`, `mcp`, `reconciler`, `render-dom`, `renderer`, `render-inspect`, `render-tui`, `schema`, `ui`) plus 3 apps.
- Public authoring is currently split conceptually between `@faux-ui/app` and `@faux-ui/ui`, even though repository guidance prefers one public facade for app authors.
- No release tags exist. This leaves room for a clean breaking reset.

## First documentation observations

The latest prose already states many requested invariants: TUI canonical semantics, fixed cells, bounded roots, no base text wrapping, and DOM as projection. The problem is therefore not only choosing the direction; it is making the implementation, public API, examples, package graph, and docs consistently obey it.

Early documentation drift found before code review:

- `docs/spec.md` says every root is explicitly bounded, while current DOM docs advertise automatic body mounting and automatic constraint measurement.
- `docs/spec.md` rejects renderer-owned text measurement but still specifies a text-measurement cache key containing `wrap`, style, max width, and renderer identity.
- `docs/architecture.md` describes the DOM runtime as the most complete integration and includes browser measurement in the normal path, showing the current DOM-first implementation pressure.
- `docs/architecture.md` lists missing browser visual regression, scaffold/CLI flow, and a TUI event loop despite the repository containing Playwright snapshots, implemented CLIs, and a TUI terminal host/runtime. This section is stale.
- `docs/roadmap.md` marks early milestones complete, then repeats those same completed milestones in its suggested future order. It mixes historical narrative, current state, and priorities.
- No `docs/strategy.md` currently exists, despite strategy being part of the requested documentation reset.

These are provisional observations. Detailed implementation and consumer evidence follows below.

## Git-history evidence

### Direction over time

The history shows repeated attempts to simplify the authoring experience, but each attempt added another abstraction layer:

1. `6841971` (`Add foundation`) introduced about 6,946 lines at once, including core, React reconciliation, DOM/TUI renderers, schema, compact encoding, CLI placeholders, devtools, and MCP. Many package boundaries therefore preceded real use.
2. The next commits rapidly expanded DOM runtime behavior, TUI input/runtime behavior, CLI execution, scaffolding, mouse support, snapshots, HTML inspection, and examples. The project reached broad ecosystem shape before validating a small external app path.
3. `6965da0` (`Reduce boilerplate`) added renderer app helpers, yet also added roughly 1,335 lines.
4. `2aac615` (`Update roadmap`) was the decisive semantic reset: TUI became canonical, DOM became a fixed-cell projection, renderer text measurement was removed from layout, bounded roots were made explicit, and base text wrapping was removed. This is the origin of many of the supplied directional ideas.
5. `f5d3974` (`Simplify app init`) removed almost as much code as it added, but retained separate, large DOM and TUI runtime implementations.
6. PR #2 (`527abe7`) tried to solve public sprawl with one `@faux-ui/ui` package, but added 4,527 lines overall. It also introduced named tracks, a generic renderer contract, an inspect renderer, contributor-renderer examples/templates, a 215-line UI/runtime bridge, and a 670-line component surface.

The stable historical intent is not “support every extension seam.” It is “make deterministic cross-host tool UI easy.” Package and feature growth repeatedly outran that intent.

### History quality signals

- `docs/roadmap.md` is the most frequently changed file (24 changes across all refs), followed by `README.md` (19) and `docs/architecture.md` (15). Direction has been rewritten more often than the core model has been validated in consumers.
- The main branch has only three squashed commits: initial, foundation, and the UI/design-system change. The preserved feature branches provide the useful chronological history.
- PR #1 added 16,191 lines in one merge. PR #2 added another 4,527 and removed 454. Large review units made architectural drift hard to detect.
- PR #2 had five Copilot review findings: stale resize closure, redundant scroll notifications, an unreachable typed renderer-object branch, missing runtime-provider wrapping, and a blank docs bullet. Those were addressed, but review did not challenge the broader package/runtime complexity.
- There are no GitHub issues and no release tags.
- `refs/sessions/...` contains an orphan checkpoint history with no merge base with `main`; it mirrors development snapshots and is not an additional product direction.

## Baseline verification

- The checked-out `node_modules` initially contained TypeScript 5.9.3 while `bun.lock` declared 6.0.2, causing `bun run typecheck` to fail with misleading stale-project errors. `bun install --frozen-lockfile` synchronized dependencies without changing tracked files.
- After synchronization, `bun run typecheck` and `bun run build` pass.
- `bun run test` passes 23 files / 125 tests.
- Passing tests overstate API consistency: package tsconfigs include `src` but not package tests, and Vitest transpiles without typechecking. DOM tests still pass removed `measureText` options to object literals; runtime ignores them, but neither the test runner nor workspace typecheck reports the stale usage.
- Both first-party Vite browser builds complete but warn that `node:process`, imported by the TUI terminal host, was externalized for browser compatibility.
- A minimal Bun browser bundle importing `@faux-ui/app` fails: the facade statically imports TUI code, and Bun cannot provide the default `node:process` export. Importing `@faux-ui/render-dom` bundles successfully. This exactly reproduces the external-project feedback.

## Core implementation findings

### What is worth preserving

- `@faux-ui/core` is renderer-neutral in the important places: semantic nodes, track resolution, layout output, visible render-tree construction, clipping, hit testing, and bubbling action collection.
- Layout and render transforms are separated. Scroll offsets are applied during render-tree construction rather than stored in layout state.
- The render tree is a useful single projection boundary for both paint and hit testing.
- Integer track resolution is deterministic, including left-to-right remainder distribution.
- Base text layout is already independent of DOM font measurement.

### Where the core is more complex or less consistent than the docs imply

- `layout.ts` is 560 lines. Content tracks first lay out children with fully unbounded `{}` constraints, then lay them out again under resolved cell bounds. This is a child-measurement/parent-negotiation pass, not a purely one-pass parent-to-child allocator.
- Any nested view can contribute intrinsic size to `auto`/unbounded fraction tracks. The implementation does not restrict intrinsic contribution to text, so deeply nested layout can recursively negotiate upward.
- Bounded roots are enforced by `buildRenderTree()`, but `layoutNode()` remains public and accepts unbounded root constraints.
- Root views are forcibly framed to the full viewport in `buildRenderTree()`, while root text nodes keep intrinsic/clamped size. Root semantics therefore differ by node kind.
- The spec says a bounded fraction track implies a tight child size. The engine only passes max constraints; text children remain intrinsic and do not fill the track. Some view children happen to fill because their own default `1fr` tracks consume the bound. The rule is accidental, not explicit.
- Fixed and content tracks may sum beyond the parent maximum. The parent reports a clamped viewport while children retain overflowing positions and are later clipped. This is deterministic, but should be specified as overflow rather than implied to be allocation within bounds.
- `NormalizedTextSpec` and JSX `TextProps` still contain a `wrap` field, but normalization and update logic discard it. Tests explicitly assert that it becomes `undefined`. This is dead pre-reset API.
- Text width and framebuffer writing use JavaScript UTF-16 `string.length` and indexing. Surrogate pairs, combining marks, variation selectors, and wide terminal glyphs do not have a defined cell policy. “Character count” is not precise enough for cross-host parity.
- Named tracks and explicit child row/column placement added substantial normalization, cloning, equality, validation, placement, and error logic. The original index-only grid was much smaller. Real-project use did not use named placement.
- Dirty flags, revisions, subtree revisions, per-node layout caches, and a render-tree weak cache exist before profiling evidence. They complicate mutation and invalidation while live DOM rendering still replaces the entire DOM subtree on each render.

## Renderer and runtime findings

### Duplicated interaction engine

The DOM runtime is 1,518 lines and the TUI runtime is 1,042 lines. They independently implement most of the same state machine. At least these function-level concepts are duplicated: input-tree creation, point dispatch, focused dispatch, focus targeting, focus state, hover-path transitions, drag state, action resolution, event payload creation, scroll selection/clamping, semantic tree traversal, and node-path lookup.

This duplication has already produced unequal behavior:

- DOM explicitly dispatches blur/mouse-leave when active nodes are removed or on unmount; TUI update only filters IDs and clears focus without equivalent lifecycle dispatch.
- DOM lets native browser tab order participate in focus; TUI owns cyclic tree-order traversal.
- DOM can resolve a native event target even when point conversion is wrong; TUI always uses cell coordinates.

A renderer-neutral interaction controller belongs beside the shared render tree. DOM and terminal layers should translate host events into the same controller commands and paint the resulting state.

### DOM-specific problems

- `pointFromPointerEvent()` subtracts the root rectangle but does not divide pixel offsets by cell width/height. Pointer payloads, hover hit testing, wheel targeting, and fallback point dispatch therefore treat pixels as virtual cells. Existing tests use one fake pixel per cell and do not catch this.
- Native event-target lookup masks the coordinate bug for ordinary clicks/focus, which explains why the real app remained usable.
- The live runtime reconstructs all DOM nodes and calls `container.replaceChildren(rootElement)` on every rerender. That favors simplicity, but makes the elaborate semantic cache layer less valuable and repeatedly disturbs native focus.
- `text-measurer.ts` (100 lines) is exported and tested but unused by layout or mounting. It still defaults to proportional Segoe UI canvas measurement, contradicting the fixed-cell direction.
- Automatic DOM sizing creates a probe glyph and measures the browser container. Host viewport-to-cell conversion is a legitimate adapter concern, but it is currently mixed with text measurement terminology and does not account cleanly for default body margin.
- DOM visual regression tests mostly paint colored rectangles. They do not compare DOM output with TUI output, exercise real glyphs/borders, or validate pixel-to-cell input conversion.

### TUI-specific problems

- TUI painting always resolves semantic tokens through `defaultSemanticColors`; unlike DOM, it has no complete custom palette path.
- The separate TUI text measurer repeats core text extent logic and is only needed to split paint lines.
- Framebuffer indexing uses UTF-16 code units, leaving Unicode cell behavior undefined.
- The terminal host is reasonably isolated, but it includes a large parser and full-screen lifecycle before the shared interaction semantics have been factored once.

### Generic renderer abstraction

`@faux-ui/renderer`, `@faux-ui/render-inspect`, the canvas renderer app, and the renderer scaffold template were added to prove third-party extensibility. The canvas example serializes/paints a tree outline rather than implementing faux-ui layout semantics, so it does not prove renderer parity. This extension surface adds packages, generics, overloads, templates, docs, and tests without evidence from the only external application. Supporting TUI and DOM well should precede a public third-party renderer SDK.

## Public UI-layer findings

- The public path still requires two packages (`@faux-ui/app` plus `@faux-ui/ui`), while the app package statically couples browser and terminal implementations.
- `BuiltInRenderOptions` intersects DOM and TUI options and returns a union mounted handle. This is less clear than target-specific entrypoints from one facade.
- Scroll-aware `Panel` requires React context, refs into reconciler node IDs, semantic-tree traversal, renderer runtime adapters, a 215-line bridge, provider injection in the app facade, and post-commit notifications. The abstraction leaked directly into the external app when the app facade could not bundle.
- `Divider` does not know its allocated extent. It works around that by generating 512 horizontal characters or 256 one-cell vertical child nodes and relying on clipping. The synthetic real-app screen created 234 divs, with 192 reporting overflow/clipping; much of this came from divider/panel chrome.
- `Panel` combines card, header/body/footer layout, divider, scroll viewport, dynamic scrollbar controls, and runtime metrics. It is not a minimal primitive despite its simple name.
- `Button` supports only `neutral`, `accent`, and `selected`. Real use needed semantic action tones, compact one-line content, disabled state, predictable padding, and centered labels, so it dropped to raw `view`/`text`.
- The UI theme maps semantic colors to another theme vocabulary, while the consumer still needed 136 lines of action theme/style mapping.
- The shared example remains 411 lines of low-level `view`/`text` composition and does not consume the advertised `@faux-ui/ui` components. The roadmap explicitly says it should, but marks surrounding UI work as farther along.
- The TUI snapshot of that example visibly truncates prose in the middle of words. This is deterministic, but demonstrates that “never wrap” needs usable authoring helpers such as explicit truncation/ellipsis and deliberate multiline composition.

## Peripheral package findings

- `@faux-ui/mcp` is an 11-line command union in its own package; it is a placeholder, not an MCP implementation.
- `@faux-ui/devtools` is a 19-line layout formatter in its own package.
- `@faux-ui/schema` duplicates core colors, tracks, scroll, style, and bindings. It still exposes dead `wrap`, lacks named tracks/placement, and can drift independently.
- The compact schema codec and validation total about 900 lines without consumer evidence that a compact wire format is needed.
- `exec-faux-ui` is 747 lines and duplicates semantic-tree construction, DOM HTML serialization, schema adaptation, and inspect formatting. Its default DOM target prints a model as JSON rather than running a browser UI.
- `create-faux-ui` is 962 lines. A large portion generates a speculative third-party renderer package. Its generated DOM starter imports the browser-incompatible app facade, requires a CSS file, assumes unpublished `0.1.0` packages, and tests only generated strings rather than installing/typechecking/building the scaffold.
- Tracked artifacts (`.playwright-mcp/...`, `test-results/.last-run.json`, and `typecheck.log`) remain in Git even though their directories/files are ignored now.

## One-time consumer case study: `g-calendar-cleanup`

### What the case study validates

The app demonstrates that the central idea works:

- A useful keyboard-first review UI was authored with React and faux-ui and no custom app CSS.
- The screen uses deterministic rows/columns, semantic colors, panels, dividers, focusable action chips, and scrollable content.
- Product logic remained ordinary React state/effects and was not forced into framework-owned reducers.
- A synthetic browser run had no page errors, all 11 action chips were focusable/visible, and the `Q` hotkey completed the card flow.
- The resulting UI visibly resembles a terminal tool in the browser, which is the intended product niche.

### Concrete integration cost

- The project had to add the entire faux-ui repository as a submodule and expose every package as a workspace. `bun pm ls` consequently lists all 13 faux-ui packages, including unused MCP, schema, CLI, inspect, and TUI packages.
- Its server checks for faux-ui dist files, runs a separate install/build inside the submodule, then bundles the client.
- The intended `@faux-ui/app` import cannot be bundled for Bun/browser because it pulls in `node:process` through TUI. The app imports internal `@faux-ui/render-dom` instead.
- It then manually creates `UiRuntimeProvider`, `createUiRuntimeBridge()`, obtains the mounted DOM runtime, adapts scroll methods, attaches the bridge, and notifies it: 25 lines for what should be one render call.
- The direct DOM bundle is about 806 KiB unminified with React included. Bundle size is not yet optimized, but it confirms that using the target-specific renderer avoids TUI code.

### Missing building blocks exposed by real use

- The app used `AppShell`, `Panel`, and `Divider`, but not `Button`.
- It implemented a custom action bar/chip with raw views, three manual rows, literal space padding, duplicated click/press handlers, and per-state semantic styles.
- It implemented global keyboard shortcuts with `window.addEventListener`, making that behavior DOM-only rather than portable to TUI.
- It implemented queue summary, loading/error/empty screens, body sections, metadata cards, action tones, and hotkey labels itself. Some are app composition rather than framework primitives, but compact action, stack, inset/padding, semantic tone, hotkey handling, and text overflow are repeated low-level needs.
- The browser host retained the default 8px body margin. At a 1440×900 viewport the generated faux root ran from `(8,8)` to roughly `(1443,905)`, overflowing the viewport because body sizing used `innerWidth/innerHeight` without resetting or subtracting margin. A no-CSS default should own this host reset.
- On the full synthetic screen, the semantic output included hundreds of repeated divider glyphs in accessible text and 234 DOM divs. Correct pseudo-graphics should not require arbitrary 256/512 fill constants.

The consumer will not be upgraded. These observations are requirements evidence only, not migration constraints.

## External framework comparison

This is not a request to copy established frameworks; it is a check that the case-study needs are not accidental.

- [Ink](https://github.com/vadimdemedes/ink) succeeds partly because React users get a tiny conceptual starting set (`Text`, `Box`, `Newline`, `Spacer`) and hooks such as input/focus. Its README also exposes padding, gap, borders, overflow, and explicit wrap/truncate modes. faux-ui should not copy Ink's Yoga/Flexbox/CSS breadth, but the overlap with the case-study friction strongly supports fixed-cell padding, gap, border/fill, truncation, and renderer-neutral key/focus handling as foundational rather than app-specific.
- [Textual's widget guide](https://textual.textualize.io/guide/widgets/) defines a widget as a rectangular screen region. Its basic example becomes practical with integer width/height, padding, background, border, and content alignment, and distributable widgets can bundle default style. This supports a small rectangular `Box` semantic with component-owned defaults rather than requiring app CSS.
- [Ratatui's widget documentation](https://docs.rs/ratatui/latest/ratatui/widgets/) calls widgets composable building blocks and highlights `Block` (border/title), `Fill`, `List`, `Paragraph`, and `Scrollbar`. It also keeps modular internal crates while recommending the single main `ratatui` facade to app authors. That is a useful precedent for one public package even if internal files/modules remain separated.
- Unicode width cannot safely be summarized as JavaScript string length. xterm.js ships a versioned [Unicode 11 width addon](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-unicode11), while its [grapheme-clustering addon](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-unicode-graphemes) is explicitly experimental. faux-ui should freeze and test a modest Unicode cell policy rather than promising unspecified “character” behavior.

The differentiator should remain the opposite of Ink/Textual's broad CSS-like negotiation: a smaller explicit cell allocator and one canonical painted cell scene shared by terminal and browser.

## Context-recovery checkpoint — 2026-07-31

This section is intentionally redundant so work can resume after context compaction.

### Completed evidence gathering

- Synced `main` with `origin/main`; both are at `527abe7`.
- Read every project Markdown document and the full `g-calendar-cleanup/faux-ui-feedback.md`.
- Reviewed all package source, public apps, major tests/configuration, package graph, Git branch history, PR #1/#2 metadata, and all PR #2 review comments.
- Inspected the one-time consumer's package setup, server/build path, complete web UI, theme workarounds, and manual runtime bridge.
- Reproduced the consumer's Bun/browser failure when importing `@faux-ui/app`; direct DOM import succeeds.
- Ran a synthetic full consumer screen in Chromium, captured DOM/runtime metrics, exercised its hotkey, and inspected screenshots.
- Verified the repo after `bun install --frozen-lockfile`: typecheck, build, and 125 tests pass. Vite browser builds still warn about statically imported `node:process` from TUI.
- Compared relevant official Ink, Textual, Ratatui, and xterm.js documentation.
- Wrote the consolidated recommendation to `docs/refactor/report.md`.

### Current recommendation

- Clean break; no API migration or consumer upgrade.
- One public package, `@faux-ui/ui`, with isolated `/dom`, `/tui`, and `/testing` entrypoints.
- Shared immutable layout result, shared interaction controller, and canonical cell scene before host projection.
- Simplify layout to nested sequential `Row`/`Column` containers with integer/`auto`/fraction tracks plus fixed-cell gap, padding, border, and alignment.
- Make the semantic engine's root size explicit; hosts may resolve that size ergonomically before layout.
- Base text remains no-wrap, but gains deterministic cellization and clipping/ellipsis.
- Initial building blocks: `Text`, `Box`, `Row`, `Column`, `Fill` plus a thin `Divider`, `ScrollView`, `Button`, root key/focus handling, and one palette contract.
- Delete generic renderer SDK, inspect/canvas renderer proof surfaces, runtime bridge, dead text measurers/wrap fields, named placement, compact schema, placeholder MCP/devtools, and current CLIs until the app contract is stable.

### Files changed/created at the documentation checkpoint

- `docs/refactor/analisis.md` — detailed evidence and recovery checkpoints.
- `docs/refactor/report.md` — consolidated product/architecture recommendation.
- `docs/refactor/tasks.md` — ordered destructive implementation tasks with acceptance gates.
- `docs/spec.md` — normative vNext semantics.
- `docs/roadmap.md` — reset milestone status.
- `docs/strategy.md` — product positioning, scope filter, and delivery strategy.
- `docs/architecture.md` — honest description of the current pre-refactor code.
- `README.md` — unreleased reset status and target experience.
- `AGENTS.md` — implementation rules for the reset.
- `docs/improvements.md` — remaining small artifact cleanup only.

Created and switched to branch `refactor/tui-first-reset` after the task plan was written. No production source has been changed. `g-calendar-cleanup` was only read/executed and will not be modified or upgraded.

### Documentation checkpoint verification

- All relative Markdown links resolve.
- `git diff --check` reports no whitespace errors.
- Reviewed stale prototype terms: they remain only where current architecture/evidence/removal tasks intentionally discuss them.
- After documentation changes, `bun run typecheck`, `bun run test` (23 files / 125 tests), and `bun run build` all pass.

### Remaining work in this request

1. Commit all documentation on `refactor/tui-first-reset` as requested.
2. Confirm the resulting commit and clean branch state.
3. Leave tracked-artifact cleanup for a separate implementation/chore commit; it is not part of the docs commit.

## 2026-07-31 — 1.0 implementation checkpoint

The user approved continuing through a complete, well-tested first release and requested minimal/zero additional runtime dependencies plus current stable tooling.

Implemented outcome:

- Collapsed 13 prototype packages to one `@faux-ui/ui` package; removed 12 obsolete packages and two obsolete apps.
- Added isolated root, `/dom`, `/tui`, `/testing`, and JSX runtime exports.
- Internalized a minimal React reconciler; `react-reconciler` is the only direct implementation dependency and React remains a peer.
- Avoided a Unicode package dependency by generating/vendoring Unicode 17.0.0 property tables.
- Implemented full UAX #29 grapheme rules, deterministic width/tab/control policy, clipping, four ellipsis modes, and wide continuation cells.
- Replaced mutable cached grid layout with preferred-size plus top-down row/column allocation.
- Added one canonical scene and one focus/key/pointer/press/scroll controller.
- Added `Text`, `Box`, `Row`, `Column`, `Fill`, `Divider`, `ScrollView`, `Button`, theme, input, and focus APIs.
- Rebuilt DOM as one application surface with grouped row/style runs, actual-rectangle pointer conversion, fitting, internal reset, and minimal semantic accessibility descendants.
- Rebuilt TUI with true-color ANSI, key/CSI/SGR parsing, fake streams, resizing, and terminal restoration.
- Added a synthetic queue/detail/metadata fixture with split panes, overflow, 11 actions, global keys, and both host entries.
- Added packed-tarball consumer typecheck, Bun/Vite browser isolation, and fake-TUI execution.
- Added TypeScript negative API assertions, 1,000 randomized layout cases, the complete official Unicode 17 grapheme fixture, real Chromium tests, and CI.
- Deleted tracked Playwright/log artifacts and ignored future loose logs/tarballs.
- Updated package metadata to Bun 1.3.14 and dependencies to current stable TypeScript 7.0.2 (Go implementation), React 19.2.8, Vite 8.2.0, Vitest 4.1.10, Playwright 1.62.1, Node/React types, and fast-check 4.9.0. Replacing the system Bun binary was skipped after `/usr/bin/bun` returned `EACCES`, as instructed; its reported version is already 1.3.14 (canary revision).

Release versions are `1.0.0` in the root, package, and example manifests. Tagging/publishing was intentionally not performed without an explicit release instruction.

Final release gate:

- `bun audit`: no vulnerabilities after pinning safe `picomatch`/`tinyglobby` overrides for the latest Vitest graph.
- TypeScript 7 source plus test/negative-type checks pass.
- Vitest: 9 files / 32 tests pass, including 1,000 randomized layouts and all official Unicode 17 boundary cases.
- Playwright: 6 real-Chromium tests pass.
- Packed consumer: tarball install, DOM-only/TUI-only types, Bun/Vite browser bundles, and Bun/Node fake-terminal execution pass.
- Production package/example build passes with no browser target warning.
- `bun run check` passes end to end.
