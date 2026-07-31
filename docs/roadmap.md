# faux-ui roadmap

## Current position

Status: **1.0.0 implementation complete and release-ready**

The destructive TUI-first reset is implemented on `refactor/tui-first-reset`. Publication/tagging is a separate explicit release action.

The authoritative behavior is [spec.md](spec.md), implemented structure is [architecture.md](architecture.md), and product scope is [strategy.md](strategy.md). Historical evidence and task detail remain under [refactor/](refactor/).

## Completed reset milestones

### 0 — Analysis and direction reset

Complete:

- repository/source/docs/Git/PR review;
- real-use case study;
- reproduced browser facade failure;
- external framework comparison;
- clean-break report, specification, strategy, and task plan.

### 1 — Decision spikes and parity gates

Complete:

- pinned generated Unicode 17.0.0 data with no Unicode runtime dependency;
- grouped DOM row/style-run projection proven in Chromium;
- minimal one-surface DOM accessibility contract frozen;
- explicit and host-fitted DOM sizing frozen/tested;
- serious synthetic queue/detail/metadata fixture added;
- package/browser isolation gate added.

### 2 — Single-package semantic kernel

Complete:

- `@faux-ui/ui` is the only public package;
- `/dom`, `/tui`, `/testing`, and JSX runtime subpaths are isolated;
- preferred-size and parent-to-child layout passes are pure derived output;
- row/column fixed/auto/fraction allocation replaces general grid placement;
- scroll viewport/content geometry is shared;
- UTF-16 string length is not used as display width.

### 3 — Canonical scene and interaction

Complete:

- backgrounds, borders, titles, fills, text, clipping, focus, hover, and scroll transforms paint once;
- width-2 graphemes use continuation cells;
- one controller owns focus, key routing, press, pointer, hover, and scroll;
- dividers use their allocated frame;
- direct handlers and app hotkeys work without DOM globals.

### 4 — TUI-first vertical slice

Complete:

- React reconciler internalized;
- foundation components implemented;
- canonical scene projects to true-color ANSI;
- terminal key/CSI/SGR mouse/resize input uses the shared controller;
- raw mode, cursor, mouse, alternate screen, and fake IO lifecycle are covered.

### 5 — DOM mirror

Complete:

- one application surface renders row/style runs without per-cell elements;
- default host reset/font/palette requires no app CSS;
- pointer pixels map through actual surface geometry;
- browser key/pointer/wheel/resize input uses the shared controller;
- accessibility actions mirror shared focus through `aria-activedescendant`;
- Bun and Vite DOM bundles contain no Node/TUI code.

### 6 — Public authoring proof

Complete:

- one serious public-API fixture runs on both hosts;
- DOM/TUI entry files are minimal and target-specific;
- tests themselves are typechecked;
- official Unicode conformance and randomized layout properties run;
- packed-package consumer installs, typechecks, bundles with Bun/Vite, and executes fake TUI IO.

### 7 — Prototype deletion and 1.0 preparation

Complete:

- 12 obsolete workspace packages removed;
- inspect/canvas/schema/CLI/MCP/devtools/runtime-bridge surfaces removed;
- old examples, aliases, configs, tests, scripts, and lock entries removed;
- tracked transient logs/test artifacts removed;
- package metadata, license, package README, root guides, and architecture updated;
- Bun requirement/package-manager metadata and TypeScript, React, Vite, Vitest, Playwright, types, and fast-check updated to current stable versions.

## 1.0 release gate

Implemented gates:

- [x] one app-author package;
- [x] one-call DOM and TUI mounting;
- [x] direct React state/handlers;
- [x] deterministic explicit cell layout;
- [x] shared canonical scene and controller;
- [x] Unicode 17 grapheme conformance;
- [x] browser target isolation;
- [x] fake terminal lifecycle;
- [x] no-CSS serious browser fixture;
- [x] packed external-consumer test;
- [x] typecheck, unit/property/conformance, browser, package, and build checks;
- [x] no compatibility aliases.

Release action still requiring an explicit maintainer command:

- create the release commit/PR;
- tag `v1.0.0`;
- publish `@faux-ui/ui@1.0.0`.

## Post-1.0 candidates

These are evidence-gated, not promised:

1. controlled text input with caret/selection;
2. selectable list component if multiple real apps repeat state/scroll logic;
3. width-explicit wrapped-text helper;
4. generated readable JSON adapter;
5. inspection CLI over `/testing`;
6. MCP integration over the stable inspection contract;
7. virtualization/tables/trees only after measured real demand;
8. third-party renderer API only after a real external renderer exists.

## Priority rule

For post-1.0 work:

1. fix parity or packaging regressions before adding components;
2. require specified TUI behavior and cross-host tests;
3. prefer recipes until repetition is demonstrated;
4. profile the serious fixture before caching or virtualization;
5. keep browser and terminal dependency graphs isolated.
