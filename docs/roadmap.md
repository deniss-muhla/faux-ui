# faux-ui roadmap

This roadmap tracks delivery state for the unreleased vNext reset. The normative behavior is in [spec.md](spec.md), product choices are in [strategy.md](strategy.md), evidence is in [refactor/report.md](refactor/report.md), and executable checklists are in [refactor/tasks.md](refactor/tasks.md).

## Current position

The prototype proved the central idea but not a releasable app-author experience.

Validated:

- React is a productive authoring bridge.
- Integer cell layout is understandable to agents and humans.
- Shared semantic layout, clipping, and hit testing are viable.
- A useful browser tool can be built without app CSS.
- TUI-first visual language maps naturally to review/triage/operations tools.

Not validated or currently broken:

- the multi-package external install path;
- browser-safe use of the app facade;
- true DOM/TUI input and Unicode parity;
- a small complete public component set;
- generic renderer, compact schema, MCP, and CLI product demand.

The project is unreleased. vNext is a clean break with no aliases or migration work.

## Milestone 0 — Analysis and direction reset

Status: **complete**

Delivered:

- repository, docs, source, tests, and Git/PR history review;
- first real-use case study and feedback review;
- reproduced Bun/browser facade failure;
- live synthetic consumer UI inspection;
- baseline typecheck/build/test verification;
- external framework comparison;
- refactor analysis, report, and ordered task plan;
- vNext specification and strategy reset.

Artifacts:

- [refactor/analisis.md](refactor/analisis.md)
- [refactor/report.md](refactor/report.md)
- [refactor/tasks.md](refactor/tasks.md)

## Milestone 1 — Decision spikes and parity gates

Status: **next**

Goals:

- pin Unicode grapheme/cell-width behavior;
- prove a grouped-run DOM projection of a canonical cell scene;
- decide minimal DOM accessibility semantics;
- settle explicit versus host-fitted root sizing at the public API edge;
- add a synthetic real-tool fixture;
- add packed-package and browser-isolation tests before the rewrite.

Exit criteria:

- the four open design questions are frozen in the spec;
- Bun and Vite package tests detect any DOM-to-TUI dependency leak;
- the real-tool fixture has expected layout, scene, and interaction traces.

## Milestone 2 — Single-package semantic kernel

Status: not started

Goals:

- establish `@faux-ui/ui` as the single package with isolated host subpaths;
- implement pinned cellization and ellipsis;
- replace mutable cached layout with pure preferred-size plus parent-to-child layout;
- reduce layout to nested rows/columns, fixed/auto/fraction tracks, gap, padding, border, and alignment;
- implement scroll viewport/content geometry.

Exit criteria:

- layout is a pure function of tree plus explicit root size;
- all geometry is non-negative integer cells;
- no UTF-16 string length is used as display width;
- named placement/general grids/dead wrap and measurement APIs are gone.

## Milestone 3 — Canonical scene and shared interaction

Status: not started

Goals:

- move framebuffer/cell painting into shared internals;
- paint text, backgrounds, borders, dividers, focus/hover, and scroll chrome once;
- implement one focus/key/press/pointer/scroll controller;
- remove duplicated DOM/TUI interaction state machines.

Exit criteria:

- one logical scene is the source for TUI, DOM, snapshots, and inspection;
- identical controller commands produce identical event traces;
- dividers use allocated extents rather than arbitrary fill constants;
- global hotkeys work without DOM globals.

## Milestone 4 — TUI-first vertical slice

Status: not started

Goals:

- internalize/minimize the React reconciler;
- expose the first public foundation components;
- project the shared scene to ANSI;
- adapt terminal input/resize to the shared controller;
- run the real-tool fixture as a terminal app.

Foundation gate:

- `Text`
- `Box`
- `Row`
- `Column`
- `Fill`/`Divider`
- `ScrollView`
- `Button`
- root input/focus hooks
- shared palette

Exit criteria:

- one-call TUI mount;
- direct React handlers and automatic hook rerenders;
- configurable palette;
- correct cleanup of raw mode/alternate screen;
- no public reconciler or node-handle concepts.

## Milestone 5 — DOM mirror

Status: not started

Goals:

- render scene rows/style runs in one browser application surface;
- install the minimal host reset and default monospace presentation internally;
- convert pointer pixels to cells correctly;
- adapt browser keyboard/pointer/wheel/resize to the shared controller;
- expose the approved accessibility projection.

Exit criteria:

- one-call DOM mount and no app CSS for the default path;
- no body-margin/root-overflow bug;
- Bun/Vite bundles contain no Node/TUI code or warnings;
- logical scene and interaction traces match TUI.

## Milestone 6 — Public authoring proof

Status: not started

Goals:

- replace current examples with a tiny example and the serious real-tool fixture;
- use shared app code with separate minimal DOM/TUI entries;
- document panel, app shell, action bar, split panes, key hints, and status states as recipes;
- add package tarball, type, browser, terminal, and cross-host quality gates.

Exit criteria:

- examples use only public package exports;
- no runtime bridge, manual renderer adapter, custom CSS, or internal source alias is normalized;
- tests themselves are typechecked;
- package-consumer tests pass from a packed artifact.

## Milestone 7 — Delete prototype surface and prepare 0.1

Status: not started

Goals:

- remove old package boundaries and speculative products without shims;
- remove old examples, paths, scripts, lock entries, and stale docs;
- verify installation guides for DOM-only, TUI-only, and dual-host apps;
- profile before adding any cache.

Expected removals:

- app facade and generic renderer packages;
- inspect/canvas renderer proof surfaces;
- UI runtime bridge;
- duplicated renderer text measurement;
- compact schema and token-action prototype;
- placeholder MCP/devtools;
- current create/exec CLIs.

Exit criteria:

- exactly one app-author package is required;
- all success criteria in [refactor/report.md](refactor/report.md) pass;
- no old package alias exists;
- repository is ready for its first release tag.

## Deferred until after the foundation proves itself

- controlled text input/caret semantics;
- first-class selectable list if recipes repeat too much logic;
- width-explicit wrapped-text helper;
- readable JSON adapter generated from shared types;
- inspection CLI and MCP integration;
- third-party renderer API;
- virtualization, tables, trees, tabs, and charts.

## Priority rule

When choosing the next task:

1. finish the current milestone's parity/consumer gate;
2. remove duplicated or speculative machinery before adding convenience;
3. prefer a recipe until repeated real use proves a component;
4. do not work on deferred tooling while the one-package DOM/TUI path is incomplete.
