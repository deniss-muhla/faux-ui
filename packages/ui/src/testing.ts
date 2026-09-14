import type { ReactNode } from "react";

import type { DispatchResult, EventTraceEntry } from "./internal/controller.js";
import type { LayoutResult, PreferredNode } from "./internal/layout.js";
import { SemanticMount } from "./internal/mount.js";
import type {
  RenderStageDurations,
  RenderStageWorkCounts,
  RenderWorkCounts,
} from "./internal/render-work.js";
import type { TextIndexSnapshot } from "./internal/text-store.js";
import {
  inspectTextSourceValue,
  type TextSource,
  type TextSourceInspection,
} from "./internal/text-source.js";
import type {
  KeyInput,
  Point,
  PointerInput,
  ScrollInput,
  Size,
} from "./internal/model.js";
import {
  sceneRows,
  sceneToText,
  type CellScene,
  type SceneRow,
} from "./internal/scene.js";
import {
  CELL_WIDTH_IMPLEMENTATION,
  UNICODE_VERSION,
  cellizeLine,
  lineCellWidth,
  splitGraphemes,
} from "./internal/unicode.js";

export {
  CELL_WIDTH_IMPLEMENTATION,
  UNICODE_VERSION,
  cellizeLine,
  lineCellWidth,
  sceneRows,
  sceneToText,
  splitGraphemes,
};
export type {
  CellScene,
  EventTraceEntry,
  LayoutResult,
  PreferredNode,
  RenderStageDurations,
  RenderStageWorkCounts,
  RenderWorkCounts,
  SceneRow,
  TextIndexSnapshot,
  TextSourceInspection,
};

export function inspectTextSource(source: TextSource): TextSourceInspection {
  return inspectTextSourceValue(source);
}

export interface StaticRenderHandle {
  rerender(node: ReactNode): void;
  setSize(size: Size): void;
  repaint(): void;
  getWorkCounts(): RenderWorkCounts;
  getStageDurations(): RenderStageDurations;
  getStageWorkCounts(): RenderStageWorkCounts;
  clearWorkCounts(): void;
  getTextIndex(nodeId: number): TextIndexSnapshot | null;
  getTextIndexes(): readonly TextIndexSnapshot[];
  getLayout(): LayoutResult;
  getScene(): CellScene;
  getText(): string;
  getEventTrace(): readonly EventTraceEntry[];
  clearEventTrace(): void;
  keyDown(input: KeyInput): DispatchResult;
  keyUp(input: KeyInput): DispatchResult;
  pointerMove(input: PointerInput): DispatchResult;
  pointerDown(input: PointerInput): DispatchResult;
  pointerUp(input: PointerInput): DispatchResult;
  scroll(input: ScrollInput): DispatchResult;
  setScrollOffset(nodeId: number, offset: Point): boolean;
  unmount(): void;
}

export function renderStatic(node: ReactNode, size: Size): StaticRenderHandle {
  const mount = new SemanticMount({ size, measureWork: true });
  mount.render(node);
  return {
    rerender(next): void {
      mount.rerender(next);
    },
    setSize(next): void {
      mount.setSize(next);
    },
    repaint(): void {
      mount.repaint();
    },
    getWorkCounts(): RenderWorkCounts {
      return mount.workCounts();
    },
    getStageDurations(): RenderStageDurations {
      return mount.stageDurations();
    },
    getStageWorkCounts(): RenderStageWorkCounts {
      return mount.stageWorkCounts();
    },
    clearWorkCounts(): void {
      mount.clearWorkCounts();
    },
    getTextIndex(nodeId: number): TextIndexSnapshot | null {
      return mount.textIndex(nodeId);
    },
    getTextIndexes(): readonly TextIndexSnapshot[] {
      return mount.textIndexes();
    },
    getLayout(): LayoutResult {
      return mount.frame().layout;
    },
    getScene(): CellScene {
      return mount.frame().scene;
    },
    getText(): string {
      return sceneToText(mount.frame().scene);
    },
    getEventTrace(): readonly EventTraceEntry[] {
      return mount.controller().eventTrace();
    },
    clearEventTrace(): void {
      mount.controller().clearEventTrace();
    },
    keyDown(input): DispatchResult {
      return mount.keyDown(input);
    },
    keyUp(input): DispatchResult {
      return mount.keyUp(input);
    },
    pointerMove(input): DispatchResult {
      return mount.pointerMove(input);
    },
    pointerDown(input): DispatchResult {
      return mount.pointerDown(input);
    },
    pointerUp(input): DispatchResult {
      return mount.pointerUp(input);
    },
    scroll(input): DispatchResult {
      return mount.scroll(input);
    },
    setScrollOffset(nodeId, offset): boolean {
      return mount.setScrollOffset(nodeId, offset);
    },
    unmount(): void {
      mount.unmount();
    },
  };
}
