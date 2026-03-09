# faux-ui Roadmap

This document tracks delivery priorities for faux-ui. It is intentionally more changeable than [docs/architecture.md](docs/architecture.md): architecture describes the current system shape, while this file records what still needs to be built on top of that shape.

## Current Position

The project has completed its main priority reset.

- TUI semantics are now the source of truth.
- DOM follows the same fixed-cell layout and render-tree contract.
- root containers are explicitly bounded on both axes.
- text no longer wraps in core and no renderer is allowed to smuggle wrapping semantics back in.
- layout flows from parent to child and propagates content extent upward for scroll.
- the first-party example already mounts through renderer-owned helpers instead of hand-built runtime glue.

That work removed a large amount of accidental complexity from the semantic engine. The next problem is different: the low-level engine is now simpler than the author-facing UI layer above it.

The roadmap therefore shifts from runtime cleanup to two follow-up goals: remove binding tokens from the public authoring model, then build a minimal design-system layer that can hold reusable UI concerns without polluting `@faux-ui/core` or renderer packages.

## Completed Foundation

The following areas are now considered baseline, not roadmap targets:

- fixed-cell shared layout in `@faux-ui/core`
- explicit bounded root constraints
- render-tree-driven clipping and hit testing
- DOM and TUI renderer helpers for the common mounting path
- shared example layout across DOM and TUI
- removal of renderer-driven text measurement from core semantics
- removal of faux-ui-owned reducer and action-map helpers from the preferred JSX path

Future work should treat those decisions as stable unless a deeper architectural problem appears.

## Near-Term Milestones

### 1. Remove binding tokens from the public model

Status: largely complete for JSX, remaining JSON-focused cleanup optional

Goal:

- remove token-to-action mapping from the preferred authoring path
- keep JSX authoring aligned with normal application-owned state and handlers
- support JSON rendering through semantic action identifiers plus an actions map at the entrypoint
- keep any remaining token-like identifiers as internal renderer plumbing only if they are still needed

Why this matters:

Binding tokens solved an early serialization problem, but they are now a conceptual blocker. They leak transport-oriented indirection into the public app model, especially in JSX, where most users will expect direct state ownership and direct event handling.

Likely outcomes:

- JSON entrypoints load a document plus an application-supplied actions map
- dispatch carries semantic action names and optional payload data instead of opaque binding tokens
- JSX can stay close to ordinary React-style application structure
- schema and runtime APIs become easier to explain because serialized UI no longer pretends to carry callbacks

Current state:

- JSX event props now accept direct application-owned handler functions
- renderer helpers no longer own reducer state, view state, or token-to-action mapping helpers
- the shared example now uses plain render/update loops in app code rather than `createStatefulApp()` or renderer-owned stateful wrappers
- schema-authored documents still use semantic action identifiers, which remains the right place for any future entrypoint-level action map helper

### 2. Add a minimal design-system package

Status: not started

Goal:

- introduce one package above core and the renderers for reusable UI building blocks
- keep semantic layout, render-tree rules, and event dispatch in `@faux-ui/core`
- keep renderer-specific host behavior in `@faux-ui/dom` and `@faux-ui/tui`
- move UI composition helpers, theme structure, and higher-level patterns out of example code

Why this matters:

The engine is now smaller and more coherent, but authoring still drops too quickly to raw `View` and `Text`. A small design-system layer is the right place for reusable UI concerns that are real, but not universal enough to belong in core.

Likely outcomes:

- a package such as `@faux-ui/design-system`
- shared component primitives that compile down to plain reconciler `View` and `Text`
- a clear boundary between semantic engine, renderer projection, and reusable UI patterns

### 3. Add a scroll container primitive above core

Status: not started

Goal:

- provide a higher-level scroll container component for the common viewport-plus-content pattern
- keep scroll as a `View` semantic property underneath
- reduce repeated scroll frame composition in app code

Why this matters:

Scroll is a core semantic capability, but authoring the surrounding container pattern repeatedly is noise. The design-system layer should make the common case obvious without adding hidden layout negotiation.

### 4. Add a wrapped-text helper outside core

Status: not started

Goal:

- support wrapped presentation as an opt-in design-system concern, not a core text rule
- calculate wrapped size deterministically in userland from text, wrap width, and explicit bounds
- preserve the core invariant that base `Text` remains no-wrap

Why this matters:

Large text blocks are a real UI need, but reviving wrapping inside core would reintroduce complexity into the semantic engine. If wrapping returns, it should return as a helper that expands into ordinary fixed-cell layout decisions.

Non-goals:

- no renderer-owned text measurement
- no CSS-like reflow negotiation
- no hidden dependence on DOM font metrics

### 5. Add bordered container and card primitives

Status: not started

Goal:

- provide reusable bordered containers using pseudo-graphics
- support common slots such as title, actions, body, and optional scrollable content regions
- make complex panels easier to author while staying inside the fixed-cell model

Why this matters:

Cards, panes, and framed sections are likely to appear in nearly every serious TUI-first interface. They belong in a reusable UI layer rather than being copied through examples.

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

### 7. Establish a shared theme and semantic token story in the design system

Status: not started

Goal:

- define the default theme shape above raw semantic color names
- provide reusable color and surface conventions for common components
- keep DOM and TUI aligned through the same semantic palette vocabulary

Why this matters:

Theme application exists today, but it is still too close to renderer setup. The design-system layer should own component-facing theme conventions so application code does not assemble those rules ad hoc.

### 8. Rewrite the example to consume the design system

Status: not started

Goal:

- replace ad hoc example composition with the new design-system primitives
- prove that the common authoring path now feels small and obvious
- keep the example focused on application logic rather than framework assembly

Why this matters:

The example is the clearest proof of whether faux-ui is becoming pleasant to use. It should validate the design-system layer immediately instead of leaving those components unused.

### 9. Expand regression coverage around the higher-level layer

Status: not started

Goal:

- add tests for wrapped-text helpers, scroll containers, cards, and basic input components
- keep cross-renderer behavior aligned under the same design-system surface
- prevent convenience APIs from smuggling DOM-only behavior back into the stack

Why this matters:

The engine is already well tested. The next risk is not core correctness; it is drift in the higher-level API layer.

## Mid-Term Milestones

### 10. Align starter, CLI, and schema paths with the design-system layer

Status: deferred until the first component set exists

Goal:

- expose the design-system package in starter templates where appropriate
- decide how schema-authored documents should reference higher-level primitives, if at all
- keep CLI and inspection flows aware of the new package boundary without making it mandatory for low-level usage

Why this matters:

Tooling should reinforce the primary authoring path after that path is proven. It should not guess ahead of the API.

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
3. add the design-system package boundary
4. ship scroll container and bordered container primitives
5. add wrapped-text as an opt-in helper outside core
6. add the smallest useful input component set
7. define shared theme structure for those components
8. rewrite the example to use the new layer
9. lock the new APIs down with regression coverage
10. only then extend starters, schema, and tooling

That order keeps the project honest: the engine stays small, and complexity only returns where it is visible, reusable, and clearly above the semantic core.