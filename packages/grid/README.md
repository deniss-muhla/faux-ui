# @faux-ui/grid

Deterministic CSS-grid-like cell layout for [`@faux-ui/ui`](https://github.com/deniss-muhla/faux-ui).

Use it when `Rows` and `Columns` are not enough because children need shared two-axis tracks, explicit placement, or spans. For ordinary sequential layouts, keep using `Rows` and `Columns`.

## Install

```bash
bun add @faux-ui/grid @faux-ui/ui react
```

`@faux-ui/ui` and React are peer dependencies. This package has no runtime dependencies and imports only public `@faux-ui/ui` entrypoints.

## Basic use

Ordinary semantic children auto-place. Use `GridItem` only when an item needs placement, a span, or container props.

```tsx
import { Grid, GridItem } from "@faux-ui/grid";
import { Text } from "@faux-ui/ui";

<Grid columns={[12, "1fr", 10]} gap={{ x: 1 }}>
  <Text style={{ bold: true }}>Name</Text>
  <Text style={{ bold: true }}>Role</Text>
  <Text style={{ bold: true }} align={{ x: "end" }}>
    Status
  </Text>

  <Text>Ada</Text>
  <Text>Maintainer</Text>
  <Text align={{ x: "end" }}>Online</Text>

  <Text>Lin</Text>
  <Text>Reviewer</Text>
  <Text align={{ x: "end" }}>Away</Text>

  <GridItem columnSpan={3}>
    <Text style={{ foreground: "muted" }}>3 people</Text>
  </GridItem>
</Grid>;
```

Omit `rows` for normal content-sized table rows: each implicit row is `"auto"`, so a one-line `Text` uses one cell.

Tracks use the same grammar as faux-ui:

- a non-negative integer: fixed cells;
- `"auto"`: preferred child size;
- `"Nfr"`: a positive share of remaining cells.

```tsx
import { repeat } from "@faux-ui/grid";

const columns = [18, ...repeat(3, "1fr"), 10];
```

## Placement and spans

`row` and `column` are one-based. Spans are positive integers.

```tsx
<Grid columns={[18, "1fr", 24]} rows={[3, "1fr", 2]} gap={1}>
  <GridItem row={1} column={1} columnSpan={3} border>
    <Text>Header</Text>
  </GridItem>
  <GridItem row={2} column={1} rowSpan={2} border>
    <Text>Navigation</Text>
  </GridItem>
  <GridItem row={2} column={2} border>
    <Text>Main</Text>
  </GridItem>
  <GridItem row={2} column={3} border>
    <Text>Inspector</Text>
  </GridItem>
  <GridItem row={3} column={2} columnSpan={2} border>
    <Text>Status</Text>
  </GridItem>
</Grid>
```

Explicit items may overlap. Later source items paint later and receive pointer targeting first.

## Automatic placement

Unpositioned children fill columns from left to right, then continue on the next row in source order. Placement is sparse: spans may leave holes, but later children are never reordered to backfill them. Use numeric `row` / `column` when a child needs a different position.

Rows or columns created beyond the explicit track lists are always `"auto"`.

## Composition

`GridItem` is only a placement-aware `Box` container. Text behavior belongs to `Text`; scrolling belongs to `ScrollView`.

```tsx
import { ScrollView, Text } from "@faux-ui/ui";

<ScrollView axis="y">
  <Grid columns={[16, "1fr", 10]}>
    <Text>...</Text>
  </Grid>
</ScrollView>;
```

Use ordinary `Box` props on `Grid` or `GridItem` for border, padding, style, focus, and direct handlers. A `GridItem` accepts one semantic child and must be a direct Grid child; use `Text` for text and `Rows`/`Columns`/`Box` to group content. Grid fragments are flattened, but wrapper components around `GridItem` are not placement syntax.

## API

### `Grid`

- `columns` defines required explicit tracks.
- `rows` defines optional explicit tracks.
- `gap` defines integer or `{ x, y }` cell gaps.
- ordinary `Box` props.

### `GridItem`

- `row` and `column` define one-based placement.
- `rowSpan` and `columnSpan` define positive spans.
- ordinary `Box` props.

### `repeat(count, pattern)`

Returns a flat validated track array. `pattern` is one track or an array of tracks.

## Agent Skill

The tarball contains one standards-compatible skill at `skills/faux-ui-grid/SKILL.md` plus thin discovery metadata for multiple hosts:

- Pi: `package.json#pi.skills`;
- Codex/ChatGPT: `.codex-plugin/plugin.json`;
- Claude Code: `.claude-plugin/plugin.json`.

Installing the npm dependency does not automatically enable it in Codex or Claude. Enable the corresponding plugin, or link the canonical skill into `.agents/skills/faux-ui-grid` or `.claude/skills/faux-ui-grid`. See [Cross-agent Skill packaging](https://github.com/deniss-muhla/faux-ui/blob/main/docs/agent-skill-packaging.md) for installation choices, package structure, security, validation, and official references.

## Deterministic behavior

- Geometry uses integer cells in DOM and TUI hosts.
- Preferred text width uses faux-ui's pinned Unicode tables.
- Base text does not auto-wrap.
- Gaps consume cells before fraction tracks are distributed.
- Spans include intervening gaps.
- Painting, clipping, events, and scrolling remain owned by `@faux-ui/ui`.
- Invalid tracks, lines, spans, and runaway implicit grids fail early.

The package ships compiled output, declarations, source, license, changelog, README, plugin manifests, and the `faux-ui-grid` Agent Skill.

MIT licensed.
