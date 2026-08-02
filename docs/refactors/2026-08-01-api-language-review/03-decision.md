# Decision

## Status

**Select Variant A: plain spatial English. Implementation is pending.**

The current 1.0 candidate is unreleased and unmerged, so implementation will be a direct replacement. There will be no aliases such as `Box = Area`, no deprecated props, and no old `/dom` or `/tui` export paths.

## Decision principles

1. Keep a current name when it is already plain and accurate.
2. Rename a familiar platform term when faux-ui intentionally omits most behavior associated with it.
3. Name behavior, not implementation (`browser`, not `dom`; `keyHint`, not `hotkey`).
4. Use one full-word direction vocabulary publicly.
5. Make spacing a complete inside/outside/between family.
6. Remove ineffective props instead of carrying them through a rename.
7. Preserve terse internal names where they are not public; this decision concerns app-author language.

## Selected public vocabulary

### Components and hooks

| Current | Selected | Reason |
| --- | --- | --- |
| `Text` | `Text` | Already plain and exact |
| `Box` | `Area` | Neutral rectangular region without CSS box-model promise |
| `Row` | `Row` | Already plain and exact |
| `Column` | `Column` | Already plain and exact |
| `Fill` | `Pattern` | Repeats one character; avoids collision with background fill |
| `Divider` | `Separator` | Plain relationship rather than layout implementation |
| `ScrollView` | `ScrollArea` | States that one area can scroll without React Native/DOM view implications |
| `Button` | `Action` | Represents shared activation, not an HTML form control |
| `ThemeProvider` | `ColorTheme` | The current “theme” contains only a color palette |
| `useTheme` | `useColors` | Matches the actual data |
| `useInput` | `useKeys` | Avoids form-input interpretation |
| `useFocusManager` | `useFocusControls` | States that the hook returns imperative traversal controls |

`children`, React `key`, `label`, `disabled`, and `selected` remain unchanged. `FocusControls` exposes `next()`, `previous()`, and `clear()` instead of `focusNext()`, `focusPrevious()`, and `clearFocus()`.

### Layout and spacing

| Current | Selected |
| --- | --- |
| `tracks` on `Row` | `widths` |
| `tracks` on `Column` | `heights` |
| `Track` | `Length` |
| `"auto"` | `"content"` |
| `"1fr"`, `"2fr"`, … | `share()`, `share(2)`, … |
| `gap` | `spaceBetween` |
| `padding` | `spaceInside` |
| no equivalent | `spaceOutside` |
| `Insets` / `InsetsInput` | `EdgeSpace` / `EdgeSpaceInput` |
| edge `x` / `y` | `horizontal` / `vertical` |

Selected length contract:

```ts
interface ShareLength {
  readonly share: number;
}

type Length = number | "content" | ShareLength;

declare function share(weight?: number): ShareLength;
```

`share()` defaults to weight `1`; weights are finite and positive. This removes CSS Grid syntax and makes “share the remaining cells” explicit.

### Space semantics

`spaceInside`, `spaceOutside`, and `spaceBetween` accept non-negative integer cells.

```ts
type EdgeSpaceInput =
  | number
  | {
      horizontal?: number;
      vertical?: number;
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
```

Rules:

- `spaceInside` is available on region-like components and reduces their content frame after outline reservation.
- `spaceOutside` is available on every layoutable public component.
- A child track allocates an outer slot; `spaceOutside` insets the component's painted/layout frame within that slot.
- Content preferred size includes outside space.
- Outside cells retain parent paint and hit ownership.
- Neighboring outside spaces and parent `spaceBetween` add; nothing collapses.
- Negative, `auto`, percentage, and overlapping outside space are invalid.
- `spaceOutside` does not become a generic positioning system.

This deliberately solves the useful part of margin without adopting CSS margin semantics or the name `margin`.

### Appearance

| Current | Selected |
| --- | --- |
| `style` | `appearance` |
| `styleFocus` | `focusedAppearance` |
| `styleHover` | `hoveredAppearance` |
| `Style` | `Appearance` |
| `foreground` | `text` |
| `background` | `fill` |
| `bold` | `strong` |
| `dim` | `faint` |
| `inverse` | `reversed` |
| `SemanticColor` | `ColorRole` |
| `Palette` | `ColorPalette` |

Selected initial color-role renames:

| Current role | Selected role |
| --- | --- |
| `fg` | `text` |
| `muted` | `muted` |
| `inverse` | `contrastText` |
| `bg` | `canvas` |
| `panel` | `panel` |
| `selection` | `selection` |
| `focus` | `focus` |
| `accent` | `accent` |
| `success` | `success` |
| `warning` | `warning` |
| `danger` | `danger` |
| `border` | `outline` |

`ColorTheme` accepts `colors?: Partial<ColorPalette>`; `useColors()` returns the active palette.

### Component-specific props

| Current | Selected |
| --- | --- |
| `border` | `outline` |
| `title` | `caption` |
| `Border` / `BorderKind` | `Outline` / `OutlineKind` |
| `Text.overflow` | `Text.truncate` |
| `alignX` on `Text` | `align` |
| `alignY` on `Text` | `verticalAlign` |
| `alignX` / `alignY` on `Box` | remove; currently ineffective |
| `Fill.glyph` | `Pattern.character` |
| `Divider.orientation` | `Separator.direction` |
| `Divider.variant` | `Separator.pattern` |
| `ScrollView.axis` | `ScrollArea.direction` |
| `Button.tone` | `Action.intent` |
| `Button.hotkey` | `Action.keyHint` |
| `onPress` | `onActivate` |
| `accessibleLabel` | `accessibilityLabel` |

