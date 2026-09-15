# faux-ui 0.10.0 specification

## Status

This is the normative contract implemented by the unreleased faux-ui 0.10.0 evidence candidate. Delivery history belongs in [roadmap.md](roadmap.md); reset rationale belongs in the [TUI-first dossier](refactors/2026-07-31-tui-first-reset/README.md), and the implemented public names belong in the [API language decision](refactors/2026-08-01-api-language-review/03-decision.md).

Frozen implementation decisions:

- grapheme and width lookup use vendored, generated Unicode 17.0.0 data with no Unicode runtime dependency;
- DOM uses one `role="application"` tab stop, an application label, `aria-activedescendant`, and one visually hidden semantic node per labeled action;
- DOM host fitting uses a fixed 8×16-pixel default calibration and resolves integer bounds before semantic layout.

None changes layout or interaction semantics by host.

## Purpose

faux-ui is a deterministic, terminal-first UI framework for agents, humans, and text-oriented tools. Applications are authored with React components. The terminal is the canonical interaction/display model; the browser renders the same logical cell scene.

The framework intentionally provides less layout power than CSS, Yoga, or general GUI toolkits.

## Product contract

- One semantic tree drives TUI and DOM.
- The semantic engine always receives an explicit integer root width and height.
- Every coordinate and size is measured in logical terminal cells.
- Layout is deterministic and renderer-independent.
- Base text never wraps automatically.
- Painting produces one canonical cell scene before host projection.
- Focus, key routing, activation, pointer targeting, and scrolling are shared semantics.
- React applications use direct handlers and ordinary React state.
- A usable DOM or TUI app requires no internal renderer imports, runtime bridge, or app CSS.

## Runtime baseline

- Package manager and workspace runtime: Bun 1.4.0+.
- Runtime target: Node 22+ for TUI/tooling.
- Browser target: current evergreen browsers.
- Authoring bridge: React 19.2.8+.
- Language/toolchain: strict TypeScript 7.0+.
- Public package: `@faux-ui/ui`.

## Public package contract

The only required app-author package is `@faux-ui/ui`. Optional standalone component packages such as `@faux-ui/grid` depend on its public contract and are not part of the root foundation.

Required exports:

- `@faux-ui/ui`: components, hooks, public event/theme/layout types, and the `TextSource` operations;
- `@faux-ui/ui/dom`: browser `render()` and browser-only options/handle;
- `@faux-ui/ui/tui`: terminal `render()` and terminal-only options/handle;
- `@faux-ui/ui/testing`: logical scene/tree/event inspection helpers;
- `@faux-ui/ui/layout`: advanced pure custom-layout component/types for independently packaged renderer-neutral components;
- `@faux-ui/ui/jsx-runtime` and `/jsx-dev-runtime`: restricted JSX runtimes.

Rules:

- The root package must not import either host implementation at runtime.
- `/dom` and `/layout` must not import Node or TUI modules.
- `/tui` may import Node terminal modules.
- There is no environment-detecting render entrypoint.
- No old package name is retained as an alias.
- React is a peer; `react-reconciler` is the foundation's only direct implementation dependency. Optional Grid has UI and React peers and no direct runtime dependency.
- Unicode, layout, scene, controller, and host projection add no runtime package dependencies.

## Core terminology

```ts
type Size = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type Rect = Point & Size;
```

All values are finite non-negative integers after normalization.

- **Semantic tree:** renderer-neutral `box` and `text` nodes produced by React reconciliation.
- **Preferred size:** deterministic content extent used only by `auto` tracks and scroll content.
- **Layout tree:** immutable derived tree containing exact absolute frames and effective clips.
- **Controller state:** focus, hover/pointer, and scroll offsets for a mounted tree.
- **Cell scene:** width × height logical cells containing final glyph/style/ownership data.
- **Host adapter:** terminal or browser code that translates input and projects a cell scene.

## Root sizing

The layout engine accepts exactly one root `Size`; unbounded roots are invalid.

Host convenience is allowed before layout:

