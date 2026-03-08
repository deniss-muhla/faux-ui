# faux-ui Roadmap

This document tracks delivery priorities for faux-ui. It is intentionally more changeable than [docs/architecture.md](docs/architecture.md): architecture describes system shape, while this file records where the project still falls short of its main promise.
## Project Priority Reset

The spec describes faux-ui as a small, deterministic, shared UI model for DOM and TUI. The main goal is not merely to prove that the same semantic tree can render in both places. The main goal is to make cross-renderer UI authoring feel simple and effortless.
The current codebase already proves most of the semantic engine:

- shared layout, render-tree, clipping, hit testing, and dispatch rules in `@faux-ui/core`
- React reconciliation into `UINode`
- DOM and TUI runtime slices that can render and dispatch through the same token contract
- schema, CLI, and inspection packages that expose the broader shape of the ecosystem
What is still missing is the ergonomic layer above those primitives.

The first-party example in `apps/example/src` currently has to own too much infrastructure directly:
- manual reconciler and root creation per renderer
- manual render loops and rerender triggers after every action
- manual action-token resolution and dispatch execution wiring
- manual focus-label synchronization and renderer lifecycle plumbing
- manual text-measurer bridging between DOM and TUI paths
- renderer-specific layout profiles to compensate for missing higher-level authoring helpers
- manual DOM theme token installation and host bootstrapping

That is a sign that the repository has drifted toward proving primitives rather than delivering the intended authoring experience.
## Current State

The engine foundation is in good shape. The main architectural split from the spec remains intact:
- `@faux-ui/core` is the semantic source of truth
- renderers project from shared layout and render-tree data
- scroll remains render-phase state
- JSX and schema authoring can converge on the same runtime semantics

But the developer experience is still too low-level. Building even a first-party example currently requires application code to understand runtime wiring details that should mostly live in shared packages.
The roadmap therefore shifts from "add more surface area" to "make the existing surface area easier to use correctly."

## Near-Term Milestones
### 1. Add a high-level React application runtime

Status: not started

Goal:
- provide a renderer-neutral app bootstrap around `createReconciler()` and root management
- let apps render shared JSX without manually owning reconciler lifecycle details
- make rerendering after action dispatch a built-in flow instead of example-owned glue
Why this matters:

The example currently reimplements the same root creation and rerender loop separately for DOM and TUI. That is friction the framework should absorb.
Likely outcomes:

- a higher-level React-facing runtime package or reconciler entrypoint for shared app mounting
- built-in update scheduling after action execution
- a clearer split between authoring state and renderer host setup
### 2. Standardize action execution above raw dispatch tokens

Status: partially implemented

Goal:
- keep application-owned actions as the core contract
- remove per-app boilerplate for `resolveAction`, `onDispatch`, and resolved-action execution
- expose one obvious action execution model for DOM, TUI, CLI, and future tooling
Why this matters:

The token contract is correct, but the example still has to manually translate dispatch events into handler execution and state updates in each renderer entrypoint. That is too much ceremony for the common path.
Likely outcomes:

- a shared action runtime helper that executes resolved actions and schedules rerenders
- renderer adapters that agree on one higher-level callback surface
- example apps that define actions, not dispatch plumbing
### 3. Move shared focus and runtime state exposure into reusable adapters

Status: not started

Goal:
- expose focused node identity and related runtime state through stable shared APIs
- remove app-owned focus synchronization loops where possible
- make DOM and TUI focus reporting feel like the same feature, not two host-specific integrations
Why this matters:

The example currently manages focused-node labels through renderer-specific callbacks and extra rerenders. That is implementation leakage from the runtime layer into app code.
Likely outcomes:

- shared runtime observers or subscriptions for focus state
- higher-level mounted runtime handles with common inspection hooks
- less imperative focus bookkeeping in example and consumer code
### 4. Reduce renderer bootstrapping boilerplate

Status: not started

Goal:
- simplify DOM host mounting and TUI host mounting for the common case
- provide sensible measurement defaults and setup helpers where the spec allows them
- keep renderer-specific escape hatches without forcing them into every app
Why this matters:

The example should not need to hand-assemble text measurement bridging, host querying, resize wiring, and theme installation just to mount a shared app.
Likely outcomes:

- easier DOM mount helpers with optional default text measurement adapters
- easier terminal host setup for TUI apps
- a smaller "hello world" and example entrypoint footprint
### 5. Introduce higher-level authoring helpers for common layout patterns

