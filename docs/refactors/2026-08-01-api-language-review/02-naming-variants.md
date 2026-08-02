# Three naming variants

All variants preserve the same terminal-first engine: integer cells, sequential one-axis allocation, semantic colors, explicit clipping, shared interaction, and no browser flow. They differ only in the public language and the expectations that language creates.

## Shared concepts being named

| Concept | Current name |
| --- | --- |
| Base rectangular region | `Box` |
| Horizontal / vertical sequence | `Row` / `Column` |
| Repeated grapheme | `Fill` |
| Separating line | `Divider` |
| Scroll viewport | `ScrollView` |
| Activatable control | `Button` |
| Child allocation | `tracks`, `Track`, `auto`, `Nfr` |
| Uniform sibling space | `gap` |
| Inner edge space | `padding` |
| Outer edge space | absent |
| Paint properties | `style`, `Style` |
| Framed edge / caption | `border`, `title` |
| Text shortening | `overflow="ellipsis-*"` |
| Displayed shortcut | `hotkey` |
| Activation | `onPress` |
| Hosts | `/dom`, `/tui`, `render`, `unmount` |

## Variant A — Plain spatial English

Goal: source should be understandable without knowing HTML, CSS Grid, terminal UI acronyms, or internal renderer terms.

### Vocabulary

| Concept | Variant A |
| --- | --- |
| Base region | `Area` |
| Sequences | `Row`, `Column` |
| Repeated grapheme | `Pattern` |
| Separating line | `Separator` |
| Scroll viewport | `ScrollArea` |
| Activatable control | `Action` |
| Color wrapper | `ColorTheme` |
| Allocation props | `Row.widths`, `Column.heights` |
| Allocation values | integer cells, `"content"`, `share(weight?)` |
| Sibling / inner / outer space | `spaceBetween`, `spaceInside`, `spaceOutside` |
| Edge object | `horizontal`, `vertical`, `top`, `right`, `bottom`, `left` |
| Frame / caption | `outline`, `caption` |
| Paint | `appearance`, `focusedAppearance`, `hoveredAppearance` |
| Paint fields | `text`, `fill`, `strong`, `faint`, `reversed`, `underline` |
| Text shortening | `truncate="start|middle|end|clip"` |
| Text placement | `align`, `verticalAlign` |
| Direction everywhere | `horizontal`, `vertical`, `both` |
| Repeated character | `character` |
| Separator line shape | `pattern="solid|dashed|dotted"` |
| Action meaning | `intent`, `keyHint`, `onActivate` |
| Accessibility label | `accessibilityLabel` |
| Hooks | `useKeys`, `useFocusControls`, `useColors` |
| Hosts | `/browser`, `/terminal`, `start()` |
| Lifecycle | `update`, `resize`, `getScreen`, `stop` |
| Static test entry | `createTestApp()` |

### Major type names

| Current | Variant A |
| --- | --- |
| `Track` | `Length` |
| `Insets` / `InsetsInput` | `EdgeSpace` / `EdgeSpaceInput` |
| `Style` | `Appearance` |
| `SemanticColor` | `ColorRole` |
| `Palette` | `ColorPalette` |
| `Border` / `BorderKind` | `Outline` / `OutlineKind` |
| `ScrollAxis` | `Direction` |
| `Size`, `Point`, `Rect` | `CellSize`, `CellPoint`, `CellRect` |
| `TextOverflow` | `Truncation` |
| `ButtonTone` | `ActionIntent` |
| `PressUiEvent` | `ActivateEvent` |

### Example

