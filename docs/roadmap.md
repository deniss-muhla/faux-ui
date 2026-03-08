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
- monorepo DOM and TUI example apps that exercise the action contract with application-owned handler resolution

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

Delivered so far:

- `@faux-ui/tui` now includes a host-agnostic runtime controller around the framebuffer renderer
- the runtime manages focus traversal, key dispatch, pointer dispatch, and managed scroll offsets through the same core dispatch semantics as DOM
- terminal hosts can drive the runtime through a single event entrypoint or imperative helpers without reimplementing hit testing or focus rules
- `@faux-ui/tui` now ships a concrete terminal host that manages raw-mode input, alternate-screen rendering, resize handling, mouse reporting, and TTY-aware viewport constraints
- pointer movement now produces shared-path `mouseEnter` and `mouseLeave` transitions in the TUI runtime instead of only raw `mouseMove` dispatches
- DOM and TUI now expose the same pointer payload metadata for button identity and modifier keys, and both runtimes synthesize additive `dragStart` / `drag` / `dragEnd` bindings from the shared pointer flow

Remaining:

- broaden terminal-specific gesture semantics only if MVP consumers prove they need more than the current button plus modifier plus drag contract

### 3. Improve DOM runtime completeness

Status: implemented

Goal:

- expand hover transition behavior
- translate wheel input into managed scroll state updates
- improve external focus synchronization and lifecycle edges
- keep DOM as a thin projection over core semantics

Why this matters:

DOM is the most complete runtime, so finishing its interaction edges will clarify the intended cross-renderer contract.

Delivered so far:

- wheel input now updates managed scroll offsets in the DOM runtime instead of only surfacing raw scroll bindings
- mouse movement now produces enter and leave transitions based on hover path changes through the shared render tree
- focusable DOM elements now synchronize native focus and blur changes back into runtime state
- hover and focus state are now projected into DOM styles instead of remaining dispatch-only runtime state
- rerender and replacement flows now flush stale hover and focus state instead of dropping it silently

### 4. Add visual and interaction regression coverage

Status: partially implemented

Goal:

- add browser-level visual regression for DOM output
- expand runtime tests around focus, scroll, and hover transitions
- keep renderer behavior aligned with the shared semantic model

Why this matters:

The core engine already has strong unit coverage. The next quality step is verifying full-runtime behavior at the projection layer while DOM and interaction semantics are still being finalized.

Delivered so far:

- DOM now has a dedicated Playwright snapshot lane for browser-rendered projection regressions
- DOM and TUI runtime tests now cover manual scroll offset normalization and clamping in addition to event-driven scroll updates

## Mid-Term Milestones

### 5. Finish the execution CLI

Status: partially implemented

Goal:

- detect input format automatically or by flag
- select renderer targets such as DOM and TUI
- support inspect-oriented modes for layout or render output

Why this matters:

`exec-faux-ui` is the natural entry point for demos, testing, and automation. The static inspection path is now useful, so the remaining value is in richer authoring inputs and more orchestration-oriented modes rather than first-use viability.

Delivered so far:

- `exec-faux-ui` now loads readable JSON documents or compact FUI arrays from a file path or stdin
- the CLI supports `--target dom|tui`, automatic or explicit format selection, and size constraints
- inspect-oriented modes now expose semantic binding dumps, semantic layout dumps, and visible render-tree JSON for debugging workflows
- TTY execution now automatically enters a live TUI host mode, with explicit `--interactive` and `--static` control for terminal versus scriptable workflows
- interactive TUI execution can now persist live dispatch activity with `--event-log`, which makes pointer and drag behavior inspectable without custom application code
- static execution can now persist render or inspection output via `--snapshot`, which makes the current CLI modes usable in CI and artifact-oriented automation

### 6. Finish the scaffold CLI

Status: partially implemented

Goal:

- generate starter projects for JSX, JSON, and hybrid entry modes
- encode recommended package wiring and test setup
- reduce setup friction for new experiments

Why this matters:

The architecture is easier to evaluate if users can create runnable examples quickly.

Delivered so far:

- `create-faux-ui` now generates starter projects for `jsx`, `json`, and `hybrid` entry modes
- generated projects include package-manager-aware metadata for Bun, npm, or pnpm workflows
- JSX starters now include bound drag tokens in the sample app, while JSON starters include ready-to-inspect schema documents and binding-inspection scripts for `exec-faux-ui`

### 7. Add first-party example apps

Status: implemented

Goal:

- add a browser-backed DOM example to the monorepo
- add an interactive terminal example that uses the same action contract
- prove the runtime APIs are ergonomic before broader tooling grows around them

Why this matters:

Examples harden integration seams early. They make it easier to validate the action contract, runtime updates, and renderer-specific mounting behavior before more tooling builds on top of those assumptions.

Delivered so far:

- `@faux-ui/example-dom` now ships a Vite-backed browser demo that mounts a faux-ui tree into a styled DOM shell
- `@faux-ui/example-tui` now ships an interactive terminal demo plus a static snapshot mode for CI-friendly inspection
- both examples use application-owned token resolution and rerender the faux-ui tree after state changes instead of embedding behavior inside the renderers

## Longer-Term Direction

### 8. Broaden tooling and inspection

Possible work:

- richer devtools dumps for layout, render, and dispatch state
- MCP command implementations on top of the existing command types
- reusable inspection output for CI and editor tooling

### 9. Grow authoring and interchange workflows

Possible work:

- stronger JSON-to-runtime pipelines
- authoring helpers that preserve the same semantics across JSX and schema documents
- better inspection and migration support between authoring formats

### 10. Revisit advanced reconciler/runtime features

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