# Composition recipes

These patterns intentionally use the 1.0 foundation rather than adding specialized core components.

## App shell

```tsx
import { Box, Column, Text } from "@faux-ui/ui";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Column tracks={[3, "1fr", 2]}>
      <Box border="double" title=" Tool " padding={{ x: 1 }}>
        <Text overflow="ellipsis-end">Keyboard-first review tool</Text>
      </Box>
      <Box>{children}</Box>
      <Text style={{ foreground: "muted" }}>Tab focus · ? help</Text>
    </Column>
  );
}
```

The root size comes from the host. The shell only allocates within it.

## Panel/card

```tsx
export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box border="rounded" title={` ${title} `} padding={1}>
      {children}
    </Box>
  );
}
```

A no-axis `Box` accepts one semantic child. Wrap multiple panel rows in `Column`.

## Three-pane inspector

```tsx
<Row tracks={[28, "2fr", 30]} gap={1}>
  <Panel title="Queue"><Queue /></Panel>
  <Panel title="Details"><Details /></Panel>
  <Panel title="Metadata"><Metadata /></Panel>
</Row>
```

Use nested rows/columns rather than named tracks or two-dimensional placement.

## Scrollable selectable queue

```tsx
<ScrollView axis="y" border title=" Queue ">
  <Column tracks={items.map(() => 2)}>
    {items.map((item, index) => (
      <Button
        key={item.id}
        label={`${item.id} ${item.title}`}
        selected={index === selected}
        padding={{ x: 1 }}
        onPress={() => setSelected(index)}
      >
        <Column tracks={[1, 1]}>
          <Text overflow="ellipsis-end">{item.title}</Text>
          <Text style={{ foreground: "muted" }}>{item.owner}</Text>
        </Column>
      </Button>
    ))}
  </Column>
</ScrollView>
```

Give repeated entries explicit heights when secondary lines are required. Base `Text` never wraps.

## Compact action bar

```tsx
const actions = [
  ["a", "Approve"],
  ["r", "Reject"],
  ["c", "Comment"],
] as const;

<Row tracks={actions.map(() => "1fr")}>
  {actions.map(([key, label]) => (
    <Button
      key={key}
      label={label}
      hotkey={key}
      padding={0}
      onPress={() => runAction(key)}
    />
  ))}
</Row>
```

For global hotkeys, call the same action function from `useInput`; do not synthesize host events.

## Key-value metadata

```tsx
<Column tracks={rows.map(() => 1)} gap={1}>
  {rows.map(([label, value]) => (
    <Row key={label} tracks={[12, "1fr"]}>
      <Text style={{ foreground: "muted" }}>{label}</Text>
      <Text overflow="ellipsis-end">{value}</Text>
    </Row>
  ))}
</Column>
```

## Empty, loading, error, and success states

```tsx
function Status({ state }: { state: "empty" | "loading" | "error" | "ready" }) {
  if (state === "loading") {
    return <Text style={{ foreground: "accent" }}>Loading…</Text>;
  }
  if (state === "error") {
    return <Text style={{ foreground: "danger", bold: true }}>Failed to load</Text>;
  }
  if (state === "empty") {
    return <Text style={{ foreground: "muted" }}>No matching items</Text>;
  }
  return <Text style={{ foreground: "success" }}>✓ Ready</Text>;
}
```

Keep state in React; visual status is just semantic text/style.

## Root hotkeys

```tsx
useInput(
  useCallback((input) => {
    if (input.key === "j") {
      selectNext();
      return true;
    }
    if (input.key === "k") {
      selectPrevious();
      return true;
    }
    return false;
  }, [selectNext, selectPrevious]),
);
```

Returning `true` consumes the key before focused semantic dispatch. For focused-child bubbling instead, attach `onKeyDown` to a root `Box`, `Row`, or `Column`.

## Divider

Allocate one cell on the divider's cross axis; the component fills its actual frame:

```tsx
<Column tracks={["1fr", 1, "1fr"]}>
  <Top />
  <Divider variant="dashed" />
  <Bottom />
</Column>
```

No guessed 256/512-character fill string is involved.
