import React from "react";

import {
  createDomTextMeasurer,
  mountDomRoot,
  type DomDispatchEvent,
  type DomElementLike,
  type DomMountOptions,
  type MountedDomRoot,
} from "@faux-ui/dom";
import { createReconciler, Text, View } from "@faux-ui/reconciler";
import { appendEventEntries, createEventEntries, type EventEntry } from "./log.js";

import "./styles.css";

type LaneId = "backlog" | "active" | "shipped";
type Priority = "calm" | "rush";
type ActionToken =
  | `lane:${LaneId}`
  | `task:${number}`
  | "task:advance"
  | "priority:toggle"
  | "spotlight:toggle";

interface LaneDefinition {
  id: LaneId;
  label: string;
  summary: string;
}

interface TaskDefinition {
  title: string;
  note: string;
}

interface AppState {
  selectedLane: LaneId;
  selectedTaskIndex: number;
  priority: Priority;
  spotlight: boolean;
  events: EventEntry[];
}

const lanes: LaneDefinition[] = [
  { id: "backlog", label: "Backlog", summary: "Shape next experiments" },
  { id: "active", label: "Active", summary: "Refine the current slice" },
  { id: "shipped", label: "Shipped", summary: "Review production wins" },
];

const tasksByLane: Record<LaneId, TaskDefinition[]> = {
  backlog: [
    { title: "Action router", note: "Keep tokens owned by the app layer." },
    { title: "Scroll story", note: "Verify render-phase offsets stay cheap." },
    { title: "Schema ingest", note: "Harden JSON authoring handoff." },
  ],
  active: [
    { title: "DOM runtime", note: "Mirror focus and hover state visibly." },
    { title: "TUI runtime", note: "Keep keyboard and pointer flow aligned." },
    { title: "CLI polish", note: "Expose inspection as a first-class path." },
  ],
  shipped: [
    { title: "Render tree", note: "Clip once and share it everywhere." },
    { title: "Layout cache", note: "Reuse work across stable constraints." },
    { title: "Visual lane", note: "Snapshot DOM output before semantics drift." },
  ],
};

const fallbackTask: TaskDefinition = {
  title: "No task selected",
  note: "Pick a lane to load an example task card.",
};

const initialState: AppState = {
  selectedLane: "active",
  selectedTaskIndex: 0,
  priority: "calm",
  spotlight: true,
  events: createEventEntries([
    "Studio ready. Click any lane or task card.",
    "Tab moves focus between faux-ui controls.",
  ]),
};

const canvas = document.createElement("canvas");
const canvasContext = canvas.getContext("2d");

if (canvasContext === null) {
  throw new Error("Expected a 2D canvas context for DOM text measurement.");
}

canvasContext.font = '15px "IBM Plex Sans", "Segoe UI", sans-serif';

const domTextMeasurer = createDomTextMeasurer({
  measureText({ text, wrap, maxWidth }) {
    const lineHeight = 20;

    if (!wrap || maxWidth === undefined || maxWidth <= 0) {
      return {
        width: Math.max(1, Math.ceil(canvasContext.measureText(text).width)),
        height: lineHeight,
      };
    }

    const segments = text.split(/(\s+)/).filter((segment) => segment.length > 0);
    const lines: string[] = [];
    let currentLine = "";

    for (const segment of segments) {
      const nextLine = `${currentLine}${segment}`;
      if (
        currentLine.length > 0 &&
        canvasContext.measureText(nextLine).width > maxWidth
      ) {
        lines.push(currentLine.trimEnd());
        currentLine = segment.trimStart();
        continue;
      }

      currentLine = nextLine;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.trimEnd());
    }

    const measuredWidth = lines.reduce((width, line) => {
      return Math.max(width, Math.ceil(canvasContext.measureText(line).width));
    }, 0);

    return {
      width: Math.min(maxWidth, Math.max(1, measuredWidth)),
      height: Math.max(1, lines.length) * lineHeight,
    };
  },
});

const host = requireElement<HTMLDivElement>("#surface");
const focusIndicator = requireElement<HTMLParagraphElement>("#focus-indicator");

const reconciler = createReconciler();
const fauxRoot = reconciler.createRoot();

let state: AppState = { ...initialState };
let mounted: MountedDomRoot<() => void> | null = null;

