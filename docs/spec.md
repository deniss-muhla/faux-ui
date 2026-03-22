# faux-ui Specification

## Purpose

faux-ui is a deterministic cross-renderer UI framework built around strict constraint algebra, explicit track resolution, and a hard separation between layout and rendering.

This specification freezes the core behavioral rules without importing hidden semantics from the DOM, CSS Grid, Flexbox, or existing TUI layout systems.

## Baseline

- Workspace and package management: Bun
- Runtime compatibility target: Node 22+
- TypeScript baseline: 5.9 stable
- TypeScript canary lane: 6.0 beta
- Authoring formats: JSX and JSON
- Canonical runtime semantics: shared across JSX and JSON

## Core Philosophy

- TUI is the canonical layout model.
- DOM is an alternate renderer that must mirror TUI semantics 1:1.
- Root containers are always explicitly bounded on both axes.
- All layout units are virtual cell units: x = one character width, y = one character height.
- Text never wraps automatically; it is clipped by the allocated frame.
- No spanning
- No gaps
- No min constraints
- No accidental flow semantics
- No implicit placement negotiation
- No negative coordinates in layout space
- Layout and render phases are strictly separated
- Scroll is represented in the core semantics but applied as a render transform
- The engine is smaller than CSS Grid by design

## Layout Primitives

### Size

```ts
type Size = {
  width: number;
  height: number;
};
```

### Constraints

```ts
type Constraints = {
  maxWidth?: number;
  maxHeight?: number;
};

type RootConstraints = {
  maxWidth: number;
  maxHeight: number;
};
```

Rules:

- Constraints are max-only.
- The root always receives explicit bounded constraints on both axes.
- A child may choose any size less than or equal to the provided max.
- `undefined` means the axis is unbounded inside the tree.
- Parents clamp returned child frame sizes to the provided max.

Clamp rule:

```ts
function clampSize(size: number, max?: number): number {
  return max === undefined ? size : Math.min(size, max);
}
```

### Track Language

```ts
type Track =
  | { type: "fixed"; size: number }
  | { type: "content" }
  | { type: "fraction"; weight: number };
```

Shorthand:

```ts
type TrackShorthand = number | "auto" | `${number}fr`;
```

## Deterministic Track Resolution

```ts
function resolveTracks(
  tracks: Track[],
  maxSize: number | undefined,
  measureContentTrack: (trackIndex: number) => number,
): number[];
```

Algorithm:

1. Resolve fixed tracks directly.
2. Resolve content tracks using `measureContentTrack()`.
3. Resolve fraction tracks.
   - If `maxSize` is undefined, fraction tracks behave like content tracks.
   - If `maxSize` is defined, allocate remaining space proportionally.
4. All track sizes are integers.
5. Fraction rounding uses floor, then distributes the remainder left-to-right so the final sum equals `maxSize` when bounded and remaining space is positive.

Important frozen rules:

- Track resolution is axis-local.
- Track resolution does not depend on placement negotiation.
- Child placement is strictly index-based.
- `measureContentTrack()` must not be called more than once per track within a single resolution pass.

## Container Semantics

There are only two author-facing primitives in the base model:

- `View`
- `Text`

Scroll is a semantic property on `View`, not a separate runtime node kind.

### View

```ts
type ViewProps = {
  children?: ReactNode;
  rows?: TrackShorthand[];
  columns?: TrackShorthand[];
  scroll?: "x" | "y" | "both";
  style?: {
    color?: SemanticColor;
    background?: SemanticColor;
  };
  styleHover?: {
    color?: SemanticColor;
    background?: SemanticColor;
  };
  styleFocus?: {
    color?: SemanticColor;
    background?: SemanticColor;
  };
  focusable?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyEvent) => void;
  onKeyUp?: (e: KeyEvent) => void;
  onPress?: () => void;
  onClick?: (e: MouseEvent) => void;
  onMouseDown?: (e: MouseEvent) => void;
  onMouseUp?: (e: MouseEvent) => void;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onMouseMove?: (e: MouseEvent) => void;
  onDragStart?: (e: PointerEvent) => void;
  onDrag?: (e: PointerEvent) => void;
  onDragEnd?: (e: PointerEvent) => void;
  onScroll?: (e: ScrollEvent) => void;
};
```

Shared pointer payload:

```ts
type PointerEvent = {
  point: { x: number; y: number };
  button: "primary" | "middle" | "secondary" | null;
  modifiers: {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  };
};
```

Frozen interaction rules:

- Existing mouse binding names remain valid and unchanged.
- Drag lifecycle is additive: `onDragStart`, `onDrag`, and `onDragEnd` are synthesized from the same down-move-up path used by runtime pointer dispatch.
- Button identity and modifier keys are runtime metadata, not layout state.
- DOM and TUI project into the same pointer payload shape even when the underlying native event sources differ.

Placement model:

