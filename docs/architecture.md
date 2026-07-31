# faux-ui architecture

## Document status

This document describes the **current pre-refactor implementation** on `main`/`refactor/tui-first-reset`. It does not pretend that the current package graph conforms to the new [vNext specification](spec.md).

The approved target architecture is in [refactor/report.md](refactor/report.md), implementation order is in [refactor/tasks.md](refactor/tasks.md), and delivery state is in [roadmap.md](roadmap.md). This document should be rewritten phase by phase as old layers are replaced.

## Current system overview

```mermaid
flowchart LR
  JSX[React/JSX] --> UI[@faux-ui/ui]
  UI --> REC[@faux-ui/reconciler]
  APP[@faux-ui/app] --> UI
  APP --> DOM[@faux-ui/render-dom]
  APP --> TUI[@faux-ui/render-tui]
  REC --> TREE[mutable UINode tree]
  JSON[JSON document] --> SCHEMA[@faux-ui/schema]
  SCHEMA --> EXEC[exec-faux-ui]
  EXEC --> TREE
  TREE --> CORE[@faux-ui/core layout/render tree]
  CORE --> DOM
  CORE --> TUI
  CORE --> INSPECT[@faux-ui/render-inspect]
```

The implementation has three useful conceptual stages:

1. React reconciliation or schema adaptation creates mutable semantic `UINode` objects.
2. Core layout writes cached sizes/child frames and builds an absolute clipped render tree.
3. DOM and TUI independently project that render tree and independently manage most interaction state.

The central shared-layout idea is sound. The surrounding package and runtime layers are larger and less isolated than intended.

## Current package graph

### App-author packages

- `@faux-ui/ui`: JSX runtime plus `AppShell`, `Button`, `Panel`, and `Divider`.
- `@faux-ui/app`: environment-selecting render facade and UI runtime-bridge setup.
- `create-faux-ui`: project/template generator.
- `exec-faux-ui`: JSON document render/inspect CLI.

### Engine/host packages

- `@faux-ui/core`: semantic node types, mutable invalidation/cache state, track layout, render tree, hit testing, event action collection, semantic palette.
- `@faux-ui/reconciler`: custom React reconciler for `view` and `text` host instances.
- `@faux-ui/renderer`: generic renderer definition and shared React mount adapter.
- `@faux-ui/render-dom`: DOM model, live DOM runtime, browser render helper, theme adapter, and unused text-measurement exports.
- `@faux-ui/render-tui`: framebuffer, ANSI projection, TUI runtime, terminal input/host, and render helper.
- `@faux-ui/render-inspect`: tree snapshot renderer used as a generic-renderer proof.

### Schema/tooling packages

- `@faux-ui/schema`: duplicated readable schema types, validation, and compact codec.
- `@faux-ui/devtools`: layout dump formatter.
- `@faux-ui/mcp`: placeholder request/command types.

There are 13 packages in total. Workspace consumers see all of them even when they only need DOM UI.

## Current semantic tree

`@faux-ui/core` defines two node kinds:

- `ViewNode`
- `TextNode`

Each node contains:

- stable numeric ID;
- parent/children links;
- normalized semantic spec;
- event bindings (direct functions or string action identifiers);
- revision/subtree revision numbers;
- dirty intrinsic/layout/paint flags;
- mutable cached layout state.

View specs currently support:

- row and column track arrays;
- optional named tracks;
- child row/column placement by index or name;
- scroll axis;
- normal/hover/focus semantic style;
- focusability.

Text specs still declare an optional `wrap` field, but normalization discards it and layout never uses it.

## Current React bridge

`@faux-ui/reconciler` uses `react-reconciler` to maintain semantic nodes.

Current rules:

- only `view` and `text` host strings are legal in the custom JSX namespace;
- raw strings are legal only under `text`;
- nested host elements under `text` are rejected;
- event props map to semantic binding slots;
- bindings accept direct functions or string identifiers;
- React commits call an optional `onCommit` callback used by renderer mounting helpers.

`@faux-ui/ui` re-exports a second JSX runtime namespace so apps configure `jsxImportSource: "@faux-ui/ui"`.

## Current layout pipeline

`layoutNode()` delegates to `computeLayout()` and commits derived state back onto each semantic node.

### Text

- Splits on explicit newlines.
- Uses JavaScript UTF-16 line length as width.
- Clamps allocated size to max constraints.
- Retains the unclamped extent as content size.

### View

1. Missing axes normalize to one `1fr` track.
2. Named/index placement builds a two-dimensional occupancy map.
3. Fixed and content tracks resolve before fractions.
4. Content tracks lay out relevant children with fully unbounded constraints.
5. Scroll axes resolve tracks as unbounded.
6. Children are laid out again with resolved track max constraints.
7. Child frames and bubbled content extent are cached.
8. The view reports content extent clamped by incoming max constraints.

This produces deterministic results, but it is not a single parent-to-child allocation pass. Intrinsic child layout participates in track resolution and children may be computed more than once.

Layout cache reuse requires clean flags, equal constraints, and an unchanged subtree revision.

## Current render tree

`buildRenderTree()`:

