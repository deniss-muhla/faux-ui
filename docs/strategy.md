# faux-ui strategy

## Mission

Make text-oriented tool interfaces unusually easy for both coding agents and humans to author, inspect, test, and run in a terminal or browser.

## Positioning

faux-ui is not a browser UI kit that happens to support terminals. It is a terminal-first cell UI with a browser mirror.

The framework is optimized for:

- review and triage queues;
- dashboards and status surfaces;
- inspectors and metadata panes;
- logs and operational controls;
- keyboard-first local/internal tools;
- agent-generated interfaces where source-level determinism matters.

React supplies familiar state and composition. faux-ui supplies a constrained semantic layout, shared interaction model, and host projection.

## Core bet

Agents and humans can reason more reliably about this:

```tsx
<Columns tracks={[30, "2fr", "3fr"]} gap={1}>
```

Here each child occupies one column, so numeric tracks are widths. `Rows` similarly creates child rows whose numeric tracks are heights.

than about an open-ended combination of HTML, CSS, browser defaults, and responsive negotiation.

The constraint is the feature:

- integer cells;
- explicit tracks;
- fixed semantic palette;
- small component vocabulary;
- visible clipping/overflow rules;
- one output that can be inspected as text.

## Product principles

### 1. TUI decides semantics

For every layout, glyph, focus, activation, or scroll feature, specify terminal behavior first. DOM may adapt physical input/display, but not invent alternate behavior.

### 2. Logical parity beats visual approximation

Both hosts consume the same layout, controller state, and canonical cell scene. Pixel screenshots are secondary evidence; scene and event equality are primary.

### 3. One required public door

Every app installs `@faux-ui/ui` and uses its host-specific subpaths. Specialized, independently useful components may ship as optional peer packages such as `@faux-ui/grid`; they must never make internal modularity package-resolution work for ordinary consumers.

### 4. Ordinary React, no framework-owned app state

Use hooks, props, and direct handlers. Do not require action-token registries, custom reducers, manual rerenders, node IDs, or runtime adapters for JSX applications.

### 5. No app CSS for the successful path

The DOM host owns the minimal reset, cell surface, default font/palette, and projection styles. Apps express semantic layout/style in JSX.

### 6. Small but complete before broad

A few composable primitives must handle a serious tool UI cleanly before adding schemas, CLIs, MCP, renderer SDKs, or a large widget catalog.

### 7. Recipes before components

App shell, toolbar, inspector layout, status panel, and empty/loading/error surfaces begin as documented compositions. Promote a component only after repeated real use shows stable semantics. Specialized components can mature in standalone packages without expanding the required root foundation.

### 8. Do not regrow accidental complexity

The unreleased prototype was replaced without compatibility layers. Version 0.9.1 remains an evidence-gathering contract; after 1.0, preserve the singular public surface with SemVer and do not reintroduce deleted package boundaries or speculative adapters.

### 9. Profile before caching

Typical terminal surfaces are small. Start with pure, observable computation and add caches only around measured bottlenecks.

### 10. Packaging is a feature

A feature is not delivered if it works only through workspace aliases. Packed-package install, typecheck, Bun/Vite browser bundle, and fake-terminal execution are release gates.

## Author experience

A shared app should look like normal React:

```tsx
import { Box, Button, Rows, Columns, Text } from "@faux-ui/ui";
```

A browser entry should be target-specific and tiny:

```tsx
import { render } from "@faux-ui/ui/dom";
render(<App />, { fit: "viewport" });
```

A terminal entry should be equally small:

```tsx
import { render } from "@faux-ui/ui/tui";
render(<App />);
```

No other faux-ui package, provider, bridge, renderer object, constraint reader, or CSS file should be necessary for the default path. Applications opt into `@faux-ui/grid` only when they need true shared two-axis placement.

## Foundation scope

The first foundation is intentionally narrow:

- text with explicit lines and deterministic clipping/ellipsis;
- rectangular boxes with semantic style, padding, border, and title;
- sequential child `Rows` and `Columns` with fixed/auto/fraction tracks and gap;
- fill/divider using allocated extents;
- scroll viewport with shared offset behavior;
- button with one pointer/keyboard activation contract;
- root key handling and focus traversal;
- one theme palette across hosts.

This set is selected because it is both renderer-neutral and directly supported by real-use evidence. CSS-grid-like shared tracks, numeric placement, and spans remain outside the root in `@faux-ui/grid`.

### Standalone component packages

`@faux-ui/grid` is the reference boundary for third-party components:

- UI and React are peer dependencies;
- runtime source imports only documented public entrypoints;
- pure custom layout receives sizes and returns integer rectangles, never engine objects;
- the tarball ships source, license, README, changelog, tests-by-evidence, and optional Agent Skills;
- clean packed consumers prove types plus DOM/TUI behavior.

A standalone package must not become a route for leaking internals or duplicating host behavior.

## Scope filter

Before adding a core or public feature, answer:

1. What is its canonical TUI behavior?
2. Can DOM render the same logical cells and dispatch the same event trace?
3. Is it impossible or unreasonably repetitive to compose from the foundation?
4. Did a serious fixture or at least two real applications need it?
5. Can it be explained to an agent with a small deterministic contract?
6. Does it add less complexity than the workaround it removes?
7. Does it preserve browser-safe target isolation?

If any answer is weak, keep it as a recipe or defer it.

## Competitive distinction

- Ink offers familiar React plus broad Yoga/Flexbox semantics.
- Textual offers a rich CSS-like application framework and widget catalog.
- Ratatui offers a broad terminal widget ecosystem.

faux-ui should not compete on breadth. Its distinction is:

- a much smaller explicit default allocator, with optional pure layout extensions;
- browser and terminal from one canonical cell scene;
- package/API design optimized for agent-generated tools;
- inspectability as a first-order output;
- no CSS or renderer-specific app composition.

## Delivery strategy

### Vertical slices, not horizontal ecosystems

Build in this order:

1. one tree;
2. one layout;
3. one scene;
4. one controller;
5. TUI projection;
6. DOM projection;
7. public components;
8. one serious fixture;
9. only then tooling.

Do not independently deepen schema, CLI, DOM, and TUI layers before an end-to-end slice is usable.

### TUI first, DOM immediately after

“TUI first” must not mean DOM parity is postponed indefinitely. Every semantic milestone is accepted in TUI, then projected and contract-tested in DOM before moving to the next semantic feature.

### Consumer evidence loop

The synthetic real-tool fixture is the initial product benchmark. Future real apps should record:

- setup steps;
- framework-specific lines/workarounds;
- repeated compositions;
- cross-host differences;
- build/package failures;
- missing primitive requests.

Roadmap changes should cite this evidence rather than speculative ecosystem completeness.

## 0.9 evidence baseline

The pre-1.0 implementation establishes:

- one required faux-ui foundation package, with optional standalone component peers;
- one-call DOM and TUI mounting;
- zero target leakage in browser bundles;
- zero app CSS/runtime bridge in the serious fixture;
- one logical scene and controller across hosts;
- global shortcuts, focus, buttons, pointer input, and scroll on both hosts;
- deterministic Unicode 17 cell behavior and official grapheme conformance;
- packed foundation and extension consumer checks;
- documentation that starts with external app setup rather than internal package architecture.

## What “done” does not mean

The 0.9 foundation does not imply a large widget catalog, renderer marketplace, compact protocol, MCP server, virtualized table, or browser-responsive system.

Future scope must keep the coherent text-first path easier to use while preserving deterministic terminal/browser behavior.
