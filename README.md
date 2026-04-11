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
- `@faux-ui/app`
- `@faux-ui/reconciler`
- `@faux-ui/render-dom`
- `@faux-ui/render-inspect`
- `@faux-ui/render-tui`
- `@faux-ui/schema`
- `@faux-ui/devtools`
- `@faux-ui/mcp`
- `create-faux-ui`
- `exec-faux-ui`

Apps:

- `@faux-ui/example`
- `@faux-ui/example-renderer`

## Commands

```bash
bun install
bun run typecheck
bun run test
bun run build
```

## Examples

The monorepo now includes one shared example app with two renderer targets that exercises the current action contract across DOM and TUI:

- `bun run example:dom` starts the browser target from `apps/example` and mounts the shared app directly into `document.body`.
- `bun run example:build` produces the browser bundle for the shared example app.
- `bun run example:preview` serves the built browser bundle locally.
- `bun run example:tui` launches the terminal target for the same shared example app.
- `bun run example:tui:watch` reruns the terminal target on source changes while iterating on the TUI path.
- `bun run example-renderer:dom` starts a contributor-owned canvas renderer example from `apps/example-renderer`.
- `bun run example-renderer:build` builds that canvas renderer example.
- `bun run example-renderer:preview` serves the built canvas renderer example locally.

The default app path is now the public framework facade rather than direct renderer imports:

- `@faux-ui/app` exposes `render()` and picks the browser or terminal runtime automatically.
- `@faux-ui/render-dom` and `@faux-ui/render-tui` remain the renderer implementation packages.
- `@faux-ui/render-inspect` is a first-party proof renderer that serializes the mounted tree for tests and contributor guidance.
- `@faux-ui/reconciler` owns the JSX bridge. With `jsxImportSource: "@faux-ui/reconciler"`, faux-ui JSX can use `<view>` and `<text>` directly.
- `create-faux-ui --template renderer` scaffolds a third-party renderer package starter around `@faux-ui/renderer`.

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
- an initial React reconciler bridge with lower-case `<view>` and `<text>` intrinsic JSX over the custom host config
- a TUI renderer implementation package with character-cell text measurement, frame-buffer output, clipping, render-phase scroll offsets, runtime dispatch helpers, hover and drag transitions, shared pointer metadata, a concrete terminal host loop, and snapshots
- a DOM renderer implementation package with absolute-positioned model projection, delegated DOM measurement adapters, live mounting, browser-style input routing, focus tracking, drag-aware pointer dispatch, runtime scroll management, and snapshots
- a first-party inspect renderer package that serializes mounted faux-ui trees as deterministic text snapshots and acts as a proof-of-shape for contributor-built renderers
- an app facade package that auto-selects browser or terminal rendering for application code
- DOM-side successful-path helpers for browser measurers, theme token installation, and stateful app mounting
- browser-level Playwright visual regression coverage for DOM projection output
- an execution CLI that renders schema documents to DOM or TUI targets, exposes binding/layout/render-tree/HTML inspect modes, can log live interactive dispatch events, and can launch an interactive terminal session on TTYs
- a scaffold CLI that generates JSX, JSON, hybrid, and renderer-package starters with binding-inspection scripts and drag-token examples where relevant
- TUI-side successful-path helpers for interactive and static stateful apps above the raw runtime and terminal host layers
- a single first-party example application under `apps/example` that projects the same state model and action tokens to DOM and TUI targets

The main remaining MVP gaps are broader tooling on top of the current inspection surfaces and richer authoring workflows around the shared semantic model.