host.style.setProperty("--faux-ui-color-fg", "#182026");
host.style.setProperty("--faux-ui-color-muted", "#5d6b79");
host.style.setProperty("--faux-ui-color-accent", "#176b87");
host.style.setProperty("--faux-ui-color-success", "#146c43");
host.style.setProperty("--faux-ui-color-warning", "#ad6800");
host.style.setProperty("--faux-ui-color-danger", "#b42318");
host.style.setProperty("--faux-ui-color-bg", "#fffaf1");
host.style.setProperty("--faux-ui-color-bgAlt", "#f3e8d2");
host.style.setProperty("--faux-ui-color-border", "#d9c8a9");
host.style.setProperty("--faux-ui-color-focus", "#c8f0ff");
host.style.setProperty("--faux-ui-color-selection", "#d8efe0");
host.style.setProperty("--faux-ui-color-inverse", "#fffdf8");

const actionHandlers: Record<ActionToken, () => void> = {
  "lane:backlog": () => selectLane("backlog"),
  "lane:active": () => selectLane("active"),
  "lane:shipped": () => selectLane("shipped"),
  "task:0": () => selectTask(0),
  "task:1": () => selectTask(1),
  "task:2": () => selectTask(2),
  "task:advance": () => advanceTask(),
  "priority:toggle": () => togglePriority(),
  "spotlight:toggle": () => toggleSpotlight(),
};

renderApp();
window.addEventListener("resize", () => {
  if (mounted !== null) {
    mounted.update(undefined, { constraints: readConstraints() });
  }
});

function renderApp(): void {
  fauxRoot.render(<App state={state} />);
  const mountedNode = fauxRoot.getMountedNode();
  if (mountedNode === null) {
    throw new Error("Expected the DOM example root node to be mounted.");
  }

  if (mounted === null) {
    const mountOptions: DomMountOptions<() => void> = {
      container: host as unknown as DomElementLike,
      constraints: readConstraints(),
      measureText: domTextMeasurer.measure,
      resolveAction(token) {
        if (typeof token !== "string") {
          return undefined;
        }

        return actionHandlers[token as ActionToken];
      },
      onDispatch(event) {
        executeDispatch(event);
      },
      onFocusChange(event) {
        focusIndicator.textContent =
          event.nodeId === null ? "none" : `node ${String(event.nodeId)}`;
      },
    };

    mounted = mountDomRoot<() => void>(mountedNode, mountOptions);
    return;
  }

  mounted.update(mountedNode, { constraints: readConstraints() });
}

function executeDispatch(event: DomDispatchEvent<() => void>): void {
  for (const action of event.execution?.resolvedActions ?? []) {
    action.handler();
  }
}

function readConstraints(): { maxWidth: number; maxHeight: number } {
  const width = Math.max(720, Math.floor(host.clientWidth - 36));
  const height = Math.max(480, Math.floor(host.clientHeight - 36));
  return {
    maxWidth: width,
    maxHeight: height,
  };
}

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (element === null) {
    throw new Error(`Expected element ${selector} to exist.`);
  }

  return element;
}

function setState(updater: (current: AppState) => AppState): void {
  state = updater(state);
  renderApp();
}

function selectLane(laneId: LaneId): void {
  setState((current) => {
    const taskCount = tasksByLane[laneId].length;
    return {
      ...current,
      selectedLane: laneId,
      selectedTaskIndex: Math.min(current.selectedTaskIndex, taskCount - 1),
      events: appendEventEntries(
        current.events,
        `Lane changed to ${labelForLane(laneId)}.`,
        10,
      ),
    };
  });
}

function selectTask(index: number): void {
  setState((current) => {
    const task = visibleTasks(current)[index];
    if (task === undefined) {
      return current;
    }

    return {
      ...current,
      selectedTaskIndex: index,
      events: appendEventEntries(
        current.events,
        `Task focused: ${task.title}.`,
        10,
      ),
    };
  });
}

function advanceTask(): void {
  setState((current) => {
    const nextIndex = (current.selectedTaskIndex + 1) % visibleTasks(current).length;
    const task = visibleTasks({ ...current, selectedTaskIndex: nextIndex })[nextIndex];
    return {
      ...current,
      selectedTaskIndex: nextIndex,
      events: appendEventEntries(
        current.events,
        `Advanced to ${task?.title ?? "next task"}.`,
        10,
      ),
    };
  });
}

function togglePriority(): void {
  setState((current) => ({
    ...current,
    priority: current.priority === "calm" ? "rush" : "calm",
    events: appendEventEntries(
      current.events,
      `Priority mode is now ${current.priority === "calm" ? "rush" : "calm"}.`,
      10,
    ),
  }));
}

function toggleSpotlight(): void {
  setState((current) => ({
    ...current,
    spotlight: !current.spotlight,
    events: appendEventEntries(
      current.events,
      current.spotlight ? "Spotlight dimmed." : "Spotlight restored.",
      10,
    ),
  }));
}