- TUI may resolve terminal columns/rows into the root size.
- DOM may resolve a container and fixed cell calibration into the root size.
- Static/testing calls provide the root size directly.
- Explicit render options override host-derived size.

Host sizing must not inspect semantic child text, browser flow, or intrinsic DOM dimensions.

The root node always receives the exact root rectangle `{ x: 0, y: 0, width, height }`, regardless of node kind.

## Semantic node model

There are two internal host kinds.

### `text`

A text node contains:

- a string or an immutable `TextSource`;
- semantic foreground/background style;
- horizontal/vertical content alignment;
- overflow mode.

A text node has no semantic children.

### `box`

A box may contain:

- zero or more semantic children;
- no axis, row axis, column axis, or one advanced custom layout engine;
- main-axis tracks;
- fixed-cell gap;
- fixed-cell padding;
- optional cell border and title;
- semantic foreground/background style and interaction styles;
- optional scroll axis;
- focusability and direct handlers.

A box with no layout axis accepts at most one child and allocates the full inner frame to it.

Public components compile to these host kinds. Internal host tags and node IDs are not part of the app API.

## Public foundation components

The initial conforming surface contains:

- `Text`
- `Box`
- `Rows`
- `Columns`
- `Fill` plus a thin `Divider` convenience
- `ScrollView`
- `Button`
- renderer-neutral input/focus hooks
- a palette/theme provider

`Rows` places each source child in one row; its tracks control heights. `Columns` places each source child in one column; its tracks control widths. Both compile to the same internal one-axis box node.

Higher-level app shell, panel, toolbar, split layout, status, loading, error, and empty-state patterns are compositions first. CSS-grid-like layout is supplied by optional `@faux-ui/grid`, not the root foundation.

## Advanced layout extension contract

`@faux-ui/ui/layout` exports `Layout` and a small pure geometry contract for independently packaged components such as `@faux-ui/grid`.

A `LayoutEngine` provides:

1. `preferred(children)` receives only child preferred `Size` values and returns one preferred content `Size`.
2. `layout({ size, children })` receives the concrete content-frame `Size` plus the same preferred child sizes and returns one local `Rect` per child plus optional content size.

Rules:

- callbacks receive no semantic node, ID, controller, scene, DOM, terminal, or host object;
- every size, coordinate, and extent returned is a finite non-negative integer cell value;
- child frame count equals semantic child count;
- returned rectangles are local to the Layout content frame and may overlap or extend beyond it;
- source order remains paint and focus traversal order; later overlapping children paint later;
- normal ancestor clipping, scrolling, scene ownership, events, and host projection remain canonical;
- a custom layout box cannot also define a sequential axis, tracks, or gap;
- malformed output throws instead of falling back to host layout;
- algorithms must be pure and renderer-neutral.

The subpath is an advanced component-author surface. Ordinary applications should use `Box`, `Rows`, `Columns`, and optional finished component packages.

## Track language

```ts
type Track = number | "auto" | `${number}fr`;
```

Rules:

- Fixed tracks are non-negative integer display cells on the component's main axis: heights in `Rows`, widths in `Columns`.
- Fraction weights are finite and greater than zero.
- `auto` uses the corresponding child's preferred main-axis size.
- Core `Rows` / `Columns` do not expose named tracks, explicit two-axis placement, spans, or implicit grids; optional Grid implements numeric placement through `/layout`.
- When an explicit track list is provided, its length equals the child count.
- `Rows` / `Columns` with no explicit tracks treat each child as `auto`.

## Preferred-size pass

Preferred size is pure and host-independent.

### Text preferred size

- Measure newline-delimited line boundaries and widths with the shared Unicode policy.
- Width is the maximum line cell width.
- Height is the number of explicit lines.
- An empty string has one line of width zero.
- The first measurement of a value may scan its complete current source once to build compact exact per-line metrics. It prepares no grapheme arrays or cell data for offscreen lines, and it retains no second complete-source string.
- Later frames reuse those metrics while their source boundaries remain valid. Append and extension updates continue the current line width from retained Unicode boundary state instead of revisiting finalized graphemes. A replacement invalidates every metric whose source boundary is no longer proven.