Status: not started

Goal:
- preserve the strict semantic model from the spec
- reduce repetitive track arrays and repeated `View` composition for common UI structures
- keep helpers thin and honest rather than reintroducing CSS-like hidden behavior
Why this matters:

The example app currently needs separate DOM and TUI layout profiles for the same conceptual screen. Some of that difference is legitimate renderer tuning, but the amount of repeated structural detail suggests missing ergonomic helpers above raw rows and columns.
Likely outcomes:

- small composition primitives for panels, stacks, sections, and action lists
- authoring helpers that compile down to the same `View` and `Text` semantics
- fewer raw track literals in application code
### 6. Establish a first-class styling and theme story

Status: not started

Goal:
- define how semantic colors and shared theme tokens should be installed and consumed
- reduce manual DOM token setup in apps
- preserve cross-renderer styling semantics without inventing renderer-specific rules in core
Why this matters:

The example currently applies theme variables imperatively in the DOM entrypoint. That is workable for a demo, but too ad hoc for the framework's default path.
Likely outcomes:

- shared theme definitions that DOM and TUI can both project
- a documented install path for semantic color tokens
- examples that demonstrate styling semantics instead of setup ceremony
## Mid-Term Milestones

### 7. Rewrite first-party examples to prove the ergonomic path

Status: not started

Goal:
- keep `apps/example` as the primary proof that shared DOM and TUI authoring is actually lightweight
- reduce entrypoint boilerplate drastically after the runtime and helper work lands
- make the examples demonstrate application code, not framework assembly steps
Why this matters:

The example app is the clearest signal of whether faux-ui is meeting its main promise. Once the lower-level APIs improve, the example should be rewritten to validate that improvement explicitly.
Success criteria:

- DOM and TUI entrypoints become thin wrappers over shared app mounting helpers
- the shared example app defines state, actions, and semantic structure, not runtime plumbing
- the example becomes easier to read than the current renderer setup files
### 8. Expand regression coverage around the higher-level APIs

Status: partially implemented

Goal:
- keep the current core and runtime regression suites
- add tests that lock down the new ergonomic APIs and example app shape
- ensure simplification does not reintroduce renderer divergence
Why this matters:

Abstraction only helps if it remains honest. The higher-level runtime layer needs the same rigor already applied to core semantics.
### 9. Re-evaluate schema, CLI, and tooling priorities after the app path is simple

Status: deferred behind ergonomics

Goal:
- continue tooling work only after the default authoring path is convincingly small
- make CLIs and inspection tools reinforce the main UX instead of compensating for it
- keep new surfaces aligned with the simplified runtime contract
Why this matters:

Tooling is valuable, but it should sit on top of a framework that is already easy to use. Shipping more tooling before fixing the core authoring friction risks institutionalizing the wrong API layer.
Likely follow-up areas:

- richer inspection output
- stronger schema-to-runtime authoring flows
- MCP and editor-oriented tooling on top of the stabilized runtime surface
## Longer-Term Direction

### 10. Explore advanced runtime features only after the core UX holds

Possible work:
- persistence or hydration strategies if they become necessary
- deeper debugging hooks around reconciliation and runtime commits
- framework integrations built on top of the higher-level faux-ui app runtime
These should remain secondary. The near-term priority is still to make the basic DOM-plus-TUI authoring story small, obvious, and repeatable.

## Working Principles
As roadmap items are implemented, the repository should keep these constraints intact:

- `@faux-ui/core` remains the only source of semantic layout and dispatch rules
- renderer packages stay projections over shared core semantics
- ergonomics improvements should mostly land in adapters, helpers, and runtime layers above core
- new helpers must compile down to the same deterministic model rather than adding hidden negotiation
- scroll remains render-phase state, not layout state
- examples should validate the intended authoring experience, not normalize framework boilerplate

## Suggested Order
If work continues immediately, the highest-leverage sequence is:

1. add a high-level React application runtime
2. standardize action execution above raw dispatch tokens
3. move shared focus and runtime state exposure into reusable adapters
4. reduce renderer bootstrapping boilerplate
5. introduce higher-level authoring helpers for common layout patterns
6. establish a first-class styling and theme story
7. rewrite the first-party examples around the new path
8. expand regression coverage around the higher-level APIs
9. resume tooling work on top of the simpler surface

That order keeps the project anchored to the spec's actual promise: simple, shared UI creation for DOM and TUI, not just a correct collection of lower-level primitives.