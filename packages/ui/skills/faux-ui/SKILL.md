---
name: faux-ui
description: Build deterministic terminal-first React interfaces with @faux-ui/ui and share them across DOM and TUI hosts. Use when creating or reviewing faux-ui components, tracks, text, input, focus, themes, host entrypoints, or tests; use @faux-ui/grid only for true two-axis placement and spans.
license: MIT
compatibility: Requires a TypeScript React project using @faux-ui/ui.
---

# faux-ui

Build one semantic React application and project the same cell scene to browser and terminal hosts.

## Setup

```bash
bun add @faux-ui/ui react
```

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@faux-ui/ui"
  }
}
```

## Import boundaries

- Shared application code imports from `@faux-ui/ui` only.
- Browser entry code imports `render` from `@faux-ui/ui/dom`.
- Terminal entry code imports `render` from `@faux-ui/ui/tui`.
- Tests import `renderStatic` from `@faux-ui/ui/testing`.
- `@faux-ui/ui/layout` is an advanced component-author contract, not normal application layout.
- Never import internal files, host tags, semantic IDs, or reconcilers.

## Minimal application

```tsx
import { Button, Rows, Text } from "@faux-ui/ui";

export function App() {
  return (
    <Rows tracks={[1, 1]}>
      <Text align={{ x: "center" }}>Ready</Text>
      <Button label="Run" onPress={() => console.log("run")} />
    </Rows>
  );
}
```

Browser entry:

```tsx
import { render } from "@faux-ui/ui/dom";
import { App } from "./app.js";

const app = render(<App />, { ariaLabel: "Application" });
```

Terminal entry:

```tsx
import { render } from "@faux-ui/ui/tui";
import { App } from "./app.js";

const app = render(<App />);
```

Call `app.unmount()` during cleanup.

## Layout rules

- `Rows` gives each child one row; numeric tracks are heights.
- `Columns` gives each child one column; numeric tracks are widths.
- Tracks are non-negative integer cells, `"auto"`, or positive fractions such as `"1fr"`.
- Omitted tracks are `"auto"`; explicit track count must equal child count.
- `gap`, `padding`, and borders use integer cells.
- Use nested `Rows` and `Columns` for ordinary layouts.
- Use optional `@faux-ui/grid` only for shared two-axis tracks, numeric placement, or spans.

## Text and containers

- Put all raw text inside `Text`; HTML elements and raw strings outside `Text` are invalid.
- `Text` uses explicit lines and never auto-wraps.
- Use `align={{ x, y }}` with `"start"`, `"center"`, or `"end"`.
- Use `overflow="clip"`, `"ellipsis-start"`, `"ellipsis-middle"`, or `"ellipsis-end"`.
- A plain `Box` accepts at most one semantic child; group siblings with `Rows` or `Columns`.
- `ScrollView` accepts one semantic child and owns scrolling.
- Use `Fill` and `Divider` to paint an allocated frame.
- Never calculate display width with JavaScript `string.length`.

## Interaction and styling

- Keep React state and direct handlers ordinary.
- Use `Button.onPress` for activation; `keyHint` is display-only.
- Use `useInput` for explicit shortcuts and return `true` when an input is consumed.
- Use `useFocusManager` only for renderer-neutral focus movement or clearing.
- Use `style`, `focusStyle`, and `hoverStyle` with semantic colors.
- Use `ThemeProvider` or host palette options to map semantic colors to `#RRGGBB` values.
- Do not add action registries, manual rerenders, public node IDs, or host bridges.

## Test through the public scene

```tsx
import { Text } from "@faux-ui/ui";
import { renderStatic } from "@faux-ui/ui/testing";

const app = renderStatic(<Text>古a</Text>, { width: 3, height: 1 });
if (app.getText() !== "古a") throw new Error("Unexpected scene");
app.unmount();
```

Use `getText()`, `getScene()`, `getLayout()`, and event dispatch helpers instead of DOM structure or ANSI snapshots unless host projection itself is under test.

## Review checklist

- Shared code is host-independent.
- DOM code cannot reach Node/TUI imports.
- Layout is deterministic integer-cell geometry.
- Text clipping and Unicode width are left to faux-ui.
- Focus, pointer, key, press, hover, and scroll behavior use public handlers/hooks.
- Every mount is unmounted.