Public directions use only `horizontal`, `vertical`, and `both`. Internal `x`/`y` coordinates remain unchanged.

`keyHint` remains display-only. Applications register global keys through `useKeys`; the name must not imply hidden behavior.

### Events and geometry types

| Current | Selected |
| --- | --- |
| `PressUiEvent` | `ActivateEvent` |
| press source | activation source (`keyboard` or `pointer`) |
| `Size` | `CellSize` |
| `Point` | `CellPoint` |
| `Rect` | `CellRect` |
| `ScrollAxis` | `Direction` |
| `TextOverflow` | `Truncation` |
| `ButtonTone` | `ActionIntent` |

Low-level `onKeyDown`, `onKeyUp`, pointer event names, `preventDefault`, `stopPropagation`, and React `children` retain their conventional names. They describe actual event operations and do not imply browser-owned semantics.

The public event target kind changes from `"box" | "text"` to `"area" | "text"` so app-visible vocabulary does not leak the deleted component name.

### Host and lifecycle surfaces

| Current | Selected |
| --- | --- |
| `@faux-ui/ui/dom` | `@faux-ui/ui/browser` |
| `@faux-ui/ui/tui` | `@faux-ui/ui/terminal` |
| host `render()` | `start()` |
| `rerender()` | `update()` |
| `setSize()` | `resize()` |
| `getScene()` | `getScreen()` |
| `unmount()` | `stop()` |
| `DomRenderOptions` | `BrowserOptions` |
| `TuiRenderOptions` | `TerminalOptions` |
| `DomRenderHandle` | `BrowserApp` |
| `TuiRenderHandle` | `TerminalApp` |
| `renderStatic()` | `createTestApp()` |
| `StaticRenderHandle` | `TestApp` |

The terminal app may expose `pause()` / `resume()` for alternate-screen lifecycle; `start()` itself returns an already running app. `isRunning()` can remain.

Host option language should also become explicit during implementation:

- browser `container` → `mountInto`;
- browser `fit: "viewport"` → `fit: "window"`;
- `ariaLabel` → `accessibilityLabel`;
- terminal `alternateScreen` → `useAlternateScreen`;
- terminal `mouse` → `trackMouse`;
- terminal `exitOnCtrlC` → `quitOnCtrlC`.

The exact input/output stream property names can remain because `TerminalInput` and `TerminalOutput` are accurate structural interfaces.

## Selected example

```tsx
import {
  Action,
  Area,
  Column,
  Row,
  ScrollArea,
  Separator,
  Text,
  share,
  useFocusControls,
  useKeys,
} from "@faux-ui/ui";

export function ReviewApp() {
  const focus = useFocusControls();

  useKeys((key) => {
    if (key.key === "n") {
      focus.next();
      return true;
    }
    return false;
  });

  return (
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
        <Area outline="single" caption="Queue">
          <ScrollArea direction="vertical">{/* items */}</ScrollArea>
        </Area>
        <Area outline="rounded" caption="Details" spaceInside={1} />
        <Area outline="single" caption="Metadata" spaceInside={{ horizontal: 1 }} />
      </Row>

      <Row widths={[share(), share(), share()]}>
        <Action keyHint="1" onActivate={open}>Open</Action>
        <Action keyHint="2" intent="primary" onActivate={approve}>Approve</Action>
        <Action keyHint="3" intent="danger" onActivate={reject}>Reject</Action>
      </Row>
    </Column>
  );
}
```

The source contains no HTML element names, CSS Grid tokens, CSS box-model terms, renderer acronyms, or display-only prop that claims behavior.

## Deliberately unchanged product boundaries

The naming reset does not authorize:

- CSS properties or HTML intrinsic elements;
- general grid, spans, named placement, percentages, min/max negotiation, or wrapping by default;
- margin collapse, negative spacing, overlap, or absolute positioning;
- automatic key registration from `keyHint`;
- native browser focus as semantic truth;
- compatibility aliases.

## Implementation order

1. Add executable `spaceOutside` preferred/layout/scene/hit tests under internal names.
2. Replace public component/type names and remove ineffective container alignment props.
3. Replace `tracks`/`auto`/`fr` parsing with `widths`/`heights`/`content`/`share()`.
4. Replace appearance/color vocabulary and action activation names.
5. Rename browser/terminal entry files, package exports, lifecycle methods, and package-consumer fixtures.
6. Rewrite the serious example and recipes using only the selected vocabulary.
7. Update root specification, architecture, strategy examples, README, roadmap, type tests, and package README.
8. Run the complete release gate and search for every deleted public name outside this historical dossier.

## Acceptance criteria

- The selected example compiles and runs identically in browser and terminal hosts.
- One-sided outside spacing needs no wrapper and has explicit cross-host scene tests.
- Old component, prop, hook, type, host-path, and lifecycle names are not exported.
- `hotkey`, inert `Area` alignment, `fr`, `auto`, public `x`/`y` direction shorthands, `/dom`, and `/tui` are absent from current docs/examples/types.
- Historical dossiers remain readable and clearly marked as historical.
- Packed browser and terminal consumers pass from the renamed subpaths.
- No compatibility layer is introduced.
