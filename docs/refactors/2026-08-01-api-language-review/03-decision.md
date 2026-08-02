# Decision

## Status

**Implemented in the unreleased 0.9.1 candidate.**

The selected API uses restrained React/TypeScript vocabulary plus plural one-axis layout names. No compatibility aliases or deprecated props were added because no package version has been published.

Version 0.9.1 is intentionally pre-1.0. It creates room to gather more real-use evidence before freezing a 1.0 contract.

## Audience and rule

The likely user is a React + TypeScript developer, often at student or early-career level.

Prefer the shortest familiar name that describes actual behavior:

1. keep established React/UI terms when their local meaning is clear;
2. do not invent a faux-ui synonym for every familiar concept;
3. fix names that claim behavior they do not provide;
4. remove props that do nothing;
5. add no layout concept without repeated real-use evidence.

## Layout component decision

Use:

- `Box` for a zero/one-child region;
- `Rows` when each source child occupies one row;
- `Columns` when each source child occupies one column.

This replaces the direction-oriented singular names:

| Removed | Selected | Meaning |
| --- | --- | --- |
| `Column` | `Rows` | Children are stacked as rows; tracks control heights. |
| `Row` | `Columns` | Children are placed as columns; tracks control widths. |

The plural component names describe what appears **inside** the container. A developer does not need to remember Flexbox's meaning of “column” or see the opposite component nearby to infer the direction.

```tsx
<Rows tracks={[3, "1fr", 3]}>
  <Header />  {/* 3 rows high */}
  <Main />    {/* remaining height */}
  <Footer />  {/* 3 rows high */}
</Rows>

<Columns tracks={[28, "2fr", 30]}>
  <Queue />    {/* 28 cells wide */}
  <Details />  {/* remaining width */}
  <Metadata /> {/* 30 cells wide */}
</Columns>
```

Keep one shared track grammar:

```ts
type Track = number | "auto" | `${number}fr`;
```

- A number is a fixed main-axis cell count.
- `Rows` numeric tracks are heights.
- `Columns` numeric tracks are widths.
- `auto` uses preferred content size.
- Fraction tracks divide positive remaining space.
- Content outside its allocated rectangle is clipped.

`widths` / `heights` sound like measured results rather than allocation rules. `share()` / `share(2)` is not simpler than `1fr` / `2fr`; it adds an import and call syntax while preserving the same learned abstraction.

## Why not merge every layout into `Box`

The semantic engine already uses one internal box node, so merging is technically easy. It is not selected for the public API because an all-`Box` tree is harder to scan, mutually exclusive row/column props enlarge the type, and auto-sized sequences need an extra axis marker.

`Rows` and `Columns` keep direction visible in the component name while still supporting the same border, padding, style, event, track, and gap behavior as the existing sequential boxes.

## Keep the remaining familiar language

Keep:

- `Text`, `Box`, `Fill`, `Divider`, `ScrollView`, `Button`;
- `ThemeProvider`, `useTheme`, `useInput`, `useFocusManager`;
- `tracks`, `Track`, `auto`, and fraction notation;
- `padding`, `gap`, `x`, `y`, `width`, and `height`;
- `style`, `Style`, `foreground`, `background`, `bold`, `dim`, and `inverse`;
- `border`, `title`, `overflow`, `tone`, `selected`, `disabled`, and `onPress`;
- `@faux-ui/ui/dom`, `@faux-ui/ui/tui`, and existing lifecycle names.

For the intended audience, these names are shorter and easier to recall than a complete custom vocabulary.

## Correctness-oriented changes

| Removed | Selected | Reason |
| --- | --- | --- |
| `Button.hotkey` | `Button.keyHint` | It displays text; it does not register a key handler. |
| `styleFocus` | `focusStyle` | Familiar modifier-first order. |
| `styleHover` | `hoverStyle` | Familiar modifier-first order. |
| `Box.alignX` | none | It had no effect. |
| `Box.alignY` | none | It had no effect. |

`Text.alignX` and `Text.alignY` remain because they work. `keyHint` remains display-only; applications register shortcuts through `useInput`.

## Spacing decision

Keep two separate concepts:

```tsx
<Box padding={{ x: 1, y: 3 }}>
  <Columns gap={2}>{children}</Columns>
</Box>
```

- `padding`: space inside a component boundary;
- `gap`: uniform space between sequential children.

Do not combine them into `space={{ x, y, gap }}`. Padding belongs to the container edge while gap belongs between children. A generic `space` name hides that distinction.

Do not add margin, `spaceOutside`, or another outer-spacing prop in 0.9.1. Reconsider only after repeated real applications show that wrappers or explicit tracks are materially harmful.

## Selected example

```tsx
import {
  Box,
  Button,
  Columns,
  Rows,
  ScrollView,
  Text,
  useFocusManager,
  useInput,
} from "@faux-ui/ui";

export function ReviewApp() {
  const focus = useFocusManager();

  useInput((key) => {
    if (key.key === "n") {
      focus.focusNext();
      return true;
    }
    return false;
  });

  return (
    <Rows tracks={[3, "1fr", 3]} style={{ background: "bg" }}>
      <Box border="double" title="Review" padding={{ x: 1 }}>
        <Columns tracks={["1fr", "auto"]} gap={1}>
          <Text overflow="ellipsis-end">Deterministic terminal cells</Text>
          <Text style={{ foreground: "success", bold: true }}>ONLINE</Text>
        </Columns>
      </Box>

      <Columns tracks={[28, "2fr", 30]} gap={1}>
        <Box border title="Queue">
          <ScrollView axis="y">{/* items */}</ScrollView>
        </Box>
        <Box border="rounded" title="Details" padding={1} />
        <Box border title="Metadata" padding={{ x: 1 }} />
      </Columns>

      <Columns tracks={["1fr", "1fr", "1fr"]}>
        <Button keyHint="1" onPress={open}>Open</Button>
        <Button keyHint="2" tone="primary" onPress={approve}>Approve</Button>
        <Button keyHint="3" tone="danger" onPress={reject}>Reject</Button>
      </Columns>
    </Rows>
  );
}
```

## Contract boundaries

Keeping familiar names does not authorize:

- arbitrary CSS properties or HTML intrinsic elements;
- general CSS Grid, percentages, spans, or named placement;
- margin, negative spacing, overlap, or absolute positioning;
- automatic key registration from `keyHint`;
- native browser layout or focus as semantic truth;
- compatibility aliases for removed names.

## Result

The 0.9.1 source, examples, types, tests, package fixture, specification, and current guides use `Rows` / `Columns`, `keyHint`, `focusStyle`, and `hoverStyle`. Singular `Row` / `Column`, ineffective `Box` alignment, and the misleading old props are absent from the public surface.
