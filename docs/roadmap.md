# faux-ui Roadmap

This document tracks implementation progress and the next major milestones for faux-ui. It is intentionally more changeable than [docs/architecture.md](docs/architecture.md): architecture describes system shape, while this file tracks delivery.

## Current State

The repository already has the first end-to-end runtime slices in place:

- shared semantic runtime in `@faux-ui/core`
- deterministic track resolution and recursive layout
- render-tree construction, clipping, hit testing, and bubbling-oriented dispatch helpers
- React-based `View` and `Text` reconciliation into `UINode`
- DOM projection plus a live mounting runtime
- TUI framebuffer rendering plus coordinate dispatch helpers
- JSON schema validation and compact document encoding/decoding
- initial tooling seams in devtools, MCP types, and the scaffold/exec CLIs

The remaining work is mostly at the integration and productization layer rather than in the core architectural split.

## Near-Term Milestones

### 1. Finalize the application action contract

Status: implemented

Goal:

- define how binding tokens map to application-owned handlers
- make dispatch results ergonomic for DOM, TUI, CLI, and tooling integrations
- keep token resolution renderer-neutral

Why this matters:

Core dispatch already returns binding tokens, but the application-facing execution contract is still implicit. That makes the runtime usable for tests, yet incomplete for real apps.

Delivered:

- binding tokens now consistently support stable string or numeric identifiers across core, schema, and reconciler authoring
- `@faux-ui/core` exposes a renderer-neutral dispatch execution helper that maps tokens into application-owned handlers
- DOM and TUI dispatch entry points expose the same execution-plan shape, and the DOM runtime can include resolved handlers in `onDispatch`

### 2. Complete a TUI interaction runtime

Status: partially implemented

Goal:

- add a real event loop around the existing framebuffer renderer
- support focus movement, keyboard input, pointer input where available, and scroll updates
- preserve the same dispatch semantics already used by DOM

Why this matters:

The TUI package proves rendering portability today, but not full runtime parity.

### 3. Improve DOM runtime completeness

Status: partially implemented

Goal:

- expand hover transition behavior
- translate wheel input into managed scroll state updates
- improve external focus synchronization and lifecycle edges
- keep DOM as a thin projection over core semantics

Why this matters:

DOM is the most complete runtime, so finishing its interaction edges will clarify the intended cross-renderer contract.

### 4. Add visual and interaction regression coverage

Status: not implemented

Goal:

- add browser-level visual regression for DOM output
- expand runtime tests around focus, scroll, and hover transitions
- keep renderer behavior aligned with the shared semantic model

Why this matters:

The core engine already has strong unit coverage. The next quality step is verifying full-runtime behavior at the projection layer while DOM and interaction semantics are still being finalized.

## Mid-Term Milestones

### 5. Finish the execution CLI

Status: placeholder

Goal:

- detect input format automatically or by flag
- select renderer targets such as DOM and TUI
- support inspect-oriented modes for layout or render output

Why this matters:

`exec-faux-ui` is the natural entry point for demos, testing, and automation, but it currently stops at status output.

### 6. Finish the scaffold CLI

Status: placeholder

Goal:

- generate starter projects for JSX, JSON, and hybrid entry modes
- encode recommended package wiring and test setup
- reduce setup friction for new experiments

Why this matters:

The architecture is easier to evaluate if users can create runnable examples quickly.

## Longer-Term Direction

### 7. Broaden tooling and inspection

Possible work:

- richer devtools dumps for layout, render, and dispatch state
- MCP command implementations on top of the existing command types
- reusable inspection output for CI and editor tooling

### 8. Grow authoring and interchange workflows

Possible work:

- stronger JSON-to-runtime pipelines
- authoring helpers that preserve the same semantics across JSX and schema documents
- better inspection and migration support between authoring formats

### 9. Revisit advanced reconciler/runtime features

Possible work:

- persistence or hydration strategies if they become necessary
- improved debugging hooks around reconciliation commits
- tighter integration points for app frameworks built on top of faux-ui

## Working Principles

As roadmap items are implemented, the repository should keep these constraints intact:

- `@faux-ui/core` remains the only source of semantic layout and dispatch rules
- renderers project from the shared render tree instead of re-implementing layout
- scroll remains render-phase state, not layout state
- authoring formats may differ ergonomically but must converge on the same semantics
- tooling should inspect or orchestrate the engine, not duplicate it

## Suggested Order

If work continues immediately, the highest-leverage sequence is:

1. finalize the action dispatch contract
2. complete the TUI interaction runtime
3. finish DOM interaction edges
4. add visual and interaction regression coverage
5. implement `exec-faux-ui`
6. implement `create-faux-ui`

That order strengthens the runtime contract before investing in packaging and external developer workflows.