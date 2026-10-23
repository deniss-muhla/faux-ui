# Changelog

## 0.10.0 — Unreleased

Pre-1.0 evidence candidate for gathering more real-use data before the stable contract. This candidate adds the public `TextSource` contract and axis-specific `ScrollView.followEnd` on top of the 0.9.1 evidence work.

### Added

- One `@faux-ui/ui` package with isolated `/dom`, `/tui`, `/testing`, and JSX runtime entrypoints.
- React foundation: `Text`, `Box`, `Rows`, `Columns`, `Fill`, `Divider`, `ScrollView`, `Button`, `ThemeProvider`, `useInput`, and `useFocusManager`.
- Plural one-axis layout names: `Rows` creates child rows with height tracks; `Columns` creates child columns with width tracks.
- Display-only `Button.keyHint`, modifier-first `focusStyle` / `hoverStyle`, and one `Text.align={{ x, y }}` axis prop.
- Browser-safe `@faux-ui/ui/layout` extension contract for pure third-party cell-layout components.
- Portable `faux-ui` foundation Agent Skill with Pi, Codex/ChatGPT, and Claude Code package/plugin metadata.
- Standalone `@faux-ui/grid@0.1.0` with CSS-grid-like tracks, source-ordered placement, spans, packaged source, documentation, tests, and a portable Pi/Codex/Claude Agent Skill.
- Pure preferred-size and exact one-axis/custom cell layout.
- Generated/vendored Unicode 17 grapheme and terminal-width data with no Unicode runtime dependency.
- Shared canonical cell scene and interaction controller.
- Grouped row/style-run DOM projection, viewport/container fitting, pixel-to-cell input, and minimal application/action accessibility.
- ANSI TUI projection, terminal keyboard/SGR mouse/resize handling, fake IO, and lifecycle restoration.
- Static layout/scene/text/event inspection API.
- Immutable persistent `TextSource` segments (`createTextSource`, `appendTextSourceSegment`, `extendTextSourceSegment`, `replaceTextSourceSegment`) for bounded incremental updates; ordinary string `Text` remains supported and keeps exact rendering.
- Compact exact text indexing with viewport-bounded prepared cells, separate cell-slot and copied-glyph-payload accounting, window eviction, mount-local cleanup, and unchanged preferred sizes.
- Axis-specific `ScrollView.followEnd` accepting `boolean | "x" | "y" | "both"`.
- Deterministic text work counters, an eager rendering oracle, static/fake-TUI/Chromium large-text parity coverage, and the versioned `large-text-benchmark-v1` benchmark runner.
- Prepared text windows retain their intersection when a compatible window moves and prepare only the entering strips; each prepared cell lives in one authoritative store.
- Serious dual-host fixture, official Unicode conformance tests, property tests, Chromium tests, packed-consumer tests, and CI.
- Opt-in Linux-only system-event monitor example for large `TextSource` updates, two-axis scrolling, vertical-only `followEnd`, and ordinary TUI row refreshes; the workspace typecheck includes it, but automated browser, package-consumer, and TUI behavior gates do not start it.

### Fixed

- `Home` and `End` in a scroll viewport with a scrollable vertical axis now move only the vertical offset and return to the left edge. Previously they moved both axes to their maximum, so a two-axis chat jumped to an empty right edge and the newest rows disappeared from view until `Home` was pressed.
- Focusing a control now scrolls the smallest offset that paints it into each of its scrolling ancestors, and controls scrolled out of view stay in focus order. Previously a control below a viewport could not receive focus at all, so `Tab` could not reach it and the focused row could stay hidden behind a short list window.
- The scroll a focus reveal makes now dispatches a scroll event carrying the offset change, one per moved ancestor, so a consumer that reads `onScroll` to paint a position indicator shows where the list really is. Previously the reveal moved the offset silently, so the indicator kept reporting the position before the reveal while the scene painted the revealed rows.
- Keyboard scroll commands and geometry-driven offset clamps now dispatch the existing `onScroll` event with the actual previous and resulting offsets. No-op geometry updates and initial `followEnd` placement emit no motion event; later follow-end movement reports its actual change.

- A wheel or pointer scroll whose innermost scrollable region cannot move now passes the same delta to the next scrollable ancestor. Previously a wheel over a non-scrollable region nested inside a longer list, such as a fixed summary block, moved nothing.
- A wheel or pointer scroll whose innermost scrollable region moves only part of the delta now passes the remainder to the next scrollable ancestor, and each moved region reports the delta it consumed. Previously an inner list one cell from its end consumed the whole wheel and the outer list stayed still, which read as a stuck list in a short viewport.
- Compatible `TextSource` updates batched into one React commit now reconcile proven ranges and rebuild only the suffix after the earliest unproven change instead of reindexing retained history.
- A stable repaint paints one canonical scene pass instead of an unconditional second pass, and a corrected follow-end scene stays attached for hit testing.
- Ordinary terminal updates write only changed rows instead of clearing the screen before every frame; start, resize, palette changes, and failed writes redraw completely.

- Pinned transitive `nanoid` to 3.3.18 to resolve GHSA-2v37-7h3g-55p8 in the Vite/PostCSS development graph.
- Browser font advances are fitted to logical cells, adjacent run backgrounds overlap safely, and Unicode terminal-graphics runs use a connection-safe, low-overhang monospace fallback stack with independent spacing, preventing clipped borders, cumulative row shifts, and fractional-scale seams without geometric overlays.
- Terminal painting disables autowrap, uses explicit CRLF row boundaries, and re-anchors after non-ASCII graphemes, preventing full-width frames and terminal-specific Unicode widths from shifting later cells.
- Browser mouse-wheel notches map to one terminal-like cell step while small trackpad deltas accumulate smoothly.
- Compact fixture actions retain horizontal breathing room.

### Removed

- Prototype app/core/reconciler/renderer/schema/CLI/MCP/devtools packages.
- Environment-detecting render facade.
- Runtime bridge and public node handles.
- Generic/inspect/canvas renderer experiments.
- General grid/named placement, compact schema, action strings, and duplicated DOM/TUI interaction state.

No compatibility aliases were retained because the package had not been published. Separate `Text.alignX` / `Text.alignY`, ineffective `Box.alignX` / `Box.alignY`, and the misleading pre-release `hotkey`, `styleFocus`, and `styleHover` names were removed.