### Box preferred size

Chrome is added after child content:

- padding contributes its integer edge sizes;
- a border contributes one cell on each of its four edges;
- gap contributes `gap * max(0, childCount - 1)` on the main axis.

For a row:

- preferred width is the sum of child main-axis preferred/fixed sizes plus gaps;
- preferred height is the maximum child preferred height.

For a column:

- preferred height is the sum of child main-axis preferred/fixed sizes plus gaps;
- preferred width is the maximum child preferred width.

For a no-axis box:

- preferred content size is its only child's preferred size or zero.

In preferred-size calculation, a fraction track behaves like `auto`. Fractions only divide concrete remaining space during layout.

## Parent-to-child layout pass

Layout begins with the exact root rectangle and allocates children top-down.

For each box:

1. Reserve border cells.
2. Reserve padding cells.
3. The remainder is the inner content rectangle.
4. Reserve total gap cost.
5. Resolve fixed tracks.
6. Resolve `auto` tracks from preferred sizes.
7. Compute positive remaining main-axis space.
8. Resolve fraction tracks proportionally.
9. Allocate one exact track rectangle per child in source order.
10. Intersect each descendant clip with its ancestor clip.

Fraction rounding:

- floor each proportional allocation;
- distribute the remainder from the first fraction track to the last;
- resolved sizes are always integers.

Overflow:

- Fixed and `auto` tracks are not silently shrunk when they exceed available space.
- Fraction tracks receive zero when no positive remainder exists.
- Overflowing frames remain deterministic and are cut by clips.
- No second negotiation pass changes sibling allocation.

Cross axis:

- A child receives the full available track cross-axis rectangle.
- Background/border paint uses the allocated frame.
- Intrinsic content aligns inside the frame using explicit start/center/end alignment.
- There is no accidental child-size-dependent stretch rule.

## Gap, padding, alignment, and border

These are semantic fixed-cell features, not CSS emulation.

- Gap is a non-negative integer between sequential children.
- Padding is a non-negative integer per edge or shorthand.
- `Text.align={{ x, y }}` accepts `start`, `center`, or `end` on either axis.
- A border is shared glyph data plus semantic style and consumes enabled edge cells.
- Border titles replace a clipped run of top-border cells.
- Unsupported combinations fail deterministically rather than falling back to browser layout.

Margins, percentage units, viewport units, min/max negotiation, and negative positions do not exist.

## Text and Unicode

### Frozen text behavior

- Only explicit `\n` creates a new line.
- Base `Text` never wraps.
- Height overflow cuts whole or partial visible lines by the scene clip.
- Width overflow uses an explicit mode:
  - `clip` (default),
  - `ellipsis-start`,
  - `ellipsis-middle`,
  - `ellipsis-end`.
- Ellipsis is generated in the shared scene, not with CSS.
- DOM and TUI receive the same visible grapheme sequence.

### Cellization policy

The implementation exposes `UNICODE_VERSION = "17.0.0"` and `CELL_WIDTH_IMPLEMENTATION = "faux-ui-unicode-17"` to tests/inspection. Unicode data is generated by `scripts/generate-unicode-data.mjs` and committed into the package.

The shared cellizer:

- segments extended grapheme clusters;
- assigns deterministic widths of 0, 1, or 2;
- treats East Asian ambiguous width as 1;
- attaches zero-width combining clusters to a leading cell when valid;
- reserves a continuation cell for width-2 graphemes;
- renders unsupported controls as `�`;
- expands tabs to the next four-cell stop;
- renders a leading zero-width cluster with a dotted-circle base.

A Unicode data/version change is a semantic change and requires updated golden tests.

Logical cell equality is guaranteed. Physical glyph artwork may still vary by terminal and installed browser font.

### Large text and windowed rendering

Base `Text` accepts either string children or `source={textSource}`, never both. String text keeps its exact preferred size, scene, scrolling, and interaction behavior. A changed string cannot prove an unchanged prefix, so Faux UI re-indexes it. Bounded incremental work applies only to `TextSource` updates.

The root package exports:

