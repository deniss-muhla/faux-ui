# faux-ui Roadmap

This document tracks delivery priorities for faux-ui. It is intentionally more changeable than [docs/architecture.md](docs/architecture.md): architecture describes the current system shape, while this file records what still needs to be built on top of that shape.

## Current Position

The project has completed its main priority reset and its first follow-up milestone.

- TUI semantics are now the source of truth.
- DOM follows the same fixed-cell layout and render-tree contract.
- root containers are explicitly bounded on both axes.
- text no longer wraps in core and no renderer is allowed to smuggle wrapping semantics back in.
- layout flows from parent to child and propagates content extent upward for scroll.
- the first-party example already mounts through renderer-owned helpers instead of hand-built runtime glue.
- binding tokens are fully removed from the JSX authoring path; direct handler functions are the only supported model.
- `@faux-ui/app` now exposes `render()` as the single public app entrypoint.
- `@faux-ui/ui` now exposes the single public JSX runtime and primitive layer.
- `@faux-ui/render-dom` and `@faux-ui/render-tui` are the renderer implementation packages underneath it.
- named tracks are now optional first-class metadata on track arrays, divider chrome is reusable, and `Panel` has a scroll-aware body built on a small runtime bridge.
- both renderers now auto-rerender on React state changes via `onCommit`, eliminating manual `rerender()` calls.
- DOM `render()` auto-resolves `document.body` as the container and auto-measures cell constraints, with `ResizeObserver`-driven resize.
- `@faux-ui/core` exports `defaultSemanticColors` used by both renderers; DOM applies theme CSS custom properties automatically.
- faux-ui JSX uses intrinsic `<view>` and `<text>` tags directly instead of imported renderer components.
- a custom `jsxImportSource` (`@faux-ui/ui`) restricts JSX intrinsic elements to `view` and `text` at compile time.
- `@faux-ui/renderer` now owns the shared renderer-definition contract and React mounting helper.
- platform detection no longer lives in `@faux-ui/app` or the example application; renderer definitions own it instead.

The next focus is deepening `@faux-ui/ui` beyond the first scroll-aware panel/body path and moving the shared example app onto that higher-level layer.

## Completed Foundation

The following areas are now considered baseline, not roadmap targets:

- fixed-cell shared layout in `@faux-ui/core`
- explicit bounded root constraints
- render-tree-driven clipping and hit testing
- DOM and TUI renderer helpers for the common mounting path
- shared example layout across DOM and TUI
- removal of renderer-driven text measurement from core semantics
- removal of faux-ui-owned reducer and action-map helpers from the preferred JSX path
- compile-time JSX element restriction via a custom `jsxImportSource`
- auto-rerender on React state changes (no manual `rerender()` calls)
- auto-body mounting and auto-cell-constraint measurement in DOM `render()`
- default semantic colors in `@faux-ui/core`, auto-applied by renderers
- a single `@faux-ui/app` entrypoint for app rendering
- a single `@faux-ui/ui` entrypoint for JSX authoring and primitives

Future work should treat those decisions as stable unless a deeper architectural problem appears.

## Near-Term Milestones

### 1. Remove binding tokens from the public model

Status: **complete**

Goal:

- remove token-to-action mapping from the preferred authoring path
- keep JSX authoring aligned with normal application-owned state and handlers
- support JSON rendering through semantic action identifiers plus an actions map at the entrypoint
- keep any remaining token-like identifiers as internal renderer plumbing only if they are still needed
- make non-`view` and non-`text` tags fail at compile time rather than only at runtime
- eliminate manual rerender calls; React hooks (useState, useReducer) trigger automatic rerender
- eliminate explicit container and constraint boilerplate; renderers auto-resolve defaults
- provide default semantic colors from core so new apps render with a usable palette immediately

Outcomes delivered:

