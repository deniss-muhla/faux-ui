# faux-ui

Text-first UI for agents and operators.

faux-ui is a deterministic UI framework for tool UIs. Author once in React/JSX or JSON, inspect the result as text, and render the same semantic tree to terminal, browser, and snapshot targets. TUI semantics are canonical; DOM is a projection.

## Status

- Specification: [docs/spec.md](docs/spec.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- TypeScript baseline: `6.0`
- Public authoring path: `@faux-ui/app` + `@faux-ui/ui`
- Public CLIs: `create-faux-ui`, `exec-faux-ui`

## Why faux-ui

- one semantic model across DOM, TUI, and inspect renderers
- deterministic fixed-cell layout with no CSS-style negotiation
- inspectable render trees and schema documents that fit agent workflows
- React as the authoring bridge without making browser layout the source of truth

## Workspace

Public authoring packages:

- `@faux-ui/app`
- `@faux-ui/ui`
- `create-faux-ui`
- `exec-faux-ui`

Engine and tooling packages:

- `@faux-ui/core`
- `@faux-ui/reconciler`
- `@faux-ui/renderer`
- `@faux-ui/render-dom`
- `@faux-ui/render-inspect`
- `@faux-ui/render-tui`
- `@faux-ui/schema`
- `@faux-ui/devtools`
- `@faux-ui/mcp`

Apps:

- `@faux-ui/example`
- `@faux-ui/design-system-gallery`
- `@faux-ui/example-renderer`

## Commands

```bash
bun install
bun run typecheck
bun run test
bun run build
```

## Examples

- `bun run example:dom` starts the shared example app in the browser.
- `bun run example:tui` starts the same app in the terminal.
- `bun run gallery:dom` opens the public `@faux-ui/ui` primitive gallery.
- `bun run example-renderer:dom` runs the contributor-owned canvas renderer example.

## Current scope

The repository currently includes:

- deterministic layout, render-tree construction, and event dispatch in `@faux-ui/core`
- a public React authoring path through `@faux-ui/ui` and `@faux-ui/app`
- DOM, TUI, and inspect renderers over the same semantic tree
- JSON schema authoring plus execution and inspect tooling
- a renderer template for contributor-owned renderers
- regression coverage across layout, renderers, starter generation, and example apps
- UI-layer named tracks, divider chrome, and scroll-aware panels for common tool layouts

The next major work is filling out the rest of the higher-level UI layer and the inspect/MCP workflow without growing the core semantics.
