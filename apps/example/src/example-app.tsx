import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Column,
  Divider,
  Row,
  ScrollView,
  Text,
  useFocusManager,
  useInput,
} from "@faux-ui/ui";

const items = [
  { id: "RQ-1042", title: "Review Unicode width parity 👩‍💻", owner: "Mina", state: "warning" },
  { id: "RQ-1041", title: "Remove renderer bridge", owner: "Arun", state: "success" },
  { id: "RQ-1040", title: "Verify browser package isolation", owner: "Jo", state: "danger" },
  { id: "RQ-1039", title: "Document explicit root sizing", owner: "Mina", state: "success" },
  { id: "RQ-1038", title: "Exercise long clipped queue titles in narrow panes", owner: "Kai", state: "warning" },
  { id: "RQ-1037", title: "Check terminal cleanup", owner: "Arun", state: "success" },
  { id: "RQ-1036", title: "Inspect focus event trace", owner: "Jo", state: "warning" },
  { id: "RQ-1035", title: "Confirm packed install", owner: "Kai", state: "success" },
] as const;

const actions = [
  ["1", "Open"],
  ["2", "Approve"],
  ["3", "Reject"],
  ["4", "Assign"],
  ["5", "Label"],
  ["6", "Comment"],
  ["7", "Copy"],
  ["8", "Retry"],
  ["9", "Archive"],
  ["0", "Help"],
  ["q", "Quit"],
] as const;

export function ExampleApp() {
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("Ready");
  const focus = useFocusManager();
  const current = items[selected] ?? items[0];

  const runAction = useCallback(
    (_key: string, label: string) => {
      setMessage(`${label}: ${current.id}`);
    },
    [current.id],
  );

  useInput(
    useCallback(
      (input) => {
        if (input.key === "j" || input.key === "ArrowDown") {
          setSelected((value) => Math.min(items.length - 1, value + 1));
          return true;
        }
        if (input.key === "k" || input.key === "ArrowUp") {
          setSelected((value) => Math.max(0, value - 1));
          return true;
        }
        if (input.key === "n") {
          focus.focusNext();
          return true;
        }
        const action = actions.find(([key]) => key === input.key);
        if (action !== undefined) {
          runAction(action[0], action[1]);
          return true;
        }
        return false;
      },
      [focus, runAction],
    ),
  );

  return (
    <Column
      tracks={[3, "1fr", 3]}
      style={{ background: "bg", foreground: "fg" }}
      onKeyDown={(event) => {
        if (event.ctrl && event.key === "r") {
          setMessage("Refreshed queue");
          event.preventDefault();
        }
      }}
    >
      <Box border="double" title=" faux-ui release review " padding={{ x: 1 }}>
        <Row tracks={["1fr", "auto"]} gap={1}>
          <Text overflow="ellipsis-end">
            Deterministic terminal cells · DOM mirror · Unicode 17
          </Text>
          <Text style={{ foreground: "success", bold: true }}>ONLINE</Text>
        </Row>
      </Box>

      <Row tracks={[28, "2fr", 30]} gap={1}>
        <Box border title={` Queue (${items.length}) `}>
          <ScrollView axis="y">
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
                    <Text overflow="ellipsis-end">
                      {index === selected ? "› " : "  "}
                      {item.id} {item.title}
                    </Text>
                    <Text style={{ foreground: "muted" }} overflow="ellipsis-end">
                      {item.owner} · {item.state}
                    </Text>
                  </Column>
                </Button>
              ))}
            </Column>
          </ScrollView>
        </Box>

        <Box border="rounded" title={` ${current.id} `} padding={1}>
          <Column tracks={[2, 1, 1, "1fr", 1]} gap={1}>
            <Text style={{ foreground: "accent", bold: true }} overflow="ellipsis-end">
              {current.title}
            </Text>
            <Divider variant="dashed" />
            <Text style={{ foreground: "muted" }}>Release evidence</Text>
            <Text overflow="ellipsis-end">
              This synthetic fixture proves split panes, explicit tracks, borders,
              long text clipping, shared focus, global hotkeys, semantic tones,
              scrolling, combining text é, box drawing ─, CJK 古, and emoji 👩‍💻.
            </Text>
            <Text style={{ foreground: "success" }}>✓ parity checks enabled</Text>
          </Column>
        </Box>

        <Box border title=" Metadata " padding={{ x: 1 }}>
          <Column tracks={[1, 1, 1, 1, 1, "1fr"]} gap={1}>
            <Row tracks={[10, "1fr"]}>
              <Text style={{ foreground: "muted" }}>Owner</Text>
              <Text>{current.owner}</Text>
            </Row>
            <Row tracks={[10, "1fr"]}>
              <Text style={{ foreground: "muted" }}>State</Text>
              <Text>{current.state}</Text>
            </Row>
            <Row tracks={[10, "1fr"]}>
              <Text style={{ foreground: "muted" }}>Unicode</Text>
              <Text>17 · 古 é 👩‍💻</Text>
            </Row>
            <Row tracks={[10, "1fr"]}>
              <Text style={{ foreground: "muted" }}>Hosts</Text>
              <Text>DOM + TUI</Text>
            </Row>
            <Row tracks={[10, "1fr"]}>
              <Text style={{ foreground: "muted" }}>Keys</Text>
              <Text>j/k · n · 0-9</Text>
            </Row>
            <Box style={{ background: "panel" }} padding={1}>
              <Text overflow="ellipsis-middle">
                scene://release/{current.id}/canonical-cell-output
              </Text>
            </Box>
          </Column>
        </Box>
      </Row>

      <Column tracks={[1, 1, 1]}>
        <Row tracks={actions.map(() => "1fr")}>
          {actions.map(([key, label]) => (
            <Button
              key={key}
              label={label}
              hotkey={key}
              padding={{ x: 1 }}
              onPress={() => runAction(key, label)}
            />
          ))}
        </Row>
        <Divider />
        <Row tracks={["1fr", "auto"]} gap={1}>
          <Text style={{ foreground: "accent" }} overflow="ellipsis-end">
            {message}
          </Text>
          <Text style={{ foreground: "muted" }}>j/k select · Tab focus · Ctrl+R refresh</Text>
        </Row>
      </Column>
    </Column>
  );
}
