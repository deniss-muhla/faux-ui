# faux-ui Architecture

This document explains the current implementation architecture of faux-ui. It complements [docs/spec.md](docs/spec.md): the spec freezes semantic rules, while this document describes how those rules are currently realized across packages.

## Goals

faux-ui is organized around a small set of architectural constraints:

- one semantic model shared across renderers
- TUI-first semantics with DOM as a projection, not a source of layout truth
- deterministic fixed-cell layout with no CSS-style negotiation
- strict separation between layout and render phases
- event dispatch based on a renderer-neutral render tree
- renderer packages that stay thin by delegating semantics to `@faux-ui/core`
- authoring formats that can differ at the edges while converging on the same runtime model

Those constraints are visible throughout the repository structure and in the main runtime pipeline.

## System Overview

```mermaid
flowchart LR
  A[JSX authoring] --> B[@faux-ui/reconciler]
  A --> Q[@faux-ui/app]
  J[JSON authoring] --> K[@faux-ui/schema]
  Q --> F[@faux-ui/render-dom]
  Q --> G[@faux-ui/render-tui]
  B --> C[UINode tree]
  K --> C
  C --> D[layoutNode]
  D --> E[buildRenderTree]
  E --> F
  E --> G
  E --> H[event hit testing]
  H --> I[direct handlers owned by the app]
```

In practice, the runtime is centered on three progressively more concrete layers:

1. Authoring data: JSX props or JSON document specs.
2. Semantic runtime state: the mutable `UINode` tree in `@faux-ui/core`.
3. Render state: a visible-only render tree used for painting, clipping, hit testing, and event targeting.

The architecture deliberately avoids pushing renderer-specific behavior into the semantic layer. DOM and TUI share the same fixed-cell layout, render-tree, and dispatch semantics. DOM differs only in projection and native input plumbing.

## Package Responsibilities

### `@faux-ui/core`

`@faux-ui/core` is the semantic source of truth.

It owns:

- normalized track and constraint types
- `UINode` creation and mutation helpers
- layout computation and layout cache reuse
- render-tree construction and render-tree cache reuse
- renderer-neutral hit testing and bubbling-oriented event dispatch
- default semantic colors used by both DOM and TUI renderers

No renderer package redefines these rules. That is the main architectural guardrail in the repository.

### `@faux-ui/reconciler`

`@faux-ui/reconciler` is the current JSX bridge.

It converts React host instances into `UINode` objects, exposes the faux-ui intrinsic host types, and maps shorthand event props such as `onClick` and `onKeyDown` into core binding slots. JSX event props can now be either direct application-owned handler functions or semantic action identifiers. The reconciler does not perform layout, rendering, or app-state orchestration. Its job is to maintain the semantic tree and preserve the framework's authoring constraints, such as raw text only being legal inside `text`.

The reconciler also provides a custom JSX import source (`@faux-ui/reconciler/jsx-runtime`) that restricts intrinsic elements to `view` and `text` at compile time, preventing accidental use of standard HTML tags in faux-ui JSX files.

### `@faux-ui/app`

`@faux-ui/app` is the public app-facing facade.

It provides:

- `render()` as the single app entrypoint
- renderer selection through registered renderer definitions rather than direct platform checks in app code
- a boundary that keeps app code away from renderer-specific packages by default

This package exists to reduce boilerplate without moving renderer-specific behavior into `@faux-ui/core`.

### `@faux-ui/renderer`

`@faux-ui/renderer` defines the neutral renderer contract.

It provides:

- a stable `RendererDefinition` shape for environment detection, render entry, and optional renderer-owned theme application
- a shared `mountRendererApp()` helper that turns React commits into mounted faux-ui roots without duplicating renderer bootstrap code
- selection helpers so `@faux-ui/app` can pick a renderer without embedding platform-specific checks itself

This package is intentionally host-neutral. It knows how to orchestrate renderer definitions, not how any specific platform works.

### `@faux-ui/render-dom`

`@faux-ui/render-dom` turns the shared render tree into browser-shaped output.

It provides:

- DOM model projection from the render tree
- a live mounting runtime for a host container
- browser-style pointer, wheel, keyboard, and focus routing back into core dispatch helpers
- a `domRenderer` definition that owns browser detection and browser-specific theme installation
- `render()` for the common browser path, with auto-body mounting, auto-cell-constraint measurement, auto-resize via `ResizeObserver`, auto-installation of core default colors as CSS variables, and auto-rerender on React state changes via the shared renderer app helper
- `applyDomTheme()` for manual theme control
- optional re-exports of `View`, `Text`, `ViewProps`, and `TextProps` for `createElement`-style usage, while normal JSX can use `<view>` and `<text>` directly

DOM remains a projection target, not the semantic authority. It renders the same text, cell coordinates, clipping, and pseudo-graphics as TUI using monospace metrics.

