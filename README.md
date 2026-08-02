# faux-ui

Deterministic terminal-cell UI for React, with terminal and browser hosts driven by the same logical scene.

```tsx
<Columns tracks={[28, "2fr", 30]} gap={1}>
  <Queue />
  <Details />
  <Metadata />
</Columns>
```

faux-ui favors explicit integer-cell layout over CSS/Yoga-style negotiation. It is intended for review queues, dashboards, inspectors, logs, and keyboard-first operational tools authored by humans or coding agents.

Version 0.9.1 is an unreleased pre-1.0 evidence candidate. The project will gather more real-use data before freezing the 1.0 public contract.

## Install

```bash
bun add @faux-ui/ui react
```

Requirements:

- Bun 1.3.14+ for the workspace/recommended toolchain;
- Node 22+ for terminal applications;
- React 19.2.8+;
- current evergreen browsers.

Configure JSX in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@faux-ui/ui"
  }
}
```

HTML/SVG intrinsic elements are intentionally rejected in faux-ui JSX.

## Shared application

```tsx
import {
  Box,
  Button,
  Columns,
  Rows,
  ScrollView,
  Text,
  useInput,
} from "@faux-ui/ui";
import { useState } from "react";

export function App() {
  const [selected, setSelected] = useState(0);
  const approve = () => {};

  useInput((input) => {
    if (input.key === "j") {
      setSelected((value) => value + 1);
      return true;
    }
    if (input.key === "a") {
      approve();
      return true;
    }
    return false;
  });

  return (
    <Rows tracks={[3, "1fr", 2]}>
      <Box border="double" title=" Review " padding={{ x: 1 }}>
        <Text>Shared terminal/browser application</Text>
      </Box>

      <Columns tracks={[24, "1fr"]} gap={1}>
        <ScrollView axis="y" border title=" Queue ">
          <Rows>
            <Button label="First" selected={selected === 0} onPress={() => setSelected(0)} />
            <Button label="Second" selected={selected === 1} onPress={() => setSelected(1)} />
          </Rows>
        </ScrollView>
        <Box border title=" Detail " padding={1}>
          <Text overflow="ellipsis-end">Selected item {selected}</Text>
        </Box>
      </Columns>

      <Button label="Approve" keyHint="a" onPress={approve} />
    </Rows>
  );
}
```

React hooks and direct handlers work normally. There is no action registry, runtime bridge, manual rerender, public node ID, or renderer object.

## Browser entry

```tsx
import { render } from "@faux-ui/ui/dom";
import { App } from "./App.js";

const app = render(<App />, {
  ariaLabel: "Review tool",
  // width: 100,
  // height: 30,
});

// app.rerender(<App />)
// app.setSize({ width: 120, height: 40 })
// app.unmount()
```

The default body mount:

- fits the viewport using fixed 8×16-pixel cell calibration;
- installs the required margin/overflow/font reset;
- renders grouped row/style runs rather than one element per cell;
- keeps connectable Unicode glyphs as text while using a connection-safe terminal-graphics font stack;
- maps pointer pixels back to logical cells and normalizes wheel notches to one-cell steps;
- exposes one `role="application"` tab stop plus labeled semantic actions;
- requires no app-authored CSS.

For a custom container, pass `container`. It must have concrete dimensions when using `fit: "container"`. Passing explicit `width` and `height` bypasses host-derived logical sizing.

The DOM entry has no dependency on terminal or Node modules.

## Terminal entry

```tsx
import { render } from "@faux-ui/ui/tui";
import { App } from "./App.js";

const app = render(<App />);