```ts
type TextSourceSegment = Readonly<{ id: string; text: string }>;

createTextSource(segments?: readonly TextSourceSegment[]): TextSource;
appendTextSourceSegment(source: TextSource, segment: TextSourceSegment): TextSource;
extendTextSourceSegment(source: TextSource, id: string, delta: string): TextSource;
replaceTextSourceSegment(source: TextSource, id: string, text: string): TextSource;
```

`TextSource` is immutable, renderer-neutral, and exposes no mutable representation. Its logical value is the exact ordered concatenation of segment text with no inserted separator. Creation establishes or resets that complete value, append adds one new segment in source order, extend adds a delta to the named segment's end, and replace swaps the named segment's complete text without moving it. Every operation returns a new source that structurally shares unchanged segments. Creation and append snapshot the supplied `id` and `text` fields, so later caller mutation cannot change the source. Segment IDs are nonempty and unique within a source.

Empty IDs and mixed string children plus `source` throw `TypeError`. Duplicate IDs and missing extension or replacement targets throw `RangeError`. Every failure leaves the prior source unchanged.

The bounded-work limit differs by operation:

- `createTextSource` builds a fresh index for the new value and reuses nothing from a prior value.
- `appendTextSourceSegment` processes the appended delta, the prior unfinished grapheme and boundary state, required compact index updates, and the current prepared window. Its work does not grow with preceding segments, complete lines, or finalized graphemes.
- `extendTextSourceSegment` keeps the same bound when the named segment is not final. It resumes from that segment's recorded boundary state instead of rescanning its retained prefix.
- `replaceTextSourceSegment` invalidates every derived value whose source boundary is no longer proven. The next frame rebuilds the affected line and following compact line metadata, not the retained grapheme history.
- Neither Faux UI nor callers treat string equality, length, `startsWith`, or full-prefix comparison as append identity.

React may commit a later source after intermediate immutable sources were created and skipped. The mounted index retains the last source it rendered and compares persistent order, segment, trie, and chunk identities. A proven append or extension processes only the changed chunks and their unfinished Unicode boundary state. A mixed update preserves every proven range before the earliest changed or uncertain boundary and rebuilds the affected suffix. A reset, an unrelated source, or a pair with no safe shared boundary rebuilds the complete source. No chain of skipped source versions is retained.

Scene painting prepares only the visible viewport plus at most one viewport before and after it on each enabled scroll axis. A clipped axis that is not scroll-enabled gets no overscan. Prepared cell slots stay within one viewport area without scrolling, three viewport areas for one-axis scrolling, and nine viewport areas for two-axis scrolling. When a compatible prepared window moves, the cache retains the old and new intersection and prepares only the entering strips; cells and overflow entries outside the new window are evicted. A resize, a non-overlapping jump, a rendering-mode change, or an unproven source update clears the cache.

Cell slots are not a byte bound. The store counts copied glyph-payload UTF-16 code units separately from cell slots, retains source ranges where possible, releases payload for evicted windows and obsolete source versions, and never retains a duplicate string for the complete source. An arbitrarily large visible or newly extended grapheme counts as changed or visible source data, not constant cache overhead.

Derived state is mount-local. A replacement drops stale line boundaries, widths, checkpoints, prepared cells, copied payload, source references, and scroll extents before the next frame. Removing a node, unmounting, a failed initial mount, and repeated cleanup release that mount's entries exactly once. Disposing one mount does not change another mount's text, metrics, or scrolling.

At an unchanged viewport, a repaint inspects no source line outside the prepared vertical window and prepares no horizontal cell outside the bounded horizontal window, except where an uncached end alignment or ellipsis operation needs source text that compact metrics do not contain. The scene matches the eager text rules at every valid offset.

## Scroll semantics

`ScrollView` is a semantic viewport around one child.

