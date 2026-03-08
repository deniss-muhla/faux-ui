import process from "node:process";

import React from "react";

import {
  createTuiTextMeasurer,
  mountTerminalTuiHost,
  mountTuiRoot,
  type MountedTerminalTuiHost,
  type TuiDispatchEvent,
  type MountedTuiRoot,
} from "@faux-ui/tui";
import { createReconciler, Text, View } from "@faux-ui/reconciler";
import { appendEventEntries, createEventEntries, type EventEntry } from "./log.js";

type LaneId = "plan" | "build" | "review";
type ActionToken =
  | `lane:${LaneId}`
  | `task:${number}`
  | "task:advance"
  | "priority:toggle"
  | "spotlight:toggle";

interface AppState {
  selectedLane: LaneId;
  selectedTaskIndex: number;
  priority: "steady" | "hot";
  spotlight: boolean;
  events: EventEntry[];
}

interface TaskDefinition {
  title: string;
  note: string;
}

const lanes: Array<{ id: LaneId; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build" },
  { id: "review", label: "Review" },
];

const tasksByLane: Record<LaneId, TaskDefinition[]> = {
  plan: [
    { title: "Action map", note: "Keep token ownership in app code." },
    { title: "Input loop", note: "Share focus rules with the DOM runtime." },
    { title: "Viewport", note: "Render-phase scroll stays cheap." },
  ],
  build: [
    { title: "Example apps", note: "Exercise the runtime end to end." },
    { title: "CLI flow", note: "Make inspection easy to script." },
    { title: "Coverage", note: "Hold renderer behavior to one contract." },
  ],
  review: [
    { title: "Snapshot lane", note: "Static mode is useful in CI." },
    { title: "Focus ring", note: "Keyboard activation should stay visible." },
    { title: "Shared tokens", note: "DOM and TUI should read the same actions." },
  ],
};

const fallbackTask: TaskDefinition = {
  title: "No task",
  note: "Pick a lane to load work.",
};

const initialState: AppState = {
  selectedLane: "build",
  selectedTaskIndex: 0,
  priority: "steady",
  spotlight: true,
  events: createEventEntries([
    "TUI example ready.",
    "Use Tab to move focus and Enter to activate.",
  ]),
};

const reconciler = createReconciler();
const fauxRoot = reconciler.createRoot();
const textMeasurer = createTuiTextMeasurer();

let state: AppState = { ...initialState };
let terminalHost: MountedTerminalTuiHost<() => void> | null = null;
let staticRuntime: MountedTuiRoot<() => void> | null = null;

const actionHandlers: Record<ActionToken, () => void> = {
  "lane:plan": () => selectLane("plan"),
  "lane:build": () => selectLane("build"),
  "lane:review": () => selectLane("review"),
  "task:0": () => selectTask(0),
  "task:1": () => selectTask(1),
  "task:2": () => selectTask(2),
  "task:advance": () => advanceTask(),
  "priority:toggle": () => togglePriority(),
  "spotlight:toggle": () => toggleSpotlight(),
};

const options = parseArgs(process.argv.slice(2));
renderTree();

if (options.static) {
  const mountedNode = requireMountedNode();
  const mountedRuntime = mountTuiRoot<() => void>(mountedNode, {
    constraints: {
      maxWidth: options.width,
      maxHeight: options.height,
    },
    resolveAction(token) {
      if (typeof token !== "string") {
        return undefined;
      }

      return actionHandlers[token as ActionToken];
    },
  });
  staticRuntime = mountedRuntime;
  process.stdout.write(`${mountedRuntime.render().toString()}\n`);
  process.exit(0);
}

const mountedNode = requireMountedNode();
const mountedHost = mountTerminalTuiHost<() => void>(mountedNode, {
  resolveAction(token) {
    if (typeof token !== "string") {
      return undefined;
    }

    return actionHandlers[token as ActionToken];
  },
  onDispatch(event) {
    executeDispatch(event);
  },
});
terminalHost = mountedHost;
mountedHost.start();

function parseArgs(args: string[]): {
  static: boolean;
  width: number;
  height: number;
} {
  let staticMode = false;
  let width = 84;
  let height = 30;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--static") {
      staticMode = true;
      continue;
    }

    if (arg === "--width") {
      width = parseInteger(args[index + 1], arg);
      index += 1;
      continue;
    }

    if (arg === "--height") {
      height = parseInteger(args[index + 1], arg);
      index += 1;
      continue;
    }
  }

  return {
    static: staticMode,
    width,
    height,
  };
}

