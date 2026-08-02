# Decision

## Status

**Select Variant C: restrained React/TypeScript vocabulary. Implementation is pending.**

This revises the earlier plain-spatial recommendation after audience review. The likely user is a React + TypeScript developer, often at student or early-career level. Familiar names are therefore an advantage unless they are false or ineffective.

The 1.0 candidate is still unreleased and unmerged. The few selected changes will be direct replacements without aliases or deprecated props.

## Rule

Prefer the shortest familiar name that describes the actual behavior.

That means:

1. keep common React/UI terms when their local meaning is clear;
2. do not rename working concepts merely to create a unique faux-ui dialect;
3. fix names that claim behavior they do not provide;
4. remove public props that do nothing;
5. accept small local vocabulary differences when they read better than forced global consistency;
6. add no new layout concept without repeated real-use evidence.

## Keep the current foundation language

### Components and hooks

Keep:

- `Text`, `Box`, `Row`, `Column`;
- `Fill`, `Divider`, `ScrollView`, `Button`;
- `ThemeProvider`, `useTheme`;
- `useInput`, `useFocusManager`.

These names are short, recognizable to the target audience, and easy to distinguish in JSX. Renaming them to `Area`, `Pattern`, `Separator`, `ScrollArea`, `Action`, `ColorTheme`, `useKeys`, and `useFocusControls` adds vocabulary without making normal source easier to read.

### Layout

Keep:

```ts
type Track = number | "auto" | `${number}fr`;
```

Keep `tracks` on both `Row` and `Column`.

`widths` and `heights` sound like final measured dimensions, while tracks are allocation rules. One shared prop is also easier to remember when changing a `Row` into a `Column`.

`share()` / `share(2)` is not simpler than `1fr` / `2fr`: both require learning one allocation concept, while the helper adds an import and call syntax. Keep the compact fraction notation.

Keep:

- `padding` for space inside a box;
- `gap` for space between `Row` or `Column` children;
- `x` and `y` in points, scroll axes, and padding shorthand;
- `width` and `height` where actual dimensions are meant;
- `horizontal` and `vertical` for a divider's visible orientation.

The public API does not need one verbose direction dialect everywhere. For the intended audience, `{ x, y }`, `axis="y"`, and `orientation="horizontal"` are already familiar and locally clear.

### Visual and interaction language

Keep:

- `style`, `Style`, `foreground`, `background`, `bold`, `dim`, `inverse`;
- `border`, `title`, `overflow`, `alignX`, and `alignY` on `Text`;
- `tone`, `selected`, `disabled`, `onPress`;
- `accessibleLabel`;
- `Palette`, `SemanticColor`, `Point`, `Size`, and `Rect`.

These are conventional development terms. The narrow TypeScript types define the supported subset more effectively than a new synonym family would.

### Hosts and lifecycle

Keep:

- `@faux-ui/ui/dom` and `@faux-ui/ui/tui`;
- `render`, `rerender`, `setSize`, `getScene`, and `unmount`;
- `renderStatic` and `StaticRenderHandle`;
- current render-option and handle type names.

React developers know DOM, and TUI is the product's central term. `/browser`, `/terminal`, `start`, `update`, `getScreen`, and `stop` would be longer without being more precise.

## Make only correctness-oriented changes

| Current | Decision | Reason |
| --- | --- | --- |
| `Button.hotkey` | `Button.keyHint` | It displays text; it does not register a key handler. |
| `styleFocus` | `focusStyle` | Conventional modifier-first reading. |
| `styleHover` | `hoverStyle` | Conventional modifier-first reading. |
| `Box.alignX` | remove | It currently has no effect. |
| `Box.alignY` | remove | It currently has no effect. |

`Text.alignX` and `Text.alignY` remain because they work and match the short coordinate vocabulary.

`keyHint` remains display-only. An application registers shortcuts through `useInput` and can call the same action used by `onPress`.

No other public component, prop, type, hook, host path, or lifecycle rename is approved by this review.

## Spacing decision

Do **not** add margin, `spaceOutside`, or another outer-spacing prop for 1.0.

The foundation keeps two spacing concepts:

```tsx
<Box padding={{ x: 1 }}>
  <Row gap={1}>{children}</Row>
</Box>
```

- `padding`: space inside the component boundary;
- `gap`: uniform space between sequential children.

A generic `space` prop would not say whether the space is inside, outside, or between items. `padding` and `gap` are more recognizable to the target audience.

One-off outer spacing can use composition or explicit tracks. That is slightly more verbose, but it avoids adding rules for preferred size, background ownership, pointer targeting, clipping, root behavior, and adjacent-space combination. Reconsider outer spacing only after repeated real applications show that wrappers or tracks are a material problem.

## Selected example

```tsx
import {
  Box,
  Button,
  Column,
  Row,
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
    <Column
      tracks={[3, "1fr", 3]}
      style={{ background: "bg", foreground: "fg" }}
    >
      <Box border="double" title="faux-ui release review" padding={{ x: 1 }}>
        <Row tracks={["1fr", "auto"]} gap={1}>
          <Text overflow="ellipsis-end">Deterministic terminal cells</Text>
          <Text style={{ foreground: "success", bold: true }}>ONLINE</Text>
        </Row>
      </Box>

      <Row tracks={[28, "2fr", 30]} gap={1}>
        <Box border title="Queue">
          <ScrollView axis="y">{/* items */}</ScrollView>
        </Box>
        <Box border="rounded" title="Details" padding={1} />
        <Box border title="Metadata" padding={{ x: 1 }} />
      </Row>

      <Row tracks={["1fr", "1fr", "1fr"]}>
        <Button keyHint="1" onPress={open}>Open</Button>
        <Button keyHint="2" tone="primary" onPress={approve}>Approve</Button>
        <Button keyHint="3" tone="danger" onPress={reject}>Reject</Button>
      </Row>
    </Column>
  );
}
```

For the intended user, this is more readable than introducing a faux-ui-specific synonym for every familiar React/UI term.

## Familiarity does not expand the contract

Keeping familiar names does not authorize:

- arbitrary CSS properties or HTML intrinsic elements;
- general CSS Grid, percentages, spans, or named placement;
- margin, negative spacing, overlap, or absolute positioning;
- automatic key registration from `keyHint`;
- native browser layout or focus as semantic truth.

The package should teach these limits once in its overview and enforce them through narrow TypeScript types, runtime validation, and examples—not by renaming every concept.

## Implementation order

1. Rename `hotkey` to `keyHint`.
2. Rename `styleFocus` / `styleHover` to `focusStyle` / `hoverStyle`.
3. Remove ineffective `Box.alignX` / `Box.alignY` while retaining text alignment.
4. Update examples, recipes, current docs, type tests, and packed-consumer fixtures.
5. Search current source and docs for deleted public names; historical analysis may retain them.
6. Run the complete release gate.

## Acceptance criteria

- The selected example compiles and behaves identically in DOM and TUI hosts.
- `keyHint` is documented and tested as display-only.
- `Box` exposes no ineffective alignment props.
- `tracks`, `Track`, `auto`, fraction tracks, `padding`, `gap`, `x`/`y`, `/dom`, and `/tui` remain public.
- No outer-spacing feature or compatibility alias is introduced.
- All package, browser, terminal, and type gates pass.