- Its allocated frame is the viewport.
- Its content extent is derived from child preferred size and layout.
- On a scroll axis, content extent is at least viewport extent and may be larger.
- On a non-scroll axis, the child uses the viewport extent.
- Offset is controller state, not a semantic prop or layout input.
- `followEnd` accepts `boolean | ScrollAxis`: omission or `false` follows neither axis, `true` follows every enabled axis, and `"x"`, `"y"`, or `"both"` follows only the named enabled axes. Naming a disabled axis follows nothing on that axis.
- Following is per axis: the initial viewport starts at the end of each selected enabled axis, and an axis keeps following only while its own prior effective offset was at its end.
- Manual scrolling away from an end suspends following for that axis; returning to the end resumes it there on the next content growth.
- Effective offset is clamped to `0...max(0, content - viewport)` per enabled axis.
- Changing offset does not change the layout tree.
- Wheel, terminal mouse, keyboard commands, and testing controls all update the same controller state.
- Optional scrollbar chrome is painted from viewport/content/offset data into the shared scene; it requires no React runtime bridge.

## Canonical cell scene

A logical scene has exact root width/height and row-major cells.

Conceptually:

```ts
type Cell = {
  glyph: string;
  continuation: boolean;
  foreground: SemanticColor;
  background: SemanticColor;
  ownerId: number | null;
};
```

The final concrete shape may optimize storage, but observable behavior is equivalent.

Paint order:

1. root/default surface;
2. box backgrounds and inherited styles;
3. borders, titles, fills, and scroll chrome;
4. text content;
5. focus/hover style projection according to the same node style rules.

All painting respects effective clips. Fully clipped content produces no scene writes.

Controller reconciliation reads the freshly painted scene for visibility and focusability checks. Faux UI paints the scene once, reconciles the controller against it, and paints one corrective scene only when reconciliation reports a paint-relevant change such as a moved offset or focus. The corrected scene becomes the controller's hit-test scene and the frame hosts receive. An unchanged repaint therefore paints one canonical scene, not two.

The scene is the source for:

- TUI ANSI output;
- DOM glyph/style runs;
- snapshots;
- inspection;
- point ownership where applicable.

## Theme semantics

A theme maps the fixed semantic palette to concrete host colors.

The initial semantic names are:

- `fg`, `muted`, `inverse`;
- `bg`, `panel`, `selection`, `focus`;
- `accent`, `success`, `warning`, `danger`;
- `border`.

Rules:

- Components consume semantic names or small semantic tones, not DOM colors.
- TUI and DOM use the same active mapping.
- Both hosts ship the same usable default palette.
- DOM CSS variables may implement concrete colors internally, but they are not layout inputs.
- Theme context contains theme data only; it has no renderer/runtime adapter.

## Interaction semantics

The shared controller owns interaction state and dispatch.

### Focus

- Only explicitly focusable nodes enter focus order.
- Focus order is semantic tree preorder among currently mounted/visible eligible nodes.
- Next/previous traversal is shared and deterministic.
- Removing/invalidating the focused node emits blur and resolves focus according to the controller rule.
- DOM native focus is an adapter mechanism, never semantic truth.

### Keyboard

- Key payloads use normalized shared key names plus modifier state.
- Key events target the focused path when focus exists.
- Root key handlers also receive app-level keys.
- With no focused child, root handlers can still receive keys.
- Host default behavior is prevented only when shared handling requests it.

### Activation

- `Button` exposes one `onPress` contract.
- Enter, Space, and a completed primary pointer click synthesize one press.
- A single host action must not call `onPress` twice.
- Disabled buttons are not focusable or activatable.
- `keyHint` is display-only; shortcut registration remains explicit through `useInput`.

### Pointer and hover

- Hosts convert input to logical cell points before dispatch.
- Hit testing uses shared layout/scene ownership.
- Hover path is controller state used by both hosts.
- Pointer press/move/release details may remain low-level APIs, but cannot alter host parity.

### Bubbling

- Dispatch follows target-to-root semantic ancestry.
- Event payload exposes target/current target and `stopPropagation()`.
- Handler ordering is deterministic and contract-tested.
- JSX handlers are functions only; serialized action strings do not exist in the core/public React model.

## DOM host requirements