function parseInteger(value: string | undefined, flag: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer after ${flag}.`);
  }

  return parsed;
}

function executeDispatch(event: TuiDispatchEvent<() => void>): void {
  for (const action of event.execution?.resolvedActions ?? []) {
    action.handler();
  }
}

function renderTree(): void {
  fauxRoot.render(<App state={state} />);
  const mountedNode = requireMountedNode();

  if (terminalHost !== null) {
    terminalHost.update(mountedNode);
  }

  if (staticRuntime !== null) {
    staticRuntime.update(mountedNode);
  }
}

function requireMountedNode() {
  const mountedNode = fauxRoot.getMountedNode();
  if (mountedNode === null) {
    throw new Error("Expected the TUI example root node to be mounted.");
  }

  return mountedNode;
}

function setState(updater: (current: AppState) => AppState): void {
  state = updater(state);
  renderTree();
}

function selectLane(laneId: LaneId): void {
  setState((current) => ({
    ...current,
    selectedLane: laneId,
    selectedTaskIndex: Math.min(
      current.selectedTaskIndex,
      tasksByLane[laneId].length - 1,
    ),
    events: appendEventEntries(current.events, `Lane set to ${laneId}.`, 8),
  }));
}

function selectTask(index: number): void {
  setState((current) => {
    const task = tasksByLane[current.selectedLane][index];
    if (task === undefined) {
      return current;
    }

    return {
      ...current,
      selectedTaskIndex: index,
      events: appendEventEntries(
        current.events,
        `Task focused: ${task.title}.`,
        8,
      ),
    };
  });
}

function advanceTask(): void {
  setState((current) => {
    const taskCount = tasksByLane[current.selectedLane].length;
    const nextIndex = (current.selectedTaskIndex + 1) % taskCount;
    const task = tasksByLane[current.selectedLane][nextIndex];

    return {
      ...current,
      selectedTaskIndex: nextIndex,
      events: appendEventEntries(
        current.events,
        `Advanced to ${task?.title ?? "next"}.`,
        8,
      ),
    };
  });
}

function togglePriority(): void {
  setState((current) => ({
    ...current,
    priority: current.priority === "steady" ? "hot" : "steady",
    events: appendEventEntries(
      current.events,
      `Priority is ${current.priority === "steady" ? "hot" : "steady"}.`,
      8,
    ),
  }));
}

function toggleSpotlight(): void {
  setState((current) => ({
    ...current,
    spotlight: !current.spotlight,
    events: appendEventEntries(
      current.events,
      current.spotlight ? "Spotlight off." : "Spotlight on.",
      8,
    ),
  }));
}

function App(props: { state: AppState }): React.ReactNode {
  const tasks = tasksByLane[props.state.selectedLane];
  const activeTask = tasks[props.state.selectedTaskIndex] ?? tasks[0] ?? fallbackTask;
  const eventRows = [1, ...props.state.events.map(() => 1)];
  const detailRows = [2, 4, 2, ...tasks.map(() => 4), 2];

  return (
    <View rows={[3, 18, 9]} style={{ background: "bg" }}>
      <View columns={[28, 18, 18, 20]} style={{ background: "bgAlt" }}>
        <View rows={[1, 1]} style={{ background: "accent" }}>
          <Text style={{ color: "inverse" }}> faux-ui tui studio </Text>
          <Text style={{ color: "inverse" }}> tab focus, enter activate </Text>
        </View>
        <ActionCard
          label="priority"
          value={props.state.priority === "steady" ? "steady" : "hot"}
          token="priority:toggle"
          active={props.state.priority === "hot"}
        />
        <ActionCard
          label="spotlight"
          value={props.state.spotlight ? "on" : "off"}
          token="spotlight:toggle"
          active={props.state.spotlight}
        />
        <View rows={[1, 1]} style={{ background: "selection" }}>
          <Text style={{ color: "accent" }}> action contract </Text>
          <Text style={{ color: "muted" }}> app owns token handlers </Text>
        </View>
      </View>

      <View columns={[20, 36, 28]}>
        <View rows={[5, 5, 5]} style={{ background: props.state.spotlight ? "selection" : "bgAlt" }}>
          {lanes.map((lane) => (
            <ActionCard
              key={lane.id}
              label={lane.label}
              value={lane.id === props.state.selectedLane ? "selected" : "open"}
              token={`lane:${lane.id}`}
              active={lane.id === props.state.selectedLane}
            />
          ))}
        </View>

        <View rows={detailRows}>
          <Text style={{ color: "muted" }}> current lane </Text>
          <View rows={[1, 3]} style={{ background: props.state.spotlight ? "selection" : "bgAlt" }}>
            <Text style={{ color: "fg" }}> {activeTask.title} </Text>
            <Text wrap style={{ color: "muted" }}> {activeTask.note} </Text>
          </View>
          <Text style={{ color: "muted" }}> queue </Text>
          {tasks.map((task, index) => (
            <ActionCard
              key={task.title}
              label={task.title}
              value={task.note}
              token={`task:${index}`}
              active={index === props.state.selectedTaskIndex}
            />
          ))}
          <ActionCard
            label="advance"
            value="cycle next task"
            token="task:advance"
            active={false}
          />
        </View>

        <View rows={eventRows} style={{ background: "bgAlt" }}>
          <Text style={{ color: "accent" }}> log </Text>
          {props.state.events.map((eventLine) => (
            <View key={eventLine.id} style={{ background: "bg" }}>
              <Text wrap style={{ color: "muted" }}> {eventLine.message} </Text>
            </View>
          ))}
        </View>
      </View>

      <View columns={[28, 28, 28]} style={{ background: "bgAlt" }}>
        <View rows={[1, 1]}>
          <Text style={{ color: "fg" }}> keyboard </Text>
          <Text style={{ color: "muted" }}> Tab and Shift+Tab move focus. </Text>
        </View>
        <View rows={[1, 1]}>
          <Text style={{ color: "fg" }}> pointer </Text>
          <Text style={{ color: "muted" }}> Mouse clicks use the same tokens. </Text>
        </View>
        <View rows={[1, 1]}>
          <Text style={{ color: "fg" }}> snapshot </Text>
          <Text style={{ color: "muted" }}> Use --static for a CI-friendly render. </Text>
        </View>
      </View>
    </View>
  );
}

function ActionCard(props: {
  label: string;
  value: string;
  token: ActionToken;
  active: boolean;
}): React.ReactNode {
  return (
    <View
      rows={[1, 2]}
      focusable
      onClick={props.token}
      onPress={props.token}
      style={{ background: props.active ? "selection" : "bg" }}
      styleHover={{ background: "focus" }}
      styleFocus={{ background: "accent" }}
    >
      <Text style={{ color: props.active ? "accent" : "fg" }}> {props.label} </Text>
      <Text wrap style={{ color: "muted" }}> {props.value} </Text>
    </View>
  );
}