- If only `rows` is defined, layout is vertical 1D.
- If only `columns` is defined, layout is horizontal 1D.
- If both are defined, layout is a grid.
- If neither is defined, the container behaves like a single `1fr x 1fr` cell.
- Child assignment is strictly by index order.
- Missing children yield empty cells.
- Extra children beyond available cells are a deterministic runtime error.

Cross-axis alignment:

- Children do not stretch by default.
- Fixed and content tracks provide bounded max constraints; the child keeps its intrinsic size.
- Fraction tracks on a bounded axis imply a tight size equal to the resolved track size.
- Otherwise, children align top-left and unused space remains unused.

### Text

```ts
type TextProps = {
  children: string;
  style?: {
    color?: SemanticColor;
    background?: SemanticColor;
  };
};
```

Frozen text rules:

- Width is the longest newline-delimited line length in characters.
- Height is the number of newline-delimited lines.
- Renderers do not wrap text automatically.
- If a frame is smaller than the intrinsic text extent, rendering is clipped.
- Unicode box-drawing and pseudo-graphics are semantic content and must render the same in TUI and DOM.

## Scroll Model

Scroll is part of core semantics, but the offset itself is render-only state.

Frozen behavior:

1. A scroll-enabled view receives bounded frame constraints.
2. It may pass an unbounded constraint on the scroll axis to its child subtree.
3. Text nodes compute intrinsic content size from character counts and newline counts.
4. Views bubble content size upward from child positions plus child intrinsic content extent.
5. The scroll container stores both viewport size and content size.
6. Render applies clipping and scroll offset transforms.
7. Scroll offset changes do not invalidate layout.

## Trees and Internal Architecture

### Authoring and Runtime Layers

- Element specification: pure data, serializable, author-facing
- `UINode`: mutable semantic and layout state
- `RenderNode`: absolute paint and hit-test state

### UINode

`UINode` is the stable mutable tree used by reconciliation, invalidation, layout caching, and action binding lookup.

Frozen rules:

- `UINode` does not store absolute render coordinates.
- Layout state caches live on the node.
- Props remain pure input and do not store measured sizes.
- Scroll offsets do not live in layout state.

### RenderNode

`RenderNode` stores:

- absolute coordinates
- clip rectangles
- render-phase scroll offsets
- render hierarchy used for hit testing and event dispatch

Event dispatch bubbles through `UINode` ancestry after hit testing on the render tree.

## Invalidation and Caching

Every node maintains:

- `dirtyLayout`
- `dirtyIntrinsic`
- `dirtyPaint`
- cached constraints
- cached size
- content size for scroll containers

Frozen invalidation rules:

- Text content changes dirty intrinsic, layout, and paint.
- Track changes dirty layout and paint.
- Style changes dirty paint only.
- Scroll offset changes dirty render state only.

Text measurement requires a cache key that includes at least:

- text content
- wrap flag
- `maxWidth`
- style token
- renderer identity

## Renderer Rules

### DOM

The DOM renderer is a dumb paint surface.

It must use absolute positioning and may not rely on browser layout systems for container sizing or placement.

### TUI

The TUI renderer owns frame buffer construction, clipping, scroll transforms, and hit testing.

The engine operates in integer logical units only.

## Public Monorepo Shape

- `@faux-ui/core`
- `@faux-ui/app`
- `@faux-ui/reconciler`
- `@faux-ui/render-dom`
- `@faux-ui/render-tui`
- `@faux-ui/schema`
- `@faux-ui/devtools`
- `@faux-ui/mcp`
- `create-faux-ui`
- `exec-faux-ui`

## CLI Contract

Public binaries:

- `create-faux-ui`
- `exec-faux-ui`

Current intended interface:

```bash
create-faux-ui <name> [--template jsx|json|hybrid] [--pm bun|npm|pnpm]

exec-faux-ui <entry>
  --target dom|tui
  [--watch]
  [--inspect]
  [--open]
  [--port <n>]
  [--format auto|jsx|json|compact]
  [--snapshot <path>]
  [--dump-layout]
  [--dump-tracks]
```

## Testing Strategy

- `Vitest` for unit and integration tests
- `fast-check` for property testing of track resolution invariants
- `Playwright` for DOM visual regression and interaction tests
- serialized frame-buffer snapshots for TUI regressions

Initial executable spec priority:

1. `resolveTracks()`
2. placement mapping
3. max-only constraint propagation
4. scroll container layout behavior

## Non-Goals for This Scaffold

- Virtualized layout
- Spanning
- Alignment properties beyond the frozen default
- Min constraints
- Browser-driven or Ink-driven layout semantics

## Implementation Bias

The implementation should prefer:

- deterministic data flow
- explicit intermediate data structures
- additive evolution over clever abstraction
- side-effect-free layout computation with explicit cache commit steps
- observability through tree dumps, track logs, and timing hooks
