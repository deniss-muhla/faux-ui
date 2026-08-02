# Findings

## Scope and method

This review inventories the unreleased public surface rather than preserving names for compatibility. Its audience assumption was refined during review: roughly 90% of users will already know React, TypeScript, and basic development vocabulary, often at student or early-career level. Names are evaluated with four tests:

1. **Fast recognition:** Can that user scan the JSX without learning a faux-ui synonym set?
2. **Expectation safety:** Does a familiar name claim behavior that is not present?
3. **Cross-host truth:** Is the name equally honest in a terminal and browser?
4. **Recall:** Is the name short, distinct, and easy to guess later?

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

Each family is individually recognizable. The vocabulary is mixed, but that is not automatically a defect: React developers already switch comfortably between component, geometry, style, and host terms. Local clarity matters more than making every name follow one dialect.

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

For the intended React/TypeScript user:

- `Text`, `Box`, `Row`, `Column`, `Button`, `style`, `padding`, `gap`, and `onPress` are immediately recognizable.
- `tracks`, `fr`, and `auto` are concise allocation terms; the TypeScript `Track` type makes their small grammar discoverable.
- `x` and `y` are simpler and more familiar than spelling out one global direction dialect.
- `hotkey="2"` is the clear failure: it appears to register the key, but currently only displays a hint.

Verdict: the component tree is already broadly readable for its actual audience. The review should correct false or dead interfaces, not optimize for a hypothetical reader with no development vocabulary.

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

The transferred expectations are real documentation risks, but narrow TypeScript unions and good examples constrain them. For this audience, replacing every familiar word can cost more than teaching the small supported subset. Rename only when a name is actively false, not merely because a larger platform uses it too.

## Direction and geometry are named inconsistently

The same idea currently appears through several vocabularies:

- `x` / `y` in edge spacing;
- `alignX` / `alignY` for alignment;
- `axis="x" | "y" | "both"` for scrolling;
- `orientation="horizontal" | "vertical"` for dividers;
- `Row` / `Column` for layout direction;
- `width` / `height` for root bounds;
- `tracks` for child sizes.

This is inconsistent in the abstract but clear in context. `{ x, y }` describes coordinates, `axis="y"` describes scrolling, and `orientation="horizontal"` describes a visible line. Forcing full direction words everywhere would make common source longer without improving recall.

## Concrete misleading or ineffective interfaces

### `hotkey` is a hint, not a hotkey

`Button.hotkey` only creates a visual label. The app must separately register behavior through `useInput`. The current name overpromises. Either the component must own registration or the prop must become `keyHint` / `shortcutHint`. The recommendation is `keyHint`; global routing stays explicit.

### `Box.alignX` and `Box.alignY` do nothing

The props are normalized into semantic nodes but the layout pass never consumes them. Only text alignment is painted. An unreleased contract should remove these props rather than rename or document inert behavior. Container placement can be designed later from an executable use case.

### Familiar bounded terms are acceptable

`style` contains only semantic paint fields, but React developers know that a library-specific `Style` type can be narrower than CSS. Likewise, `Fill`, palette abbreviations, `render` / `rerender` / `unmount`, `/dom`, and `/tui` are compact and recognizable in context. Their possible synonyms are not sufficiently better to justify a new dialect.

The modifier ordering of `styleFocus` and `styleHover` is the smaller readability problem. `focusStyle` and `hoverStyle` match familiar adjective/modifier-first naming without changing the concept.

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

A deterministic outer-space primitive was considered, but it creates more contract than the current evidence justifies. It must define preferred-size contribution, track ownership, background painting, pointer targeting, clipping, root behavior, and how adjacent spaces combine. The convenience is mainly avoiding occasional wrappers or explicit tracks.

For 1.0, keep only:

- `padding`: space inside a component boundary;
- `gap`: uniform space between sequential children.

Do not add `margin`, `spaceOutside`, or a generic `space` prop. Revisit only if repeated real applications demonstrate that composition is materially harmful.

## Overall finding

For the likely React/TypeScript user, the current API is mostly short and readable. A wholesale plain-English rename would trade familiar vocabulary for a larger faux-ui-specific language. The cleanest 1.0 change is deliberately small:

- retain the current component, track, style, geometry, host, and lifecycle names;
- retain `padding`, `gap`, and public `x` / `y` shorthand;
- rename display-only `hotkey` to `keyHint`;
- use `focusStyle` / `hoverStyle` word order;
- remove ineffective `Box.alignX` / `Box.alignY`;
- defer outer spacing until real-use evidence demands it.