### `@faux-ui/render-tui`

`@faux-ui/render-tui` turns the shared render tree into a character-cell framebuffer.

It provides:

- framebuffer painting
- coordinate-based input dispatch helpers for cell positions
- a `tuiRenderer` definition that owns non-browser detection for the terminal path
- `render()` for the common interactive terminal path, with auto-rerender on React state changes via the shared renderer app helper
- optional re-exports of `View`, `Text`, `ViewProps`, and `TextProps` for `createElement`-style usage, while normal JSX can use `<view>` and `<text>` directly

Like DOM, it depends on the shared render tree instead of reimplementing layout or event semantics.

### `@faux-ui/render-inspect`

`@faux-ui/render-inspect` is a first-party reference renderer built on the same neutral contract that external contributors use.

It provides:

- a deterministic text snapshot of the mounted `UINode` tree
- an example theme-target helper that stores renderer-applied semantic tokens for tests and tooling
- an exported capability and metadata object that shows one way to keep renderer-specific surface details close to the renderer package itself

This package is intentionally simple. It exists to prove the contributor template shape against a real first-party package and a real first-party app.

### `@faux-ui/schema`

`@faux-ui/schema` defines the portable document format for non-JSX authoring.

It contains:

- readable document types
- validation
- compact encode/decode support

This package describes authoring data, not live runtime state.

### Tooling packages

Several packages intentionally remain thin but already define architectural seams:

- `@faux-ui/devtools`: formatting helpers such as layout dumps for inspection and debugging
- `@faux-ui/mcp`: command types for future model-context and inspection workflows
- `create-faux-ui`: starter generator for JSX apps, schema-authored documents, hybrid starters, and contributor-facing renderer package templates
- `exec-faux-ui`: execution and inspection CLI for schema-authored documents and TUI demos

These packages matter architecturally because they show the intended integration surface without forcing runtime concerns into the core engine yet.

## Runtime Layers

### Authoring Layer

The repository currently supports two authoring directions:

- JSX through `@faux-ui/reconciler`
- JSON-compatible documents through `@faux-ui/schema`

Both paths are intended to converge on the same semantic runtime rules. The authoring layer is allowed to be ergonomic, but it is not allowed to invent alternate layout or dispatch semantics.

### Semantic Layer: `UINode`

`UINode` is the mutable tree used by reconciliation and caches.

Important characteristics:

- it stores semantic props and child relationships
- it stores dirty flags and subtree revisions
- it stores cached layout results
- it does not store absolute screen coordinates
- it does not treat scroll offset as layout state

This separation keeps layout deterministic and allows scroll changes to remain render-phase updates.

### Render Layer: `RenderTree`

The render tree is built from the `UINode` tree after layout.

Each render node carries:

- absolute frame
- effective clip rectangle
- content size
- render-phase scroll offset
- visible children only

The render tree is the bridge between semantic state and renderer-specific painting. It is also the structure used for hit testing and event target resolution.

## Main Data Flow

### 1. Tree Construction

Reconciliation or document loading produces a `UINode` tree.

At this point the tree contains semantic information only: tracks, text content, styles, focusability, and bound actions. In JSX those actions can be direct handler functions. In schema-authored documents they remain semantic action identifiers. The tree does not yet have absolute positions.

### 2. Layout

`layoutNode()` in `@faux-ui/core` computes sizes under max-only constraints.

The layout pipeline follows these rules:

- the root always starts with explicit bounded constraints
- text extent is computed in core from character counts and newline counts
- view tracks are normalized into a simple grid model
- content and fixed tracks are resolved before fraction tracks
- scrollable axes pass unbounded constraints into descendants while retaining bounded viewport size at the container
- child placement is strictly index-based
- each node tracks both an allocated frame size and an intrinsic content extent for scroll overflow
- the resulting layout state is cached on each node

For views, layout records more than final size. It also stores:

- resolved row sizes
- resolved column sizes
- child frames relative to the parent
- content size used by scroll containers

That cached structure is later consumed by render-tree construction.

### 3. Render-Tree Build

`buildRenderTree()` converts cached layout output into an absolute, clipped render tree.

This phase:

- starts from the root frame at `(0, 0)`
- applies scroll offsets as render transforms
- intersects each child with its inherited clip rectangle
- drops fully clipped descendants
- preserves only the visible hierarchy needed for painting and hit testing

This is a key design choice: painting and interaction operate on visible output, not on the full semantic tree.

### 4. Renderer Projection

Renderers consume the shared render tree.

For DOM:

- `renderToDomModel()` projects the tree into absolute-positioned DOM model nodes in cell units
- `mountDomRoot()` turns that model into live elements inside a host container
- `render()` provides a renderer-owned successful path above raw root management

For TUI:

