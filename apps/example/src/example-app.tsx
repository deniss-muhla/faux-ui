import { useReducer, type ReactNode } from "react";

import {
  appendEventEntries,
  createEventEntries,
  type EventEntry,
} from "./log.js";

export type LaneId = "backlog" | "active" | "shipped";
export type Priority = "calm" | "rush";
export type ExampleAction =
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
    {
      title: "Visual lane",
      note: "Snapshot DOM output before semantics drift.",
    },
  ],
};

const fallbackTask: TaskDefinition = {
  title: "No task selected",
  note: "Pick a lane to load an example task card.",
};

const layoutProfile: LayoutProfile = {
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
  pointerHint: "Pointer and keyboard events call app-owned handlers directly.",
};

const maxEventEntries = 10;

export function createInitialState(): AppState {
  return {
    selectedLane: "active",
    selectedTaskIndex: 0,
    priority: "calm",
    spotlight: true,
    events: createEventEntries([
      "Shared example ready. DOM and TUI call the same app-owned handlers.",
      "Look for INTERACTIVE cards. Hover and focus should stand out.",
    ]),
  };
}

export function reduceExampleAction(
  current: AppState,
  action: ExampleAction,
): AppState {
  switch (action) {
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

export function ExampleApp(): ReactNode {
  const [state, handleAction] = useReducer(
    reduceExampleAction,
    undefined,
    createInitialState,
  );
  const target = detectTarget();
  const layout = layoutProfile;
  const lane =
    lanes.find((entry) => entry.id === state.selectedLane) ?? lanes[0] ?? null;
  const tasks = visibleTasks(state);
  const currentTask =
    tasks[state.selectedTaskIndex] ?? tasks[0] ?? fallbackTask;
  const logRows = [
    layout.detailLeadRows[0] ?? 1,
    ...state.events.map(() => layout.detailCardRows[2] ?? 2),
  ];
  const detailRows = [
    ...layout.detailLeadRows,
    ...tasks.map(() => layout.detailCardRows[2] ?? 2),
    layout.detailCardRows[2] ?? 2,
  ];

  return (
    <view rows={layout.rootRows} style={{ background: "bg" }}>
      <view columns={layout.headerColumns} style={{ background: "bgAlt" }}>
        <view rows={layout.footerBlockRows} style={{ background: "accent" }}>
          <text style={{ color: "inverse" }}>shared faux-ui studio</text>
          <text style={{ color: "inverse" }}>
            {lane?.summary ?? "Renderer-neutral example app"}
          </text>
        </view>
        <ActionCard
          label="Priority"
          value={state.priority === "calm" ? "Calm orbit" : "Rush orbit"}
          action="priority:toggle"
          active={state.priority === "rush"}
          tone="toggle"
          rows={layout.actionCardRows}
          onAction={handleAction}
        />
        <ActionCard
          label="Spotlight"
          value={state.spotlight ? "Focused" : "Ambient"}
          action="spotlight:toggle"
          active={state.spotlight}
          tone="toggle"
          rows={layout.actionCardRows}
          onAction={handleAction}
        />
      </view>

      <view columns={layout.mainColumns} style={{ background: "bg" }}>
        <view
          rows={layout.laneRows}
          style={{ background: state.spotlight ? "selection" : "bgAlt" }}
        >
          {lanes.map((entry) => (
            <ActionCard
              key={entry.id}
              label={entry.label}
              value={entry.summary}
              action={`lane:${entry.id}`}
              active={entry.id === state.selectedLane}
              tone="lane"
              rows={layout.actionCardRows}
              onAction={handleAction}
            />
          ))}
        </view>

        <view rows={detailRows} style={{ background: "bg" }}>
          <text style={{ color: "muted" }}>Current focus</text>
          <text style={{ color: "warning" }}>
            INTERACTIVE cards are actionable.
          </text>
          <view
            rows={layout.detailCardRows}
            style={{ background: state.spotlight ? "selection" : "bgAlt" }}
          >
            <text style={{ color: "fg" }}>{currentTask.title}</text>
            <text style={{ color: "accent" }}>SELECTED TASK</text>
            <text style={{ color: "muted" }}>{currentTask.note}</text>
          </view>
          {tasks.map((task, index) => (
            <ActionCard
              key={task.title}
              label={task.title}
              value={task.note}
              action={`task:${index}`}
              active={index === state.selectedTaskIndex}
              tone="task"
              rows={layout.actionCardRows}
              onAction={handleAction}
            />
          ))}
          <ActionCard
            label="Advance"
            value="Move to the next task card"
            action="task:advance"
            active={false}
            tone="task"
            rows={layout.actionCardRows}
            onAction={handleAction}
          />
        </view>

        <view rows={logRows} scroll="y" style={{ background: "bgAlt" }}>
          <text style={{ color: "accent" }}>{layout.logTitle}</text>
          {state.events.map((entry) => (
            <view
              key={entry.id}
              rows={[
                layout.footerBlockRows[0] ?? 1,
                layout.footerBlockRows[1] ?? 1,
              ]}
              style={{ background: "bg" }}
            >
              <text style={{ color: "warning" }}>EVENT</text>
              <text style={{ color: "muted" }}>{entry.message}</text>
            </view>
          ))}
        </view>
      </view>

      <view columns={layout.footerColumns} style={{ background: "bgAlt" }}>
        <view rows={[...layout.footerBlockRows, ...layout.footerBlockRows]}>
          <text style={{ color: "fg" }}>Application-owned handlers</text>
          <text style={{ color: "muted" }}>
            DOM and TUI both call the same app-owned handlers and rerender the
            same app state.
          </text>
          <text style={{ color: "accent" }}>Target</text>
          <text style={{ color: "muted" }}>{target.toUpperCase()}</text>
        </view>
        <view
          rows={[...layout.footerBlockRows, ...layout.footerBlockRows]}
          style={{ background: "selection" }}
        >
          <text style={{ color: "accent" }}>Keyboard</text>
          <text style={{ color: "muted" }}>{layout.keyboardHint}</text>
          <text style={{ color: "accent" }}>Pointer</text>
          <text style={{ color: "muted" }}>{layout.pointerHint}</text>
        </view>
      </view>
    </view>
  );
}

function detectTarget(): "dom" | "tui" {
  return typeof globalThis === "object" && "document" in globalThis
    ? "dom"
    : "tui";
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
  action: ExampleAction;
  active: boolean;
  tone: "lane" | "task" | "toggle";
  rows: Array<number | "1fr">;
  onAction(action: ExampleAction): void;
}): ReactNode {
  const metaLabel =
    props.tone === "toggle"
      ? "INTERACTIVE TOGGLE"
      : props.tone === "lane"
        ? "INTERACTIVE LANE"
        : "INTERACTIVE TASK";

  return (
    <view
      rows={props.rows}
      focusable
      onClick={() => props.onAction(props.action)}
      onPress={() => props.onAction(props.action)}
      style={{
        background: props.active ? "selection" : "bgAlt",
        color: props.active ? "fg" : "muted",
      }}
      styleHover={{ background: "focus", color: "fg" }}
      styleFocus={{ background: "accent", color: "inverse" }}
    >
      <text style={{ color: props.active ? "accent" : "warning" }}>
        {metaLabel}
      </text>
      <text style={{ color: "fg" }}>{props.label}</text>
      <text style={{ color: props.active ? "accent" : "muted" }}>
        {props.value}
      </text>
    </view>
  );
}
