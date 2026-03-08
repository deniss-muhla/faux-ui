import React from "react";

import { Text, View } from "@faux-ui/reconciler";

import { appendEventEntries, createEventEntries, type EventEntry } from "./log.js";

export type ExampleTarget = "dom" | "tui";
export type LaneId = "backlog" | "active" | "shipped";
export type Priority = "calm" | "rush";
export type ActionToken =
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

export interface AppState {
  selectedLane: LaneId;
  selectedTaskIndex: number;
  priority: Priority;
  spotlight: boolean;
  events: EventEntry[];
}

interface LayoutProfile {
  rootRows: Array<number | "1fr">;
  headerColumns: Array<number | "1fr">;
  mainColumns: Array<number | "1fr">;
  footerColumns: Array<number | "1fr">;
  laneRows: Array<number | "1fr">;
  detailLeadRows: Array<number | "1fr">;
  detailCardRows: Array<number | "1fr">;
  footerBlockRows: Array<number | "1fr">;
  actionCardRows: Array<number | "1fr">;
  logTitle: string;
  keyboardHint: string;
  pointerHint: string;
}

export const lanes: LaneDefinition[] = [
  { id: "backlog", label: "Backlog", summary: "Shape next experiments" },
  { id: "active", label: "Active", summary: "Refine the current slice" },
  { id: "shipped", label: "Shipped", summary: "Review production wins" },
];

