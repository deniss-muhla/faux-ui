---
name: faux-ui-grid
description: Build deterministic two-axis cell layouts with @faux-ui/grid. Use when a @faux-ui/ui React interface needs shared tracks, spans, or explicit row/column placement; prefer core Rows and Columns for sequential layouts.
license: MIT
compatibility: Requires a TypeScript React project using @faux-ui/ui and @faux-ui/grid.
---

# faux-ui Grid

Use `@faux-ui/grid` only for genuinely two-dimensional placement. Keep simpler screens on `Rows` and `Columns`.

## Import boundary

```tsx
import { Grid, GridItem } from "@faux-ui/grid";
import { ScrollView, Text } from "@faux-ui/ui";
```

Never import package internals. Browser and terminal mounting still come from `@faux-ui/ui/dom` and `@faux-ui/ui/tui`.

## Minimal pattern

Ordinary semantic children auto-place. Add `GridItem` only for placement, spans, or `Box` container props.

```tsx
<Grid columns={[12, "1fr", 10]} gap={{ x: 1 }}>
  <Text style={{ bold: true }}>Name</Text>
  <Text style={{ bold: true }}>Role</Text>
  <Text style={{ bold: true }} align={{ x: "end" }}>Status</Text>

  <Text>Ada</Text>
  <Text>Maintainer</Text>
  <Text align={{ x: "end" }}>Online</Text>

  <GridItem columnSpan={3}>
    <Text style={{ foreground: "muted" }}>1 person</Text>
  </GridItem>
</Grid>
```

## Rules

- Tracks are non-negative integer cells, `"auto"`, or positive fractions such as `"1fr"`.
- `row` and `column` are one-based.
- `rowSpan` and `columnSpan` are positive integers.
- `gap` is an integer or `{ x, y }`.
- Automatic placement is sparse row-major source order.
- Tracks created beyond `columns` or `rows` are implicitly `"auto"`.
- `GridItem` must be a direct child of `Grid`; fragments are allowed.
- `GridItem` accepts one semantic child. Use explicit `Text`, or group content with `Rows`/`Columns`/`Box`.
- Wrap Grid in `ScrollView` when scrolling is needed.

## Composition guidance

- Prefer `Rows`/`Columns` for sequential layout.
- Let `Text` own text alignment, overflow, and style.
- Let `Grid`/`GridItem` own only geometry and container behavior.
- Use direct React handlers and state; do not add runtime bridges or action registries.
- Test scenes through `@faux-ui/ui/testing`, then verify the DOM/TUI hosts as needed.