- Render one fixed-cell application surface from canonical scene rows/style runs.
- Use monospace text and connection-safe terminal-graphics font stacks, disable ligatures, and calibrate/final-fit glyph runs to exact logical cell widths without sharing text letter-spacing adjustments with graphics runs.
- Keep connectable Unicode glyphs as text; do not stretch their height or replace them with geometric overlays.
- Paint adjacent run backgrounds without fractional-scale seams.
- Normalize one conventional browser wheel notch to one logical cell; accumulate sub-cell pixel deltas.
- Install the minimal sizing/margin/overflow reset needed by the host.
- Require no app-authored CSS for the default full viewport path.
- Convert pointer pixels to cells using actual surface geometry and logical dimensions.
- Never use browser flow, Flexbox, Grid, canvas text measurement, or child DOM dimensions for semantic layout.
- Importing the DOM entry must not load TUI/Node code.
- Expose one `role="application"` tab stop with an `aria-label`.
- Project labeled semantic actions as visually hidden descendants and point `aria-activedescendant` at shared focus; native DOM focus is not semantic truth.

## TUI host requirements

- Serialize the canonical scene with the active palette.
- After the first frame, write only changed visible rows or an equivalent bounded update instead of clearing the screen.
- Redraw completely on the first frame after start, a resize, a palette change, or an invalidated output state; a frame with no visible or style changes writes nothing.
- Invalidate the retained projection after a failed write so the next frame redraws completely.
- Translate terminal input and resize into shared controller commands/root sizes.
- Keep ANSI protocol parsing, raw mode, alternate screen, cursor, autowrap, and mouse negotiation host-local.
- Prevent terminal right-margin autowrap from changing logical row placement.
- Re-anchor after non-ASCII graphemes so terminal-specific Unicode-width disagreement cannot shift subsequent cells.
- Restore terminal state on unmount, error, and normal exit.
- Import no DOM code.

## Inspection and testing contract

`@faux-ui/ui/testing` may expose stable read-only representations of:

- semantic tree;
- preferred sizes and layout tree;
- canonical cell scene;
- controller event trace;
- `TextSource` segments and chunks;
- compact text index snapshots, including line ranges, widths, unfinished grapheme, and boundary state;
- deterministic render-work counters.

Inspection helpers are functions, not a fake renderer.

The work counters report source code units inspected, metadata records searched, logical lines indexed, graphemes prepared, cell slots retained, copied glyph-payload code units retained, cells painted, and entries disposed. Source-code-unit counts include every code unit passed through grapheme segmentation, including a retained unfinished grapheme combined with a new delta. Explicit newline code units are not counted because they never enter segmentation. Metadata-search counts report examined line, segment, and chunk records, and retained-prefix lookup is bounded rather than linear in history.

Conformance requires:

- deterministic unit/property tests for layout;
- pinned Unicode/cellization golden tests;
- canonical scene snapshots;
- deterministic work and memory-accounting regressions for indexing, preparation, retention, and disposal;
- an eager comparison for preferred geometry, scenes, and offsets;
- identical cross-host controller traces and large-text host parity;
- real-browser pixel-to-cell tests;
- ANSI/terminal lifecycle tests;
- packed-package consumer tests with typecheck and browser bundle checks;
- the recorded `large-text-benchmark-v1` reference protocol for wall-clock gates.

Tests must be included in a TypeScript check; transpile-only test success is insufficient.

## First-release non-goals

- automatic wrapping in base text;
- general grid, named placement, spans, overlap, negative layout positions;
- margins, percentages, min/max, aspect ratio, responsive breakpoints;
- DOM-native controls/forms;
- rich text editor/input caret semantics;
- general virtualized list, table, tree, or collection components (windowed in-memory text rendering belongs to the text contract);
- serialized/compact schema;
- create/exec/MCP CLIs;
- public third-party renderer API;
- compatibility aliases for prototype packages.

## Evolution rule

A feature enters core/public foundation only when all are true:

1. It is renderer-neutral.
2. TUI behavior can be specified first.
3. DOM can project the same logical scene/interaction.
4. It cannot be expressed cleanly from existing foundation components.
5. At least one serious fixture or two real applications justify it.
6. It adds executable cross-host tests.

Otherwise it remains a recipe, app component, or deferred idea.