export const tasksByLane: Record<LaneId, TaskDefinition[]> = {
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

const layoutProfiles: Record<ExampleTarget, LayoutProfile> = {
  dom: {
    rootRows: [76, "1fr", 92],
    headerColumns: ["1fr", 208, 208],
    mainColumns: [248, "1fr", 288],
    footerColumns: ["1fr", 288],
    laneRows: [96, 96, 96],
    detailLeadRows: [26, 40, 76],
    detailCardRows: [24, 28, 48],
    footerBlockRows: [28, 24],
    actionCardRows: [20, 24, 44],
    logTitle: "Dispatch log",
    keyboardHint: "Tab, Shift+Tab, Enter, and Space stay in sync.",
    pointerHint: "Mouse hover and click resolve the same app-owned tokens.",
  },
  tui: {
    rootRows: [5, "1fr", 5],
    headerColumns: [34, 24, 24],
    mainColumns: [28, "1fr", 30],
    footerColumns: ["1fr", 42],
    laneRows: [6, 6, 6],
    detailLeadRows: [1, 2, 4],
    detailCardRows: [1, 1, 2],
    footerBlockRows: [1, 1],
    actionCardRows: [1, 1, 2],
    logTitle: "Event log",
    keyboardHint: "Tab moves focus. Enter and Space activate the same card.",
    pointerHint: "Pointer dispatch follows the same token contract when available.",
  },
};

const maxEventEntries = 10;

export function createInitialState(): AppState {
  return {
    selectedLane: "active",
    selectedTaskIndex: 0,
    priority: "calm",
    spotlight: true,
    events: createEventEntries([
      "Shared example ready. DOM and TUI use the same action tokens.",
      "Look for INTERACTIVE cards. Hover and focus should stand out.",
    ]),
  };
}

export function reduceExampleAction(
  current: AppState,
  token: ActionToken,
): AppState {
  switch (token) {
    case "lane:backlog":
      return selectLane(current, "backlog");
    case "lane:active":
      return selectLane(current, "active");
    case "lane:shipped":
      return selectLane(current, "shipped");
    case "task:0":
      return selectTask(current, 0);
    case "task:1":
      return selectTask(current, 1);
    case "task:2":
      return selectTask(current, 2);
    case "task:advance":
      return advanceTask(current);
    case "priority:toggle":
      return togglePriority(current);
    case "spotlight:toggle":
      return toggleSpotlight(current);
    default:
      return current;
  }
}

export function ExampleApp(props: {
  state: AppState;
  target: ExampleTarget;
  focusedNodeLabel: string;
}): React.ReactNode {
  const layout = layoutProfiles[props.target];
  const lane =
    lanes.find((entry) => entry.id === props.state.selectedLane) ?? lanes[0] ?? null;
  const tasks = visibleTasks(props.state);
  const currentTask = tasks[props.state.selectedTaskIndex] ?? tasks[0] ?? fallbackTask;
  const logRows = [layout.detailLeadRows[0] ?? 1, ...props.state.events.map(() => layout.detailCardRows[2] ?? 2)];
  const detailRows = [
    ...layout.detailLeadRows,
    ...tasks.map(() => layout.detailCardRows[2] ?? 2),
    layout.detailCardRows[2] ?? 2,
  ];

  return (
    <View rows={layout.rootRows} style={{ background: "bg" }}>
      <View columns={layout.headerColumns} style={{ background: "bgAlt" }}>
        <View rows={layout.footerBlockRows} style={{ background: "accent" }}>
          <Text style={{ color: "inverse" }}>shared faux-ui studio</Text>
          <Text style={{ color: "inverse" }}>{lane?.summary ?? "Renderer-neutral example app"}</Text>
        </View>
        <ActionCard
          label="Priority"
          value={props.state.priority === "calm" ? "Calm orbit" : "Rush orbit"}
          token="priority:toggle"
          active={props.state.priority === "rush"}
          tone="toggle"
          rows={layout.actionCardRows}
        />
        <ActionCard
          label="Spotlight"
          value={props.state.spotlight ? "Focused" : "Ambient"}
          token="spotlight:toggle"
          active={props.state.spotlight}
          tone="toggle"
          rows={layout.actionCardRows}
        />
      </View>

      <View columns={layout.mainColumns} style={{ background: "bg" }}>
        <View rows={layout.laneRows} style={{ background: props.state.spotlight ? "selection" : "bgAlt" }}>
          {lanes.map((entry) => (
            <ActionCard
              key={entry.id}
              label={entry.label}
              value={entry.summary}
              token={`lane:${entry.id}`}
              active={entry.id === props.state.selectedLane}
              tone="lane"
              rows={layout.actionCardRows}
            />
          ))}
        </View>

        <View rows={detailRows} style={{ background: "bg" }}>
          <Text style={{ color: "muted" }}>Current focus</Text>
          <Text style={{ color: "warning" }}>INTERACTIVE cards are actionable.</Text>
          <View rows={layout.detailCardRows} style={{ background: props.state.spotlight ? "selection" : "bgAlt" }}>
            <Text style={{ color: "fg" }}>{currentTask.title}</Text>
            <Text style={{ color: "accent" }}>SELECTED TASK</Text>
            <Text wrap style={{ color: "muted" }}>{currentTask.note}</Text>
          </View>
          {tasks.map((task, index) => (
            <ActionCard
              key={task.title}
              label={task.title}
              value={task.note}
              token={`task:${index}`}
              active={index === props.state.selectedTaskIndex}
              tone="task"
              rows={layout.actionCardRows}
            />
          ))}
          <ActionCard
            label="Advance"
            value="Move to the next task card"
            token="task:advance"
            active={false}
            tone="task"
            rows={layout.actionCardRows}
          />
        </View>

        <View rows={logRows} scroll="y" style={{ background: "bgAlt" }}>
          <Text style={{ color: "accent" }}>{layout.logTitle}</Text>
          {props.state.events.map((entry) => (
            <View key={entry.id} rows={[layout.footerBlockRows[0] ?? 1, layout.footerBlockRows[1] ?? 1]} style={{ background: "bg" }}>
              <Text style={{ color: "warning" }}>EVENT</Text>
              <Text wrap style={{ color: "muted" }}>{entry.message}</Text>
            </View>
          ))}
        </View>
      </View>

      <View columns={layout.footerColumns} style={{ background: "bgAlt" }}>
        <View rows={[...layout.footerBlockRows, ...layout.footerBlockRows]}>
          <Text style={{ color: "fg" }}>Application-owned handlers</Text>
          <Text style={{ color: "muted" }}>
            DOM and TUI both resolve the same token set and then rerender the same app state.
          </Text>
          <Text style={{ color: "accent" }}>Focused node</Text>
          <Text style={{ color: "muted" }}>{props.focusedNodeLabel}</Text>
        </View>
        <View rows={[...layout.footerBlockRows, ...layout.footerBlockRows]} style={{ background: "selection" }}>
          <Text style={{ color: "accent" }}>Keyboard</Text>
          <Text style={{ color: "muted" }}>{layout.keyboardHint}</Text>
          <Text style={{ color: "accent" }}>Pointer</Text>
          <Text style={{ color: "muted" }}>{layout.pointerHint}</Text>
        </View>
      </View>
    </View>
  );
}

function selectLane(current: AppState, laneId: LaneId): AppState {
  const taskCount = tasksByLane[laneId].length;
  return {
    ...current,
    selectedLane: laneId,
    selectedTaskIndex: Math.min(current.selectedTaskIndex, taskCount - 1),
    events: appendEventEntries(
      current.events,
      `Lane changed to ${labelForLane(laneId)}.`,
      maxEventEntries,
    ),
  };
}

function selectTask(current: AppState, index: number): AppState {
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
      maxEventEntries,
    ),
  };
}