- JSX event props accept direct handler functions; no token-to-action mapping needed in JSX
- renderer helpers no longer own reducer state, view state, or token-to-action mapping helpers
- DOM and TUI `render()` wire `onCommit` so React state changes auto-rerender the runtime
- DOM `render()` mounts to `document.body` by default and auto-measures cell constraints via a probe element
- DOM `render()` responds to container resize via `ResizeObserver`
- `@faux-ui/core` exports `defaultSemanticColors`; `@faux-ui/render-dom` applies them as CSS custom properties automatically
- `@faux-ui/app` is now the app-facing render package, while renderer internals stay in `@faux-ui/render-dom` and `@faux-ui/render-tui`
- `@faux-ui/renderer` provides the neutral contract so new renderers can plug in without copying reconciler bootstrap logic
- `create-faux-ui` now includes a contributor-facing renderer package template built around `@faux-ui/renderer`
- `@faux-ui/render-inspect` now serves as a first-party proof-of-shape for that template by rendering the shared example app through a contract-only renderer package
- `apps/example-renderer` now shows a contributor-owned HTML canvas renderer living outside `packages/render-*`
- a custom `jsxImportSource` (`@faux-ui/ui`) restricts intrinsic elements to `view` and `text` at compile time
- schema-authored documents still use semantic action identifiers, which remains the right place for any future entrypoint-level action map helper
- `create-faux-ui` templates updated to use the simplified API
- the example app uses `useReducer` internally, and DOM/TUI entry files are minimal (~5-10 lines)

### 2. Ship a single public UI package

Status: **complete**

Goal:

- introduce one package above core and the renderers for reusable UI building blocks
- keep semantic layout, render-tree rules, and event dispatch in `@faux-ui/core`
- keep renderer-specific host behavior in `@faux-ui/render-dom` and `@faux-ui/render-tui`
- move the public JSX runtime and higher-level primitives behind one small package

Why this matters:

The engine is already coherent. The problem was public sprawl. `@faux-ui/ui` keeps the public authoring path small while preserving the stable core and renderer boundaries.

Outcomes delivered:

- `@faux-ui/ui` now owns the public JSX runtime (`jsxImportSource: "@faux-ui/ui"`)
- `AppShell`, `Button`, and `Panel` provide the first complete primitive set
- those primitives compile down to ordinary faux-ui `view` and `text` semantics
- starter templates, gallery examples, and app tsconfigs now point at `@faux-ui/ui`
- the split pre-0.1 design-system packages were removed instead of being kept as aliases
- `apps/design-system-gallery` now validates the single-package UI surface

Follow-up note:

- renderer detection now belongs to renderer definitions only; future app-facing renderer metadata should come from neutral renderer contracts rather than ad hoc environment checks in app code

### 3. Add a scroll container primitive above core

Status: **in progress**

Goal:

- provide a higher-level scroll container component for the common viewport-plus-content pattern
- keep scroll as a `View` semantic property underneath
- reduce repeated scroll frame composition in app code

Why this matters:

Scroll is a core semantic capability, but authoring the surrounding container pattern repeatedly is noise. The public UI layer should make the common case obvious without adding hidden layout negotiation.

Progress so far:

- `Panel` can now host an optional scrollable body region
- scroll indicators are renderer-neutral and read live viewport/content metrics through a small UI runtime bridge
- overflow chrome stays in `@faux-ui/ui`; core still treats scroll offset as render-phase state only

### 4. Add a wrapped-text helper outside core

Status: not started

Goal:

- support wrapped presentation as an opt-in UI-layer concern, not a core text rule
- calculate wrapped size deterministically in userland from text, wrap width, and explicit bounds
- preserve the core invariant that base `Text` remains no-wrap

Why this matters:

Large text blocks are a real UI need, but reviving wrapping inside core would reintroduce complexity into the semantic engine. If wrapping returns, it should return as a helper that expands into ordinary fixed-cell layout decisions.

Non-goals:

- no renderer-owned text measurement
- no CSS-like reflow negotiation
- no hidden dependence on DOM font metrics

### 5. Add bordered container and card primitives

Status: **in progress**

Goal:

- provide reusable bordered containers using pseudo-graphics
- support common slots such as title, actions, body, and optional scrollable content regions
- make complex panels easier to author while staying inside the fixed-cell model

