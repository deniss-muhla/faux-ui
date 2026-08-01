# Changelog

## 1.0.0 — 2026-07-31

First release-ready implementation.

### Added

- One `@faux-ui/ui` package with isolated `/dom`, `/tui`, `/testing`, and JSX runtime entrypoints.
- React foundation: `Text`, `Box`, `Row`, `Column`, `Fill`, `Divider`, `ScrollView`, `Button`, `ThemeProvider`, `useInput`, and `useFocusManager`.
- Pure preferred-size and exact one-axis cell layout.
- Generated/vendored Unicode 17 grapheme and terminal-width data with no Unicode runtime dependency.
- Shared canonical cell scene and interaction controller.
- Grouped row/style-run DOM projection, viewport/container fitting, pixel-to-cell input, and minimal application/action accessibility.
- ANSI TUI projection, terminal keyboard/SGR mouse/resize handling, fake IO, and lifecycle restoration.
- Static layout/scene/text/event inspection API.
- Serious dual-host fixture, official Unicode conformance tests, property tests, Chromium tests, packed-consumer tests, and CI.

### Fixed

- Browser font advances are fitted to logical cells and adjacent run backgrounds overlap safely, preventing clipped borders, cumulative row shifts, and fractional-scale seams.
- Terminal painting disables autowrap and uses explicit CRLF row boundaries, preventing full-width frames from inserting blank or shifted rows.
- Compact fixture actions retain horizontal breathing room.

### Removed

- Prototype app/core/reconciler/renderer/schema/CLI/MCP/devtools packages.
- Environment-detecting render facade.
- Runtime bridge and public node handles.
- Generic/inspect/canvas renderer experiments.
- General grid/named placement, compact schema, action strings, and duplicated DOM/TUI interaction state.

No compatibility aliases were retained because the prototype had not been released.