function advanceTask(current: AppState): AppState {
  const tasks = visibleTasks(current);
  const nextIndex = (current.selectedTaskIndex + 1) % tasks.length;
  const task = tasks[nextIndex];

  return {
    ...current,
    selectedTaskIndex: nextIndex,
    events: appendEventEntries(
      current.events,
      `Advanced to ${task?.title ?? "next task"}.`,
      maxEventEntries,
    ),
  };
}

function togglePriority(current: AppState): AppState {
  const nextPriority = current.priority === "calm" ? "rush" : "calm";
  return {
    ...current,
    priority: nextPriority,
    events: appendEventEntries(
      current.events,
      `Priority mode is now ${nextPriority}.`,
      maxEventEntries,
    ),
  };
}

function toggleSpotlight(current: AppState): AppState {
  const nextSpotlight = !current.spotlight;
  return {
    ...current,
    spotlight: nextSpotlight,
    events: appendEventEntries(
      current.events,
      nextSpotlight ? "Spotlight restored." : "Spotlight dimmed.",
      maxEventEntries,
    ),
  };
}

function visibleTasks(current: AppState): TaskDefinition[] {
  return tasksByLane[current.selectedLane];
}

function labelForLane(laneId: LaneId): string {
  return lanes.find((lane) => lane.id === laneId)?.label ?? laneId;
}

function ActionCard(props: {
  label: string;
  value: string;
  token: ActionToken;
  active: boolean;
  tone: "lane" | "task" | "toggle";
  rows: Array<number | "1fr">;
}): React.ReactNode {
  const metaLabel =
    props.tone === "toggle"
      ? "INTERACTIVE TOGGLE"
      : props.tone === "lane"
        ? "INTERACTIVE LANE"
        : "INTERACTIVE TASK";

  return (
    <View
      rows={props.rows}
      focusable
      onClick={props.token}
      onPress={props.token}
      style={{
        background: props.active ? "selection" : "bgAlt",
        color: props.active ? "fg" : "muted",
      }}
      styleHover={{ background: "focus", color: "fg" }}
      styleFocus={{ background: "accent", color: "inverse" }}
    >
      <Text style={{ color: props.active ? "accent" : "warning" }}>{metaLabel}</Text>
      <Text style={{ color: "fg" }}>{props.label}</Text>
      <Text wrap style={{ color: props.active ? "accent" : "muted" }}>{props.value}</Text>
    </View>
  );
}
