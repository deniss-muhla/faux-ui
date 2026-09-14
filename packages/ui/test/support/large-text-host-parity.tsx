import type { CellScene } from "../../src/testing.js";
import {
  ScrollView,
  Text,
  appendTextSourceSegment,
  createTextSource,
  extendTextSourceSegment,
  replaceTextSourceSegment,
  type EventHandlers,
  type TextSource,
  type UiEvent,
} from "../../src/index.js";
import {
  generateBenchmarkLine,
  generateManyLineFixture,
} from "./large-text-benchmark-v1.js";

export const LARGE_TEXT_HOST_PARITY_SOURCE_SIZE = 667_633;
export const LARGE_TEXT_HOST_PARITY_SIZE = { width: 120, height: 30 } as const;
export const LARGE_TEXT_HOST_PARITY_RESIZED_SIZE = {
  width: 100,
  height: 24,
} as const;

export interface HostParityEvent {
  readonly type: string;
  readonly target: UiEvent["target"];
  readonly currentTarget: UiEvent["currentTarget"];
  readonly key?: string;
  readonly source?: string;
  readonly x?: number;
  readonly y?: number;
  readonly button?: number;
  readonly buttons?: number;
  readonly offset?: { readonly x: number; readonly y: number };
  readonly previousOffset?: { readonly x: number; readonly y: number };
  readonly deltaX?: number;
  readonly deltaY?: number;
}

export interface HostParityRecorder {
  readonly events: HostParityEvent[];
  readonly handlers: EventHandlers;
}

export interface CanonicalHostScene {
  readonly width: number;
  readonly height: number;
  readonly cells: CellScene["cells"];
}

export function canonicalHostScene(scene: {
  readonly width: number;
  readonly height: number;
  readonly cells: CellScene["cells"];
}): CanonicalHostScene {
  return {
    width: scene.width,
    height: scene.height,
    cells: [...scene.cells],
  };
}

interface EventFields {
  readonly key?: string;
  readonly source?: string;
  readonly x?: number;
  readonly y?: number;
  readonly button?: number;
  readonly buttons?: number;
  readonly offset?: { readonly x: number; readonly y: number };
  readonly previousOffset?: { readonly x: number; readonly y: number };
  readonly deltaX?: number;
  readonly deltaY?: number;
}

export function createHostParityRecorder(): HostParityRecorder {
  const events: HostParityEvent[] = [];
  const record = (event: UiEvent): void => {
    const fields = event as UiEvent & EventFields;
    const recorded: HostParityEvent = {
      type: event.type,
      target: { ...event.target },
      currentTarget: { ...event.currentTarget },
      ...(fields.key === undefined ? {} : { key: fields.key }),
      ...(fields.source === undefined ? {} : { source: fields.source }),
      ...(fields.x === undefined ? {} : { x: fields.x }),
      ...(fields.y === undefined ? {} : { y: fields.y }),
      ...(fields.button === undefined ? {} : { button: fields.button }),
      ...(fields.buttons === undefined ? {} : { buttons: fields.buttons }),
      ...(fields.offset === undefined ? {} : { offset: { ...fields.offset } }),
      ...(fields.previousOffset === undefined
        ? {}
        : { previousOffset: { ...fields.previousOffset } }),
      ...(fields.deltaX === undefined ? {} : { deltaX: fields.deltaX }),
      ...(fields.deltaY === undefined ? {} : { deltaY: fields.deltaY }),
    };
    events.push(recorded);
  };

  const handlers: EventHandlers = {
    onFocus: record,
    onBlur: record,
    onKeyDown: record,
    onKeyUp: record,
    onPress: record,
    onPointerDown: record,
    onPointerUp: record,
    onPointerMove: record,
    onPointerEnter: record,
    onPointerLeave: record,
    onScroll: record,
  };
  return { events, handlers };
}

export function createLargeTextHostParitySource(): TextSource {
  return createTextSource([
    {
      id: "history",
      text: generateManyLineFixture(LARGE_TEXT_HOST_PARITY_SOURCE_SIZE),
    },
  ]);
}

export function appendLargeTextHostParitySegment(
  source: TextSource,
): TextSource {
  return appendTextSourceSegment(source, {
    id: "tail",
    text: generateBenchmarkLine(100_000),
  });
}

export function extendLargeTextHostParitySegment(
  source: TextSource,
): TextSource {
  return extendTextSourceSegment(source, "tail", " + growth 古e\u0301👩‍💻🇺🇳");
}

export function replaceLargeTextHostParitySegment(
  source: TextSource,
): TextSource {
  return replaceTextSourceSegment(
    source,
    "tail",
    generateBenchmarkLine(200_000),
  );
}

export function createLargeTextHostParityView(
  source: TextSource,
  recorder: HostParityRecorder,
) {
  return (
    <ScrollView
      axis="both"
      followEnd="y"
      focusable
      accessibleLabel="Large text parity"
      style={{ background: "panel" }}
      focusStyle={{ background: "focus" }}
      {...recorder.handlers}
    >
      <Text
        source={source}
        style={{ foreground: "accent", bold: true, underline: true }}
        {...recorder.handlers}
      />
    </ScrollView>
  );
}