- `renderToFrameBuffer()` paints the tree into a framebuffer using the same fixed-cell coordinates used by layout
- `render()` provides a renderer-owned successful path above raw host wiring

The renderer packages stay narrow because core has already solved placement, clipping, and hit-test geometry.

### 5. Event Dispatch

Input is mapped back into render-space coordinates and dispatched through core helpers.

The dispatch flow is:

1. hit test the render tree at a point
2. recover the render-path from target to root
3. collect matching bindings from target outward
4. return tokens to application-owned handling code

Focus targeting uses the same path but resolves the nearest focusable view. This keeps event routing renderer-neutral while letting each runtime adapt native events into common bindings.

## Layout and Cache Model

The cache model is intentionally explicit.

Each node tracks:

- `dirtyLayout`
- `dirtyIntrinsic`
- `dirtyPaint`
- cached constraints
- cached size
- cached subtree revision
- optional content and child-frame data

Layout cache reuse requires all of the following:

- layout is not dirty
- cached constraints match the requested constraints
- cached subtree revision matches the current subtree revision

Render-tree cache reuse is slightly different. It depends on:

- paint not being dirty
- subtree revision stability
- identical root constraints
- identical scroll offsets

This split allows style and scroll changes to invalidate cheaper stages than full semantic reconstruction.

## Scroll Model

Scroll is modeled semantically on `View`, but its offset is not part of layout state.

Current behavior:

- scrollable containers measure content on an unbounded scroll axis
- the container still reports a bounded viewport size when constrained
- content size is cached for later render and interaction use
- scroll offsets are injected when building the render tree or mounting DOM
- changing scroll offset should not require re-running layout

This is one of the clearest examples of the architecture's phase separation: layout computes geometry for the full content, while rendering applies the viewport transform.

## Event and Focus Architecture

Bindings are stored on semantic nodes but resolved through render hits.

That gives the system two useful properties:

- bubbling follows visible targeting rather than stale semantic geometry
- renderer runtimes can stay dumb about ancestor traversal rules

Current binding surface includes:

- focus and blur
- key down and key up
- press
- click
- mouse down, mouse up, mouse enter, mouse leave, mouse move
- scroll

Binding values in core are stable string or numeric tokens. The application owns what those tokens mean and can resolve dispatch results into its own handler objects through a renderer-neutral core helper.

## Renderer-Specific Notes

### DOM

The DOM runtime is the most complete integration layer today.

It keeps responsibility boundaries relatively clean:

- browser measurement stays in DOM-specific adapters
- layout and clipping stay in core
- native events are translated into core binding dispatch
- focus state is tracked by node id while native focus and blur events are synchronized back into that runtime state

The DOM runtime also keeps a map of focusable nodes, supports managed scroll offset updates from wheel input, tracks hover transitions over the shared render tree, projects hover and focus state into DOM styles, and flushes stale interaction state during rerender and unmount transitions.

### TUI

The TUI package now includes a runtime controller around the framebuffer renderer.

It provides:

- character-cell text measurement
- framebuffer painting
- coordinate-based input dispatch helpers for cell positions
- focus traversal, key dispatch, pointer dispatch, and managed scroll offset updates for host-driven terminal loops

This keeps the architectural claim intact: the same layout and render tree can drive a browser-shaped runtime and a character-cell runtime with only measurement, painting, and host event plumbing swapped out.

## Schema and Portability

`@faux-ui/schema` exists to keep authoring portable and explicit.

The readable schema mirrors the same concepts exposed in JSX:

- `view` and `text` nodes
- tracks and scroll axes
- semantic colors and style states
- binding names

The compact format is optimized for transfer or storage, but it still describes semantic input. It is not a serialized form of `UINode` or the render tree.

That distinction prevents accidental coupling between interchange format and runtime cache structures.

## Tooling and Inspection Direction

The repository already hints at the intended tooling architecture:

- devtools can inspect derived runtime state such as layout dumps without becoming a renderer
- MCP-facing types can expose validation, rendering, and inspection commands without changing engine semantics
- CLI packages can sit above the shared engine and choose authoring format plus renderer target at runtime

These are useful seams because they keep the core packages reusable from tests, CLIs, editors, and future automation surfaces.

## Current Gaps

The architecture is established, but several edges are intentionally unfinished:

- no full TUI event loop yet
- no browser visual regression layer yet
- no completed scaffold or execution CLI flow
- no hydration or persistence story in the reconciler

These gaps do not change the core layering; they mainly affect integration completeness.

## Architectural Summary

The repository is already organized around a stable center of gravity:

- `@faux-ui/core` owns semantics, layout, render-tree construction, and dispatch
- authoring packages feed that core
- renderer packages project from the same render tree
- tooling packages inspect or orchestrate the system from the outside

That is the main implementation bet in faux-ui: one deterministic semantic engine, multiple render targets, and strict phase boundaries so behavior stays portable across environments.