```tsx
import {
  Action,
  Area,
  Column,
  Row,
  Separator,
  Text,
  share,
} from "@faux-ui/ui";

<Column
  heights={[3, share(), 3]}
  appearance={{ fill: "canvas", text: "text" }}
>
  <Area
    outline="double"
    caption="faux-ui release review"
    spaceInside={{ horizontal: 1 }}
  >
    <Row widths={[share(), "content"]} spaceBetween={1}>
      <Text truncate="end">Deterministic terminal cells</Text>
      <Text appearance={{ text: "success", strong: true }}>ONLINE</Text>
    </Row>
  </Area>

  <Row widths={[28, share(2), 30]} spaceBetween={1}>
    <Area outline="single" caption="Queue" />
    <Area outline="rounded" caption="Details" spaceInside={1} />
    <Area outline="single" caption="Metadata" />
  </Row>

  <Row widths={[share(), share(), share()]}>
    <Action keyHint="1" onActivate={open}>Open</Action>
    <Action keyHint="2" intent="primary" onActivate={approve}>Approve</Action>
    <Action keyHint="3" intent="danger" onActivate={reject}>Reject</Action>
  </Row>
</Column>
```

### Strengths

- The spacing trio explains itself and does not import CSS margin behavior.
- `widths` and `heights` make the allocation axis obvious.
- `content` and `share()` describe behavior rather than copying CSS syntax.
- `Area` and `appearance` avoid implying an open-ended box/style model.
- `Action`, `keyHint`, and `onActivate` accurately span keyboard and pointer hosts.
- `/browser` and `/terminal` describe where the app runs rather than how the adapter is implemented.

### Weaknesses

- More verbose than the current API.
- `Area` and `Action` have fewer existing UI-library priors than `Box` and `Button`.
- `share()` adds one helper import.
- Renaming lifecycle and test surfaces increases the cutover size.

## Variant B — Terminal-native compact vocabulary

Goal: optimize for experienced terminal/tool UI authors and compact JSX, without pretending to implement CSS.

### Vocabulary

| Concept | Variant B |
| --- | --- |
| Base region | `Pane` |
| Sequences | `HStack`, `VStack` |
| Repeated grapheme | `Tile` |
| Separating line | `Rule` |
| Scroll viewport | `Viewport` |
| Activatable control | `Action` |
| Color wrapper | `PaletteProvider` |
| Allocation props | `columns`, `rows` |
| Allocation values | integer cells, `"fit"`, `weight(number?)` |
| Sibling / inner / outer space | `gutter`, `inset`, `outset` |
| Edge object | `x`, `y`, `top`, `right`, `bottom`, `left` |
| Frame / caption | `frame`, `caption` |
| Paint | `paint`, `focusPaint`, `hoverPaint` |
| Paint fields | `fg`, `bg`, `bold`, `dim`, `reverse`, `underline` |
| Text shortening | `clip="head|middle|tail|hard"` |
| Direction | `x`, `y`, `both` |
| Repeated character | `rune` |
| Action meaning | `tone`, `keyHint`, `onAction` |
| Hooks | `useKeys`, `useFocus` |
| Hosts | `/dom`, `/tui`, `render()` |
| Static test entry | `inspect()` |

### Example

```tsx
import {
  Action,
  HStack,
  Pane,
  Text,
  VStack,
  weight,
} from "@faux-ui/ui";

<VStack rows={[3, weight(), 3]} paint={{ bg: "bg", fg: "fg" }}>
  <Pane frame="double" caption="faux-ui release review" inset={{ x: 1 }}>
    <HStack columns={[weight(), "fit"]} gutter={1}>
      <Text clip="tail">Deterministic terminal cells</Text>
      <Text paint={{ fg: "success", bold: true }}>ONLINE</Text>
    </HStack>
  </Pane>

  <HStack columns={[28, weight(2), 30]} gutter={1}>
    <Pane frame="single" caption="Queue" />
    <Pane frame="rounded" caption="Details" inset={1} />
    <Pane frame="single" caption="Metadata" />
  </HStack>

  <Action keyHint="2" tone="primary" onAction={approve}>Approve</Action>
</VStack>
```

### Strengths

- Compact and internally consistent.
- `HStack` / `VStack`, `columns` / `rows`, `inset` / `outset`, and `fg` / `bg` fit terminal geometry.
- Does not resemble HTML/CSS enough to imply browser layout.
- Familiar to developers coming from terminal, SwiftUI, or stack-based UI libraries.