Why this matters:

Cards, panes, and framed sections are likely to appear in nearly every serious TUI-first interface. They belong in a reusable UI layer rather than being copied through examples.

Progress so far:

- `Divider` now provides reusable single, double, dotted, and heavy chrome
- `Panel` now supports header/body/footer framing with optional scroll chrome in the body region
- named row and column names are optional additions to track arrays; numeric placement still works unchanged

### 6. Add the minimum essential input-oriented components

Status: not started

Goal:

- identify the smallest useful input set for real applications
- keep the first batch intentionally narrow
- build components on top of existing focus and dispatch semantics rather than extending core prematurely

Likely first candidates:

- button
- selectable list item or menu row
- checkbox or toggle
- simple text field only if the editing model can stay deterministic and small

Why this matters:

The framework needs enough input vocabulary to support practical apps, but not a large widget catalog. The right bar is "small but sufficient", not feature parity with browser UI kits.

### 7. Establish a shared theme and semantic token story in the UI layer

Status: in progress

Goal:

- define the default theme shape above raw semantic color names
- provide reusable color and surface conventions for common components
- keep DOM and TUI aligned through the same semantic palette vocabulary

Why this matters:

Theme application exists today, but it is still too close to renderer setup. The UI layer should own component-facing theme conventions so application code does not assemble those rules ad hoc.

### 8. Rewrite the shared example app to consume `@faux-ui/ui`

Status: not started

Goal:

- replace ad hoc example composition with the new `@faux-ui/ui` primitives
- prove that the common authoring path now feels small and obvious
- keep the example focused on application logic rather than framework assembly

Why this matters:

The example is the clearest proof of whether faux-ui is becoming pleasant to use. It should validate the public UI layer immediately instead of leaving those components unused.

### 9. Expand regression coverage around the higher-level layer

Status: in progress

Goal:

- add tests for wrapped-text helpers, scroll containers, cards, and basic input components
- keep cross-renderer behavior aligned under the same public UI surface
- prevent convenience APIs from smuggling DOM-only behavior back into the stack

Why this matters:

The engine is already well tested. The next risk is not core correctness; it is drift in the higher-level API layer.

## Mid-Term Milestones

### 10. Align starter, CLI, and schema paths with the UI layer

Status: in progress

Goal:

- expose the public UI package in starter templates where appropriate
- decide how schema-authored documents should reference higher-level primitives, if at all
- keep CLI and inspection flows aware of the new package boundary without making it mandatory for low-level usage

Why this matters:

Tooling should reinforce the primary authoring path after that path is proven. Starter generation now does; CLI and schema still need the same clarity.

### 11. Revisit advanced runtime features only after the authoring layer settles

Status: deferred

Possible work:

- richer inspection and debug surfaces
- editor and MCP tooling built on the stabilized component layer
- more advanced stateful widgets if real applications justify them

These remain secondary. The priority is still to make the basic authoring stack coherent from semantic core up through reusable UI primitives.

## Working Principles

As roadmap items are implemented, these constraints should stay intact:

- `@faux-ui/core` remains the only source of semantic layout and dispatch rules
- renderer packages stay projections over shared core semantics
- no automatic text wrapping returns to core
- higher-level helpers must compile down to explicit fixed-cell layout decisions
- DOM must not become a hidden source of measurement or layout truth
- new components should stay small, deterministic, and easy to inspect
- examples should validate the intended authoring path, not normalize low-level boilerplate

## Suggested Order

If work continues immediately, the highest-leverage sequence is:

1. remove binding tokens from the public authoring model
2. define the JSON entrypoint contract around a document plus actions map
3. ship scroll container and bordered container primitives in `@faux-ui/ui`
4. add wrapped-text as an opt-in helper outside core
5. add the smallest useful input component set
6. define shared theme structure for those components
7. rewrite the shared example app to use the new layer
8. lock the new APIs down with regression coverage
9. extend CLI and schema workflows around the stabilized UI package

That order keeps the project honest: the engine stays small, and complexity only returns where it is visible, reusable, and clearly above the semantic core.