function visibleTasks(current: AppState): TaskDefinition[] {
  return tasksByLane[current.selectedLane];
}

function labelForLane(laneId: LaneId): string {
  return lanes.find((lane) => lane.id === laneId)?.label ?? laneId;
}

function App(props: { state: AppState }): React.ReactNode {
  const lane =
    lanes.find((entry) => entry.id === props.state.selectedLane) ?? lanes[0]!;
  const tasks = visibleTasks(props.state);
  const currentTask = tasks[props.state.selectedTaskIndex] ?? tasks[0] ?? fallbackTask;
  const eventRows = [28, ...props.state.events.map(() => 24)] as Array<number | "1fr">;
  const detailRows = [38, 108, 38, ...tasks.map(() => 76), 76] as Array<
    number | "1fr"
  >;

  return (
    <View rows={[64, "1fr", 88]} style={{ background: "bg" }}>
      <View columns={["1fr", 180, 180]} style={{ background: "bgAlt" }}>
        <View rows={[26, 24]} style={{ background: "accent" }}>
          <Text style={{ color: "inverse" }}>DOM dispatch studio</Text>
          <Text style={{ color: "inverse" }}>{lane.summary}</Text>
        </View>
        <ActionButton
          label="Priority"
          value={props.state.priority === "calm" ? "Calm orbit" : "Rush orbit"}
          token="priority:toggle"
          active={props.state.priority === "rush"}
        />
        <ActionButton
          label="Spotlight"
          value={props.state.spotlight ? "Focused" : "Ambient"}
          token="spotlight:toggle"
          active={props.state.spotlight}
        />
      </View>

      <View columns={[220, "1fr", 260]} style={{ background: "bg" }}>
        <View
          rows={lanes.map(() => 80)}
          style={{ background: props.state.spotlight ? "selection" : "bgAlt" }}
        >
          {lanes.map((entry) => {
            const active = entry.id === props.state.selectedLane;
            return (
              <ActionButton
                key={entry.id}
                label={entry.label}
                value={entry.summary}
                token={`lane:${entry.id}`}
                active={active}
              />
            );
          })}
        </View>

        <View rows={detailRows} style={{ background: "bg" }}>
          <Text style={{ color: "muted" }}>Current focus</Text>
          <View rows={[34, 70]} style={{ background: props.state.spotlight ? "selection" : "bgAlt" }}>
            <Text style={{ color: "fg" }}>{currentTask.title}</Text>
            <Text wrap style={{ color: "muted" }}>
              {currentTask.note}
            </Text>
          </View>
          <Text style={{ color: "muted" }}>Task queue</Text>
          {tasks.map((task, index) => {
            return (
              <ActionButton
                key={task.title}
                label={task.title}
                value={task.note}
                token={`task:${index}`}
                active={index === props.state.selectedTaskIndex}
              />
            );
          })}
          <ActionButton
            label="Advance"
            value="Move to the next task card"
            token="task:advance"
            active={false}
          />
        </View>

        <View rows={eventRows} scroll="y" style={{ background: "bgAlt" }}>
          <Text style={{ color: "accent" }}>Dispatch log</Text>
          {props.state.events.map((entry) => (
            <View key={entry.id} style={{ background: "bg" }}>
              <Text wrap style={{ color: "muted" }}>
                {entry.message}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View columns={["1fr", 280]} style={{ background: "bgAlt" }}>
        <View rows={[28, 24]}>
          <Text style={{ color: "fg" }}>Application-owned handlers</Text>
          <Text style={{ color: "muted" }}>
            Tokens resolve in the app and then re-render the faux-ui tree.
          </Text>
        </View>
        <View rows={[28, 24]} style={{ background: "selection" }}>
          <Text style={{ color: "accent" }}>Keyboard flow</Text>
          <Text style={{ color: "muted" }}>Tab, Shift+Tab, Enter, and Space stay in sync.</Text>
        </View>
      </View>
    </View>
  );
}

function ActionButton(props: {
  label: string;
  value: string;
  token: ActionToken;
  active: boolean;
}): React.ReactNode {
  return (
    <View
      rows={[28, 48]}
      focusable
      onClick={props.token}
      onPress={props.token}
      style={{
        background: props.active ? "selection" : "bg",
        color: props.active ? "fg" : "muted",
      }}
      styleHover={{ background: "focus" }}
      styleFocus={{ background: "accent" }}
    >
      <Text style={{ color: props.active ? "accent" : "fg" }}>{props.label}</Text>
      <Text wrap style={{ color: "muted" }}>
        {props.value}
      </Text>
    </View>
  );
}