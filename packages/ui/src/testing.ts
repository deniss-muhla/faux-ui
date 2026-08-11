import type { ReactNode } from "react";

import type { DispatchResult, EventTraceEntry } from "./internal/controller.js";
import type { LayoutResult, PreferredNode } from "./internal/layout.js";
import { SemanticMount } from "./internal/mount.js";
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
export type { CellScene, EventTraceEntry, LayoutResult, PreferredNode, SceneRow };

export interface StaticRenderHandle {
  rerender(node: ReactNode): void;
  setSize(size: Size): void;
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

export function renderStatic(
  node: ReactNode,
  size: Size,
): StaticRenderHandle {
  const mount = new SemanticMount({ size });
  mount.render(node);
  return {
    rerender(next): void {
      mount.rerender(next);
    },
    setSize(next): void {
      mount.setSize(next);
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
