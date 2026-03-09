# faux-ui

Functional Axial User Interface.

faux-ui is a deterministic cross-renderer UI framework built around strict constraint algebra, explicit track resolution, and a hard separation between layout and rendering.

## Status

This repository is an active Bun-based TypeScript monorepo with the first end-to-end implementation slices in place.

- Specification: [docs/spec.md](docs/spec.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- TypeScript baseline: `5.9`
- TypeScript canary lane target: `6.0 beta`
- Public CLIs: `create-faux-ui`, `exec-faux-ui`

## Workspace

Packages:

- `@faux-ui/core`
- `@faux-ui/reconciler`
- `@faux-ui/dom`
- `@faux-ui/tui`
- `@faux-ui/schema`
- `@faux-ui/devtools`
- `@faux-ui/mcp`
- `create-faux-ui`
- `exec-faux-ui`

Apps:

- `@faux-ui/example`

## Commands

```bash
bun install
bun run typecheck
bun run test
bun run build
```

## Examples

The monorepo now includes one shared example app with two renderer targets that exercises the current action contract across DOM and TUI:

- `bun run example:dom` starts the browser target from `apps/example` and mounts the shared app into a styled DOM shell.
- `bun run example:dom:build` produces a production browser bundle for the DOM target.
- `bun run example:tui` launches the terminal target for the same shared example app.
- `bun run example:tui:snapshot` renders the shared example once in static TUI mode for quick inspection.

The default path is now renderer-owned rather than app-owned root plumbing:

- `@faux-ui/dom` exposes `renderDom()` for direct tree mounting in the browser.
- `@faux-ui/tui` exposes `renderTui()` for direct terminal mounting.
- `@faux-ui/reconciler` owns `View`, `Text`, and the JSX bridge only. Application state, rerender scheduling, and action maps stay in user code.

## Current Scope

The current implementation includes:

- the frozen repository specification
- a strict TypeScript workspace layout
- an initial `resolveTracks()` implementation in `@faux-ui/core`
- a mutable `UINode` core with revision tracking, dirty flags, child attachment, and layout cache commit helpers
- recursive view/text layout computation with scroll-aware content sizing and cache reuse keyed by constraints plus subtree revision
- a shared render-tree layer with clipping, hit testing, bubbling-oriented hit paths, and paint-aware caching
- core event-dispatch helpers for binding collection and focus targeting from render hits
- executable tests for deterministic track resolution
- executable tests for `UINode` invalidation behavior
- readable JSON validation plus compact-codec encode/decode support in `@faux-ui/schema`
- an initial React reconciler bridge with `View` and `Text` JSX wrappers over the custom host config
- a TUI renderer with character-cell text measurement, frame-buffer output, clipping, render-phase scroll offsets, runtime dispatch helpers, hover and drag transitions, shared pointer metadata, a concrete terminal host loop, and snapshots
- a DOM renderer with absolute-positioned model projection, delegated DOM measurement adapters, live mounting, browser-style input routing, focus tracking, drag-aware pointer dispatch, runtime scroll management, and snapshots
- DOM-side successful-path helpers for browser measurers, theme token installation, and stateful app mounting
- browser-level Playwright visual regression coverage for DOM projection output
- an execution CLI that renders schema documents to DOM or TUI targets, exposes binding/layout/render-tree/HTML inspect modes, can log live interactive dispatch events, and can launch an interactive terminal session on TTYs
- a scaffold CLI that generates JSX, JSON, and hybrid starters for DOM or TUI authoring flows with binding-inspection scripts and drag-token examples
- TUI-side successful-path helpers for interactive and static stateful apps above the raw runtime and terminal host layers
- a single first-party example application under `apps/example` that projects the same state model and action tokens to DOM and TUI targets

The main remaining MVP gaps are broader tooling on top of the current inspection surfaces and richer authoring workflows around the shared semantic model.
