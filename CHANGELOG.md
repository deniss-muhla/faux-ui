# Changelog

## 0.9.1 — Unreleased

Pre-1.0 evidence candidate for gathering more real-use data before the stable contract.

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
- Serious dual-host fixture, official Unicode conformance tests, property tests, Chromium tests, packed-consumer tests, and CI.

### Fixed

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