// app.rerender(<App />)
// app.stop()
// app.start()
// app.unmount()
```

The terminal host derives its logical size from columns/rows, handles keyboard and SGR mouse input, writes true-color ANSI, and restores raw mode, cursor, mouse tracking, and alternate-screen state on unmount.

Fake `input` and `output` streams can be passed for tests.

## Layout

All dimensions are non-negative integer cells.

```ts
type Track = number | "auto" | `${number}fr`;
```

- fixed tracks reserve exact main-axis cells: heights in `Rows`, widths in `Columns`;
- `auto` uses preferred content size;
- fractions divide positive remaining space;
- remainder cells are assigned from the first fraction track onward;
- fixed/auto overflow is clipped, never renegotiated;
- base text uses explicit newlines and never auto-wraps;
- margin, percentages, named tracks, spans, overlap, and responsive breakpoints do not exist.

`Rows` places each child in a row; `Columns` places each child in a column. Use nested `Rows` and `Columns` instead of a general two-dimensional grid.

## Foundation

| Component | Purpose |
| --- | --- |
| `Text` | Explicit-line text with clip/start/middle/end ellipsis |
| `Box` | Single-child surface with padding, border, title, style, and handlers |
| `Rows` / `Columns` | Child rows (height tracks) / child columns (width tracks) |
| `Fill` / `Divider` | Paint an allocated frame without guessed string lengths |
| `ScrollView` | Shared viewport/content/offset semantics |
| `Button` | One focus, pointer, Enter, Space, and `onPress` contract |
| `ThemeProvider` | Shared semantic palette override |

App shells, panels, action bars, split panes, key hints, and status states are compositions of these primitives.

## Input and focus

- `useInput(handler)` registers renderer-neutral keyboard shortcuts. Return `true` to consume a key.
- `useFocusManager()` exposes next, previous, and clear focus operations.
- `Tab` and `Shift+Tab` traverse focusable nodes.
- Enter, Space, and completed primary clicks synthesize one `onPress`.
- `Button.keyHint` only displays a hint; shortcut behavior remains explicit in `useInput`.
- events bubble target-to-root and support `preventDefault()` and `stopPropagation()`.
- wheel, terminal mouse, arrows, Page Up/Down, Home, and End use shared scroll offsets when a scroll viewport is targeted.

## Theme

Components use semantic names (`fg`, `bg`, `panel`, `accent`, `success`, `warning`, `danger`, and others). Override concrete colors once:

```tsx
<ThemeProvider palette={{ bg: "#05070a", accent: "#22d3ee" }}>
  <App />
</ThemeProvider>
```

DOM and TUI consume the same palette. Concrete values must use `#RRGGBB` so both hosts interpret them identically.

## Static testing

```tsx
import { renderStatic } from "@faux-ui/ui/testing";

const app = renderStatic(<App />, { width: 80, height: 24 });
expect(app.getText()).toContain("Review");

app.keyDown({ key: "Tab" });
app.keyDown({ key: "Enter" });
expect(app.getEventTrace()).toContainEqual(
  expect.objectContaining({ type: "press" }),
);

app.unmount();
```

`@faux-ui/ui/testing` exposes read-only layout, canonical scene, row runs, text snapshots, event traces, and the pinned Unicode metadata.

## Unicode contract

The cellizer vendors generated Unicode 17.0.0 tables; it has no Unicode runtime dependency. It implements the Unicode extended grapheme boundary rules and terminal-oriented widths:

- combining clusters stay together;
- East Asian wide/fullwidth graphemes occupy two cells;
- ambiguous-width characters occupy one cell;
- emoji presentation/ZWJ sequences occupy two cells;
- width-2 graphemes reserve continuation cells;
- tabs use four-cell stops;
- unsupported controls render as `�`;
- leading zero-width clusters receive a dotted-circle base.

The full official Unicode 17 grapheme conformance fixture runs in the test suite.

## Repository

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run test:browser
bun run test:package
bun run build
```

Run everything:

```bash
bun run check
```

Examples:

```bash
bun run example:dom
bun run example:tui
```

Further documentation:

- [Documentation map and timeline](docs/README.md)
- [Specification](docs/spec.md)
- [Architecture](docs/architecture.md)
- [Strategy](docs/strategy.md)
- [Roadmap](docs/roadmap.md)
- [Testing and release gates](docs/testing.md)
- [Composition recipes](docs/recipes.md)
- [Changelog](CHANGELOG.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Implemented reset history](docs/refactors/2026-07-31-tui-first-reset/README.md)
- [Implemented public-language decision](docs/refactors/2026-08-01-api-language-review/README.md)