### Weaknesses

- Fails the strongest plain-English test: `HStack`, `rune`, `inset`, `outset`, `fg`, and `weight` are jargon.
- `Stack` sometimes means z-axis overlap in other systems.
- `Pane` may imply a visible border even when none exists.
- `/dom` and `/tui` remain implementation abbreviations.
- Less approachable for agents trained mainly on general React applications.

## Variant C — Explicit CSS-like subset

Goal: maximize transfer from React/CSS and accept that faux-ui is a deliberately restricted cell version of familiar layout vocabulary.

### Vocabulary

| Concept | Variant C |
| --- | --- |
| Components | Keep `Text`, `Box`, `Row`, `Column`, `Fill`, `Divider`, `ScrollView`, `Button`, `ThemeProvider` |
| Allocation | Keep `tracks`, `auto`, `Nfr` |
| Spacing | `gap`, `padding`, add `margin` |
| Frame / caption | `border`, `title` |
| Paint | `style`, `focusStyle`, `hoverStyle` |
| Text shortening | `overflow="ellipsis-*|clip"` |
| Direction | standardize on `horizontal`, `vertical`, `both` |
| Displayed shortcut | rename to `shortcutHint` |
| Activation | `onPress` |
| Hosts | keep `/dom`, `/tui`, `render`, `unmount` |

### Example

```tsx
<Column
  tracks={[3, "1fr", 3]}
  style={{ background: "bg", foreground: "fg" }}
>
  <Box
    border="double"
    title="faux-ui release review"
    padding={{ horizontal: 1 }}
  >
    <Row tracks={["1fr", "auto"]} gap={1}>
      <Text overflow="ellipsis-end">Deterministic terminal cells</Text>
      <Text style={{ foreground: "success", bold: true }}>ONLINE</Text>
    </Row>
  </Box>

  <Row tracks={[28, "2fr", 30]} gap={1}>
    <Box border title="Queue" />
    <Box border="rounded" title="Details" padding={1} />
    <Box border title="Metadata" />
  </Row>

  <Button shortcutHint="2" tone="primary" onPress={approve}>Approve</Button>
</Column>
```

### Strengths

- Smallest source/documentation migration.
- Highest immediate familiarity for web React developers and coding models.
- `padding`, `margin`, and `gap` form a familiar spacing family.
- Existing examples remain recognizable.

### Weaknesses

- The API still looks like incomplete CSS Grid and the CSS box model.
- Adding restricted `margin` increases expectations of collapse, `auto`, percentages, and negative values.
- `style`, `overflow`, `border`, `fr`, and `auto` invite many unsupported props/values.
- `/dom` encourages expectations of semantic/native DOM elements that faux-ui deliberately does not create.
- Documentation must repeatedly explain what familiar words do *not* mean.

Variant C is coherent only if faux-ui commits to steadily filling the expected CSS-shaped capability cluster. That conflicts with the small deterministic product boundary.

## Comparison

Scores are relative (`1` weak, `5` strong):

| Criterion | A: Plain spatial | B: Terminal-native | C: CSS-like subset |
| --- | ---: | ---: | ---: |
| Understandable without HTML/CSS | 5 | 3 | 3 |
| Avoids false platform expectations | 5 | 5 | 2 |
| Terminal precision | 4 | 5 | 3 |
| Compact source | 3 | 5 | 4 |
| General React/agent approachability | 5 | 3 | 5 initially, 2 when guessing missing CSS |
| Spacing-language completeness | 5 | 4 | 4 |
| Long-term fit with narrow product scope | 5 | 4 | 2 |

## Variant result

Variant A best satisfies the stated thought experiment and product boundary. Variant B is a credible fallback if compact TUI vocabulary becomes more important than broad readability. Variant C explains why retaining the current hybrid names is attractive, but it also preserves the exact expectation problem this review was opened to solve.