- requires bounded root constraints;
- runs/reuses layout;
- forces a root view to the full viewport while a text root uses returned size;
- converts relative child frames to absolute frames;
- applies scroll offsets as render transforms;
- intersects descendant clips;
- drops fully clipped descendants;
- caches the resulting visible tree by root, constraints, scroll map, revision, and paint state.

The render tree is the strongest current cross-host boundary. Both renderers use it for geometry, and core hit testing walks it deepest-child-first.

## Current event model

Core event helpers:

- hit test a render tree point;
- construct a target-to-root path;
- collect matching bindings from target outward;
- resolve the nearest focusable view.

The host runtimes then independently implement:

- focused node state;
- hover path transitions;
- active pointer/drag state;
- keyboard activation;
- scroll offset ownership/clamping;
- direct/string action resolution;
- concrete event payloads;
- rerender scheduling and lifecycle cleanup.

DOM and TUI runtime files duplicate much of this state machine, and lifecycle details already differ between them.

## Current DOM projection

`renderToDomModel()` maps each visible render node to an absolutely positioned `div` model:

- cell dimensions are CSS expressions using `--faux-ui-cell-width` and `--faux-ui-cell-height`;
- text uses `white-space: pre`, hidden overflow, and a monospace font variable;
- view backgrounds and focus/hover styles use semantic CSS variables;
- nested nodes use coordinates relative to their render-tree parent.

`mountDomRoot()` rebuilds the complete live DOM model and calls `replaceChildren()` on rerender. It also installs delegated browser listeners.

`render()`:

- defaults to `document.body`;
- installs default semantic CSS variables;
- measures a probe glyph/container to derive constraints when none are supplied;
- observes container resize;
- mounts through the generic renderer adapter.

Known architectural problems:

- pointer coordinates subtract pixels but do not convert pixels to cells;
- native event-target lookup masks that bug for common clicks;
- body viewport measurement does not account cleanly for default body margin;
- DOM text measurer exports are dead and contradict fixed-cell intent;
- browser entry through `@faux-ui/app` statically imports TUI/Node code.

## Current TUI projection

`renderToFrameBuffer()`:

- creates a cell array at render-tree size;
- fills the default semantic surface;
- paints view backgrounds/styles;
- splits text on newlines and writes UTF-16 code units;
- resolves semantic tokens through the fixed default palette;
- serializes cells to true-color ANSI.

`mountTuiRoot()` implements interaction state. `mountTerminalTuiHost()` adds:

- terminal size resolution;
- alternate-screen/cursor/raw-mode lifecycle;
- keyboard and SGR mouse parsing;
- resize handling;
- full-frame redraw.

The terminal host is a useful host boundary, but TUI theme customization and Unicode cell behavior are incomplete.

## Current public UI layer

`@faux-ui/ui` contains:

- theme vocabulary layered over core semantic colors;
- `AppShell`;
- `Button`;
- `Panel`;
- `Divider`;
- `UiRuntimeProvider` and runtime bridge hooks.

The runtime bridge exists so a scroll-aware `Panel` can discover its internal node ID, traverse mounted semantic state, read viewport/content metrics, and call renderer scroll methods.

`Divider` cannot see its allocated frame, so it emits an arbitrary 512-character horizontal line or 256 vertical one-cell children and relies on clipping.

This layer proved useful concepts but couples component composition to runtime internals and is the main reason the app facade must wrap every application in a provider.

## Current app facade and bundle behavior

`@faux-ui/app` statically imports DOM and TUI definitions, detects the environment, selects a renderer, wraps the app with the runtime provider, and adapts scroll methods.

Consequences:

- render options are an intersection of host-specific options;
- mounted return type is a DOM/TUI union;
- importing the facade into a browser reaches terminal code;
- Vite emits a `node:process` browser-externalization warning;
- Bun browser bundling fails on the TUI host's default `node:process` import.

The one external app therefore bypassed the facade and manually reproduced its bridge wiring.

## Current schema and tooling path

The schema package maintains separate copies of tracks, colors, styles, bindings, and text wrapping. `exec-faux-ui` converts validated documents into core nodes, then renders or serializes layout/render/DOM/TUI output. The compact codec and renderer scaffold are not used by the external app.

This tooling is architecturally outside the core, but it was built before the public React path stabilized and now preserves stale semantics.

## Current tests and verification

After dependency synchronization:

- workspace typecheck passes;
- workspace build passes;
- 23 Vitest files / 125 tests pass;
- first-party Vite builds pass with a TUI/Node externalization warning.

Important limitation: package tests are not included by package TypeScript projects, and Vitest transpiles without typechecking. Several DOM tests pass obsolete `measureText` options that runtime types no longer expose.

## Boundaries worth retaining during the reset

Even though packages will collapse, these conceptual boundaries remain valuable:

- React reconciliation versus semantic computation;
- semantic tree versus derived layout;
- layout versus scroll transform/paint;
- shared interaction semantics versus host input parsing;
- canonical scene versus ANSI/DOM projection;
- app state versus framework interaction state.

Internal modules should preserve those boundaries without publishing each one as a package.

## Transition rule

Until a vNext phase lands, this document describes the old layer honestly. After each destructive replacement:

1. remove the obsolete section rather than documenting two APIs;
2. describe only implemented architecture here;
3. update roadmap status;
4. keep future intent in the spec/report/tasks, not as a claim about current code.
