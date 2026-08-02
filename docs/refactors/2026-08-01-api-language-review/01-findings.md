# Findings

## Scope and method

This review inventories the unreleased public surface rather than preserving names for compatibility. It evaluates names with four tests:

1. **Plain reading:** Can someone without HTML/CSS knowledge infer the source?
2. **Expectation safety:** Does a familiar name imply unsupported behavior?
3. **Cross-host truth:** Is the name equally honest in a terminal and browser?
4. **Agent reliability:** Does the vocabulary reduce likely guessed props and workaround code?

Evidence comes from the current public exports, serious example, recipes, type tests, the completed reset dossier, and the read-only `g-calendar-cleanup` case study.

## Current vocabulary inventory

The current API mixes several dialects:

| Dialect | Current examples |
| --- | --- |
| Plain visual nouns | `Text`, `Row`, `Column`, `Button`, `Divider` |
| CSS/web layout | `Box`, `style`, `padding`, `gap`, `overflow`, `border`, `auto`, `fr` |
| React/browser lifecycle | `ScrollView`, `ThemeProvider`, `render`, `rerender`, `unmount`, `/dom` |
| Engine geometry | `tracks`, `axis`, `alignX`, `alignY`, `cellSize`, `scene` |
| Terminal vocabulary | `/tui`, `glyph`, `palette`, `hotkey` |

Each family is individually recognizable, but the combined language has no single rule. A developer must know which prior mental model applies to each prop.

## Plain-English reading test

A representative current fragment is:

```tsx
<Column tracks={[3, "1fr", 3]} style={{ background: "bg" }}>
  <Box border="double" title=" Review " padding={{ x: 1 }}>
    <Row tracks={["1fr", "auto"]} gap={1}>
      <Text overflow="ellipsis-end">Queue</Text>
      <Button hotkey="2" onPress={approve}>Approve</Button>
    </Row>
  </Box>
</Column>
```

Without library knowledge:

- `Text`, `Row`, `Column`, `Button`, `title`, and `Approve` read naturally.
- `tracks`, `fr`, `auto`, `x`, and `ellipsis-end` require a layout dialect.
- `Box`, `style`, `padding`, `gap`, `overflow`, and `border` look like a partial CSS model.
- `hotkey="2"` appears to register the key, but currently it only displays a hint.
- `onPress` is understandable, but the actual semantic operation is activation from keyboard or pointer, not only a physical press.

Verdict: the component tree is broadly readable, but the important layout and interaction details are not plain English and are easy to over-assume.

## HTML/CSS similarity: when familiarity becomes harmful

Familiar terminology is useful only when the expected neighboring behavior exists. A partial imitation creates **expectation debt**: developers confidently try APIs that look inevitable but do not exist.

| Current name | Likely transferred expectation | Actual contract |
| --- | --- | --- |
| `Box` + `style` | CSS box model and arbitrary style properties | Fixed semantic paint plus a small set of cell-layout props |
| `padding` | Companion `margin`, CSS shorthands, percentages | Non-negative integer cells; no margin today |
| `tracks` + `1fr` + `auto` | CSS Grid `repeat`, `minmax`, percentages, named lines, spans | Sequential one-axis fixed/content/share allocation only |
| `overflow` | `visible`, `hidden`, `scroll`, clipping on any element | Text clipping/ellipsis; scrolling is a separate semantic viewport |
| `border="rounded"` | Width, radius, side-specific borders, arbitrary color | One-cell terminal glyph frame with a small fixed kind set |
| `Button` | Native form submission, browser focus, HTML attributes | Renderer-neutral action with shared semantic focus |
| `hotkey` | Registered shortcut behavior | Display-only key hint |
| `/dom` | Semantic DOM nodes and native element behavior | One application surface projecting a canonical cell scene |
| `/tui` | Familiar only to terminal-library users | Terminal host adapter |

The lesson is not “never use familiar words.” `Text`, `Row`, `Column`, `label`, `disabled`, and `selected` are ordinary language and remain accurate. The problem is using a mature platform dialect where faux-ui intentionally omits most of that platform.

## Direction and geometry are named inconsistently

The same idea currently appears through several vocabularies:

- `x` / `y` in edge spacing;
- `alignX` / `alignY` for alignment;
- `axis="x" | "y" | "both"` for scrolling;
- `orientation="horizontal" | "vertical"` for dividers;
- `Row` / `Column` for layout direction;
- `width` / `height` for root bounds;
- `tracks` for child sizes.

