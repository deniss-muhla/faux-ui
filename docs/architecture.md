# faux-ui Architecture

This document explains the current implementation architecture of faux-ui. It complements [docs/spec.md](docs/spec.md): the spec freezes semantic rules, while this document describes how those rules are currently realized across packages.

## Goals

faux-ui is organized around a small set of architectural constraints:

- one semantic model shared across renderers
- deterministic layout with no CSS-style negotiation
- strict separation between layout and render phases
- event dispatch based on a renderer-neutral render tree
- renderer packages that stay thin by delegating semantics to `@faux-ui/core`
- authoring formats that can differ at the edges while converging on the same runtime model

Those constraints are visible throughout the repository structure and in the main runtime pipeline.

## System Overview

```mermaid
flowchart LR
  A[JSX authoring] --> B[@faux-ui/reconciler]
  J[JSON authoring] --> K[@faux-ui/schema]
  B --> C[UINode tree]
  K --> C
  C --> D[layoutNode]
  D --> E[buildRenderTree]
  E --> F[@faux-ui/dom]
  E --> G[@faux-ui/tui]
  E --> H[event hit testing]
  H --> I[binding tokens owned by the app]
```

In practice, the runtime is centered on three progressively more concrete layers:

1. Authoring data: JSX props or JSON document specs.
2. Semantic runtime state: the mutable `UINode` tree in `@faux-ui/core`.
3. Render state: a visible-only render tree used for painting, clipping, hit testing, and event targeting.

The architecture deliberately avoids pushing renderer-specific behavior into the semantic layer. DOM and TUI differ in measurement, painting, and native input plumbing, but they share the same layout, render-tree, and dispatch semantics.

## Package Responsibilities

### `@faux-ui/core`

`@faux-ui/core` is the semantic source of truth.

It owns:

- normalized track and constraint types
- `UINode` creation and mutation helpers
- layout computation and layout cache reuse
- render-tree construction and render-tree cache reuse
- renderer-neutral hit testing and bubbling-oriented event dispatch

No renderer package redefines these rules. That is the main architectural guardrail in the repository.

### `@faux-ui/reconciler`

`@faux-ui/reconciler` is the current JSX bridge.

It converts React host instances into `UINode` objects, exposes author-facing `View` and `Text` wrappers, and maps shorthand event props such as `onClick` and `onKeyDown` into core binding slots. The reconciler does not perform layout or rendering. Its job is to maintain the semantic tree and preserve the framework's authoring constraints, such as raw text only being legal inside `Text`.

### `@faux-ui/dom`

`@faux-ui/dom` turns the shared render tree into browser-shaped output.

It provides:

- text measurement adapters
- DOM model projection from the render tree
- a live mounting runtime for a host container
- browser-style pointer, wheel, keyboard, and focus routing back into core dispatch helpers

DOM remains a projection target, not the semantic authority.

### `@faux-ui/tui`

`@faux-ui/tui` turns the shared render tree into a character-cell framebuffer.

It provides:

- character-cell text measurement
- framebuffer painting
- coordinate-based input dispatch helpers for cell positions

Like DOM, it depends on the shared render tree instead of reimplementing layout or event semantics.

### `@faux-ui/schema`

`@faux-ui/schema` defines the portable document format for non-JSX authoring.

It contains:

- readable document types
- validation
- compact encode/decode support

This package describes authoring data, not live runtime state.

### Tooling and placeholder packages

Several packages intentionally remain thin but already define architectural seams:

- `@faux-ui/devtools`: formatting helpers such as layout dumps for inspection and debugging
- `@faux-ui/mcp`: command types for future model-context and inspection workflows
- `create-faux-ui`: scaffold CLI placeholder
- `exec-faux-ui`: execution CLI placeholder

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

At this point the tree contains semantic information only: tracks, text content, styles, focusability, and binding tokens. It does not yet have absolute positions.

### 2. Layout

`layoutNode()` in `@faux-ui/core` computes sizes under max-only constraints.

The layout pipeline follows these rules:

- text measurement is delegated through a renderer-supplied `measureText()` function
- view tracks are normalized into a simple grid model
- content and fixed tracks are resolved before fraction tracks
- scrollable axes pass unbounded constraints into descendants while retaining bounded viewport size at the container
- child placement is strictly index-based
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

- `renderToDomModel()` projects the tree into absolute-positioned DOM model nodes
- `mountDomRoot()` turns that model into live elements inside a host container

For TUI:

- `renderToFrameBuffer()` paints the tree into a framebuffer using character-cell measurement

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

Binding values in core are numeric tokens. The application owns what those tokens mean and how actions are executed after dispatch resolution.

## Renderer-Specific Notes

### DOM

The DOM runtime is the most complete integration layer today.

It keeps responsibility boundaries relatively clean:

- browser measurement stays in DOM-specific adapters
- layout and clipping stay in core
- native events are translated into core binding dispatch
- focus state is tracked by node id rather than by DOM structure alone

The DOM runtime also keeps a map of focusable nodes and supports scroll offset updates as rerender operations over the shared render tree.

### TUI

The TUI renderer is simpler and currently stops at framebuffer output plus coordinate dispatch helpers.

That still validates an important architectural claim: the same layout and render tree can drive a browser-shaped runtime and a character-cell runtime with only measurement and painting swapped out.

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
- no finalized application-side action execution contract for binding tokens
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