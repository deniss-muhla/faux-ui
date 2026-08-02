# faux-ui roadmap

## Current position

Status: **0.9.1 implementation complete; gathering evidence before release and 1.0**

The destructive TUI-first reset, rendering stabilization, and focused public-language cutover are implemented on `refactor/tui-first-reset`. The branch has not been merged, tagged, or published. Version 0.9.1 intentionally leaves room for further evidence before the stable 1.0 contract.

The authoritative implemented behavior is [spec.md](spec.md), implemented structure is [architecture.md](architecture.md), and product scope is [strategy.md](strategy.md). Development history is indexed in [docs/README.md](README.md). The implemented plural-layout rationale is in the [2026-08-01 API language decision](refactors/2026-08-01-api-language-review/03-decision.md).

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

- `@faux-ui/ui` is the only required foundation package;
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

### 7 — Prototype deletion and pre-1.0 preparation

Complete:

- 12 obsolete workspace packages removed;
- inspect/canvas/schema/CLI/MCP/devtools/runtime-bridge surfaces removed;
- old examples, aliases, configs, tests, scripts, and lock entries removed;
- tracked transient logs/test artifacts removed;
- package metadata, license, package README, root guides, and architecture updated;
- Bun requirement/package-manager metadata and TypeScript, React, Vite, Vitest, Playwright, types, and fast-check updated to current stable versions.

## Completed 0.9.1 public API polish

- [x] inventory the component, prop, type, host, lifecycle, and testing language;
- [x] evaluate three broad naming variants against the likely React/TypeScript audience;
- [x] use `Rows` for child rows/height tracks and `Columns` for child columns/width tracks;
- [x] retain `Track`, `auto`/fraction syntax, `padding`, `gap`, `x` / `y`, and host/lifecycle names;
- [x] rename `hotkey` to display-only `keyHint`;
- [x] rename `styleFocus` / `styleHover` to `focusStyle` / `hoverStyle`;
- [x] remove ineffective Box alignment and replace paired `Text.alignX` / `alignY` with `align={{ x, y }}`;
- [x] defer outer spacing because its contract costs exceed current evidence;
- [x] update examples, current docs, type tests, and packed consumers without aliases;
- [x] ship a portable `faux-ui` foundation Agent Skill with Pi/Codex/Claude discovery metadata.

See the [public-language dossier](refactors/2026-08-01-api-language-review/README.md) and [cross-agent packaging reference](agent-skill-packaging.md).

## Completed standalone Grid extension

- [x] add browser-safe `@faux-ui/ui/layout` pure geometry extension contract;
- [x] publish-ready `@faux-ui/grid@0.1.0` workspace package with UI/React peers and no runtime dependency;
- [x] fixed/auto/fraction tracks, `repeat()`, source-ordered automatic placement, two-axis spans, implicit `auto` tracks, independent gaps, overlap, and clipping;
- [x] keep text and scrolling in the existing `Text` and `ScrollView` composition primitives;
- [x] keep Grid outside the required UI foundation and import no UI internals;
- [x] ship README, changelog, license, reference source, and one portable `faux-ui-grid` Agent Skill with Pi/Codex/Claude discovery metadata;
- [x] cover pure layout validation, examples, negative types, 500 randomized placement cases, real Chromium behavior, and clean two-tarball consumers.

See the [standalone Grid dossier](refactors/2026-08-01-standalone-grid/README.md) and [package guide](../packages/grid/README.md).

## 0.9.1 evidence gate

Implemented semantic/host gates:

- [x] one required app-author foundation package;
- [x] one-call DOM and TUI mounting;
- [x] direct React state/handlers;
- [x] deterministic explicit cell layout;
- [x] shared canonical scene and controller;
- [x] Unicode 17 grapheme conformance;
- [x] browser target isolation;
- [x] fake terminal lifecycle;
- [x] no-CSS serious browser fixture;
- [x] packed foundation and standalone Grid external-consumer tests;
- [x] typecheck, unit/property/conformance, browser, package, and build checks;
- [x] no compatibility aliases.

Work still required before any release action:

- gather more real-use data with the 0.9.1 contract;
- record pressure around plural layout names, Grid placement/spans, track readability, spacing, and repeated compositions;
- rerun all release gates after any resulting change;
- create the release commit/PR;
- tag or publish only on an explicit maintainer instruction.

A future 1.0 requires evidence that the public names and narrow foundation are stable; changing the manifest version does not itself freeze the contract.

## Post-1.0 candidates

These are evidence-gated, not promised:

1. controlled text input with caret/selection;
2. selectable list component if multiple real apps repeat state/scroll logic;
3. width-explicit wrapped-text helper;
4. generated readable JSON adapter;
5. inspection CLI over `/testing`;
6. MCP integration over the stable inspection contract;
7. virtualized data tables/trees only after measured real demand;
8. third-party renderer API only after a real external renderer exists.

## Priority rule

For post-1.0 work:

1. fix parity or packaging regressions before adding components;
2. require specified TUI behavior and cross-host tests;
3. prefer recipes until repetition is demonstrated;
4. profile the serious fixture before caching or virtualization;
5. keep browser and terminal dependency graphs isolated.