A single public dialect should use full direction words. Coordinate shorthand can remain internal.

## Concrete misleading or ineffective interfaces

### `hotkey` is a hint, not a hotkey

`Button.hotkey` only creates a visual label. The app must separately register behavior through `useInput`. The current name overpromises. Either the component must own registration or the prop must become `keyHint` / `shortcutHint`. The recommendation is `keyHint`; global routing stays explicit.

### `Box.alignX` and `Box.alignY` do nothing

The props are normalized into semantic nodes but the layout pass never consumes them. Only text alignment is painted. An unreleased contract should remove these props rather than rename or document inert behavior. Container placement can be designed later from an executable use case.

### `style` is paint, not layout

The public `Style` type contains semantic foreground/background and text attributes only. Calling it `style` suggests that spacing, size, borders, or host CSS can appear there. A name such as `appearance` or terminal-native `paint` states the actual boundary.

### `Fill` is ambiguous

`Fill` means “repeat one grapheme through the allocated frame,” while `background` also means a visual fill. `Pattern` or terminal-native `Tile` communicates repeated content more clearly.

### `foreground`, palette `fg`, and `tone="primary"` disagree

The same color concept uses long property names, abbreviated palette roles, and a component tone that maps to `accent`. A clean break should choose one semantic-role vocabulary.

### Lifecycle names expose implementation history

`render` / `rerender` / `unmount`, `/dom`, and `/tui` are accurate to framework implementers but less direct for application authors than `start` / `update` / `stop`, `/browser`, and `/terminal`. This is lower priority than layout vocabulary but should be changed in the same clean break if the plain-language direction is selected.

## Names that already work

The review should not rename merely to appear new.

- `Text`, `Row`, and `Column` are plain, renderer-neutral, and spatially accurate.
- `label`, `disabled`, and `selected` state what they do.
- `focus`, `pointer`, `key`, `width`, and `height` are broad interface terms, not HTML-only language.
- `children` is ordinary React composition and not a faux-ui layout promise.

## Outside spacing: current gap and missing capability

The current foundation has:

- `padding`: space between a node boundary and its content;
- `gap`: uniform space inserted by a sequential parent between every pair of children;
- wrapper composition: an extra `Box` can simulate some one-off spacing.

It has no margin or equivalent outer-space primitive; margins are explicitly listed as a first-release non-goal.

That omission is defensible for CSS margins because faux-ui should not implement:

- margin collapse;
- negative margins or overlap;
- `auto` margins;
- percentages;
- browser flow negotiation.

But a much smaller deterministic capability is useful. One-sided or per-child outside space currently requires a wrapper, a dedicated fixed track, or literal blank content. Those workarounds add semantic nodes, change background/ownership, or obscure intent.

## Recommended deterministic spacing model

Use one plain family:

- `spaceInside`: cells between the component boundary and its content;
- `spaceOutside`: cells between its allocated slot and its painted/hit boundary;
- `spaceBetween`: cells a `Row` or `Column` inserts between adjacent child slots.

Conceptually:

```text
allocated child slot
└─ spaceOutside
   └─ painted component frame/background/outline
      └─ spaceInside
         └─ content
```

`spaceOutside` is deliberately **not CSS margin**:

1. Values are finite non-negative integer cells.
2. A number applies to all edges; an edge object uses `horizontal`, `vertical`, `top`, `right`, `bottom`, and `left`.
3. It never collapses with neighboring outside space.
4. It never accepts `auto`, percentages, or negative values.
5. A fixed/share allocation includes the outside cells; they reduce the component's painted frame.
6. Content-based preferred size includes outside cells.
7. Outside cells retain the parent's paint and hit ownership.
8. `spaceBetween` and adjacent outside edges are additive.
9. Root outside space reveals the root/default canvas; it does not resize the host.

This is small enough to preserve deterministic parent-to-child layout while removing common wrapper boilerplate.

## Overall finding

The current API is not “too HTML-like” everywhere. It is worse: it is selectively HTML/CSS-like, selectively terminal-like, and selectively engine-like. The cleanest authoring language should:

- retain already-plain component names;
- replace CSS terms where the corresponding CSS model is intentionally absent;
- make inside/outside/between spacing a complete deterministic family;
- use one direction vocabulary;
- distinguish visible hints from registered behavior;
- remove ineffective props rather than carrying them into 1.0;
- rename host/lifecycle surfaces only once, without aliases.
