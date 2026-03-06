import {
  buildRenderTree,
  collectDispatchActions,
  dispatchBindingAtPoint,
  resolveDispatchResult,
  type BindingHandlerResolver,
  type BindingName,
  type DispatchExecution,
  type DispatchResult,
  type NodeId,
  type RenderHit,
  type RenderTree,
  type RenderTreeNode,
  type ScrollOffset,
  type TextLayoutRequest,
  type UINode,
} from "@faux-ui/core";

import { renderToFrameBuffer, type RenderOptions } from "./render.js";
import { createTuiTextMeasurer } from "./text-measurer.js";
import type { TuiPoint } from "./events.js";
import type { FrameBuffer } from "./frame-buffer.js";

export interface TuiKeyboardEventLike {
  key: string;
}

export interface TuiScrollDelta {
  x: number;
  y: number;
}

export type TuiRuntimeEvent =
  | {
      type: "click" | "pointerDown" | "pointerMove" | "pointerUp";
      point: TuiPoint;
      nativeEvent?: unknown;
    }
  | {
      type: "focusAtPoint";
      point: TuiPoint;
      nativeEvent?: unknown;
    }
  | {
      type: "focusNext" | "focusPrevious";
      nativeEvent?: unknown;
    }
  | {
      type: "focusNode";
      nodeId: number | null;
      nativeEvent?: unknown;
    }
  | {
      type: "keyDown" | "keyUp";
      key: string;
      nativeEvent?: unknown;
    }
  | {
      type: "scroll";
      point: TuiPoint;
      delta: TuiScrollDelta;
      nativeEvent?: unknown;
    };

export interface TuiDispatchEvent<THandler = unknown> {
  binding: BindingName;
  result: DispatchResult;
  execution: DispatchExecution<THandler> | null;
  nativeEvent: unknown;
}

export interface TuiFocusChangeEvent {
  previousNodeId: number | null;
  nodeId: number | null;
}

export interface TuiRuntimeOptions<THandler = unknown> extends RenderOptions {
  resolveAction?: BindingHandlerResolver<THandler>;
  onDispatch?: (event: TuiDispatchEvent<THandler>) => void;
  onFocusChange?: (event: TuiFocusChangeEvent) => void;
}

export interface MountedTuiRoot<THandler = unknown> {
  update(root?: UINode, options?: Partial<TuiRuntimeOptions<THandler>>): void;
  render(): FrameBuffer;
  rerender(): FrameBuffer;
  dispatchAtPoint(
    binding: BindingName,
    point: TuiPoint,
    nativeEvent?: unknown,
  ): DispatchResult;
  dispatchKeyDown(key: string, nativeEvent?: unknown): DispatchResult[];
  dispatchKeyUp(key: string, nativeEvent?: unknown): DispatchResult;
  scrollAtPoint(
    point: TuiPoint,
    delta: TuiScrollDelta,
    nativeEvent?: unknown,
  ): DispatchResult;
  focusAtPoint(point: TuiPoint, nativeEvent?: unknown): number | null;
  focusNext(nativeEvent?: unknown): number | null;
  focusPrevious(nativeEvent?: unknown): number | null;
  focusNode(nodeId: number | null, nativeEvent?: unknown): void;
  getFocusedNodeId(): number | null;
  setScrollOffset(nodeId: number, offset: ScrollOffset): void;
  getScrollOffset(nodeId: number): ScrollOffset | undefined;
  dispatchEvent(event: TuiRuntimeEvent): void;
}

export function mountTuiRoot(
  root: UINode,
  options: TuiRuntimeOptions,
): MountedTuiRoot;
export function mountTuiRoot<THandler>(
  root: UINode,
  options: TuiRuntimeOptions<THandler>,
): MountedTuiRoot<THandler>;
export function mountTuiRoot<THandler>(
  root: UINode,
  options: TuiRuntimeOptions<THandler>,
): MountedTuiRoot<THandler> {
  let currentRoot = root;
  let currentOptions = cloneRuntimeOptions(options);
  let currentScrollOffsets = cloneScrollOffsets(options.scrollOffsets);
  let focusedNodeId: number | null = null;
  let focusableNodeIds = collectFocusableNodeIds(currentRoot);

  return {
    update(nextRoot, nextOptions) {
      if (nextRoot !== undefined) {
        currentRoot = nextRoot;
      }

      if (nextOptions !== undefined) {
        currentOptions = mergeRuntimeOptions(currentOptions, nextOptions);
        if (nextOptions.scrollOffsets !== undefined) {
          currentScrollOffsets = cloneScrollOffsets(nextOptions.scrollOffsets);
        }
      }

      focusableNodeIds = collectFocusableNodeIds(currentRoot);
      if (focusedNodeId !== null && !focusableNodeIds.includes(focusedNodeId)) {
        focusedNodeId = null;
      }
    },
    render() {
      return renderToFrameBuffer(currentRoot, renderOptions());
    },
    rerender() {
      return renderToFrameBuffer(currentRoot, renderOptions());
    },
    dispatchAtPoint(binding, point, nativeEvent) {
      return dispatchAtPointInternal(binding, point, nativeEvent);
    },
    dispatchKeyDown(key, nativeEvent) {
      return dispatchKeyDownInternal(key, nativeEvent);
    },
    dispatchKeyUp(key, nativeEvent) {
      return dispatchFocusedBindingInternal("keyUp", nativeEvent ?? { key });
    },
    scrollAtPoint(point, delta, nativeEvent) {
      return scrollAtPointInternal(point, delta, nativeEvent);
    },
    focusAtPoint(point, nativeEvent) {
      return focusAtPointInternal(point, nativeEvent);
    },
    focusNext(nativeEvent) {
      return focusRelativeInternal(1, nativeEvent);
    },
    focusPrevious(nativeEvent) {
      return focusRelativeInternal(-1, nativeEvent);
    },
    focusNode(nodeId, nativeEvent) {
      focusNodeInternal(nodeId, nativeEvent);
    },
    getFocusedNodeId() {
      return focusedNodeId;
    },
    setScrollOffset(nodeId, offset) {
      currentScrollOffsets.set(nodeId, normalizeScrollOffset(offset));
    },
    getScrollOffset(nodeId) {
      const offset = currentScrollOffsets.get(nodeId);
      return offset === undefined ? undefined : { x: offset.x, y: offset.y };
    },
    dispatchEvent(event) {
      dispatchEventInternal(event);
    },
  };

  function dispatchEventInternal(event: TuiRuntimeEvent): void {
    switch (event.type) {
      case "click":
        dispatchAtPointInternal("click", event.point, event.nativeEvent);
        return;
      case "pointerDown":
        focusAtPointInternal(event.point, event.nativeEvent);
        dispatchAtPointInternal("mouseDown", event.point, event.nativeEvent);
        return;
      case "pointerMove":
        dispatchAtPointInternal("mouseMove", event.point, event.nativeEvent);
        return;
      case "pointerUp":
        dispatchAtPointInternal("mouseUp", event.point, event.nativeEvent);
        return;
      case "focusAtPoint":
        focusAtPointInternal(event.point, event.nativeEvent);
        return;
      case "focusNext":
        focusRelativeInternal(1, event.nativeEvent);
        return;
      case "focusPrevious":
        focusRelativeInternal(-1, event.nativeEvent);
        return;
      case "focusNode":
        focusNodeInternal(event.nodeId, event.nativeEvent);
        return;
      case "keyDown":
        dispatchKeyDownInternal(
          event.key,
          event.nativeEvent ?? { key: event.key },
        );
        return;
      case "keyUp":
        dispatchFocusedBindingInternal(
          "keyUp",
          event.nativeEvent ?? { key: event.key },
        );
        return;
      case "scroll":
        scrollAtPointInternal(event.point, event.delta, event.nativeEvent);
        return;
    }
  }

  function renderOptions(): RenderOptions {
    return currentScrollOffsets.size === 0
      ? { constraints: currentOptions.constraints }
      : {
          constraints: currentOptions.constraints,
          scrollOffsets: currentScrollOffsets,
        };
  }

  function dispatchAtPointInternal(
    binding: BindingName,
    point: TuiPoint,
    nativeEvent: unknown,
  ): DispatchResult {
    const result = dispatchBindingAtPoint(buildInputTree(), point, binding);
    notifyDispatch(binding, result, nativeEvent);
    return result;
  }

  function dispatchKeyDownInternal(
    key: string,
    nativeEvent: unknown,
  ): DispatchResult[] {
    const keyboardEvent =
      nativeEvent ?? ({ key } satisfies TuiKeyboardEventLike);
    const results = [dispatchFocusedBindingInternal("keyDown", keyboardEvent)];

    if (key === "Enter" || key === " ") {
      results.push(dispatchFocusedBindingInternal("press", keyboardEvent));
    }

    return results;
  }

  function scrollAtPointInternal(
    point: TuiPoint,
    delta: TuiScrollDelta,
    nativeEvent: unknown,
  ): DispatchResult {
    const result = dispatchBindingAtPoint(buildInputTree(), point, "scroll");
    applyScrollDelta(result.hit, delta);
    notifyDispatch("scroll", result, nativeEvent ?? { point, delta });
    return result;
  }

  function focusAtPointInternal(
    point: TuiPoint,
    nativeEvent: unknown,
  ): number | null {
    const path = hitPathAtPoint(point);
    const target = resolveFocusableNodeId(path);
    focusNodeInternal(target, nativeEvent);
    return target;
  }

  function focusRelativeInternal(
    step: 1 | -1,
    nativeEvent: unknown,
  ): number | null {
    if (focusableNodeIds.length === 0) {
      focusNodeInternal(null, nativeEvent);
      return null;
    }

    if (focusedNodeId === null) {
      const firstIndex = step > 0 ? 0 : focusableNodeIds.length - 1;
      const nextNodeId = focusableNodeIds[firstIndex] ?? null;
      focusNodeInternal(nextNodeId, nativeEvent);
      return nextNodeId;
    }

    const currentIndex = focusableNodeIds.indexOf(focusedNodeId);
    const nextIndex =
      currentIndex === -1
        ? step > 0
          ? 0
          : focusableNodeIds.length - 1
        : (currentIndex + step + focusableNodeIds.length) %
          focusableNodeIds.length;
    const nextNodeId = focusableNodeIds[nextIndex] ?? null;
    focusNodeInternal(nextNodeId, nativeEvent);
    return nextNodeId;
  }

  function focusNodeInternal(
    nodeId: number | null,
    nativeEvent: unknown,
  ): void {
    const nextNodeId =
      nodeId !== null && focusableNodeIds.includes(nodeId) ? nodeId : null;
    if (focusedNodeId === nextNodeId) {
      return;
    }

    const previousNodeId = focusedNodeId;
    if (previousNodeId !== null) {
      dispatchBindingForNodeInternal(previousNodeId, "blur", nativeEvent);
    }

    focusedNodeId = nextNodeId;

    if (nextNodeId !== null) {
      dispatchBindingForNodeInternal(nextNodeId, "focus", nativeEvent);
    }

    currentOptions.onFocusChange?.({
      previousNodeId,
      nodeId: nextNodeId,
    });
  }

  function dispatchFocusedBindingInternal(
    binding: BindingName,
    nativeEvent: unknown,
  ): DispatchResult {
    if (focusedNodeId === null) {
      const result = { hit: null, actions: [] } satisfies DispatchResult;
      notifyDispatch(binding, result, nativeEvent);
      return result;
    }

    return dispatchBindingForNodeInternal(focusedNodeId, binding, nativeEvent);
  }

  function dispatchBindingForNodeInternal(
    nodeId: number,
    binding: BindingName,
    nativeEvent: unknown,
  ): DispatchResult {
    const tree = buildInputTree();
    const hit = findHitByNodeId(tree, nodeId);
    const result = {
      hit,
      actions: collectDispatchActions(hit, binding),
    } satisfies DispatchResult;
    notifyDispatch(binding, result, nativeEvent);
    return result;
  }

  function notifyDispatch(
    binding: BindingName,
    result: DispatchResult,
    nativeEvent: unknown,
  ): void {
    const execution =
      currentOptions.resolveAction === undefined
        ? null
        : resolveDispatchResult(binding, result, currentOptions.resolveAction);

    currentOptions.onDispatch?.({
      binding,
      result,
      execution,
      nativeEvent,
    });
  }

  function hitPathAtPoint(point: TuiPoint): RenderTreeNode[] | null {
    return (
      dispatchBindingAtPoint(buildInputTree(), point, "click").hit?.path ?? null
    );
  }

  function buildInputTree(): RenderTree {
    const measurer = createTuiTextMeasurer();
    return buildRenderTree(
      currentRoot,
      currentScrollOffsets.size === 0
        ? {
            constraints: currentOptions.constraints,
            measureText: (request: TextLayoutRequest) =>
              measurer.measure(request),
          }
        : {
            constraints: currentOptions.constraints,
            scrollOffsets: currentScrollOffsets,
            measureText: (request: TextLayoutRequest) =>
              measurer.measure(request),
          },
    );
  }

  function applyScrollDelta(
    hit: RenderHit | null,
    delta: TuiScrollDelta,
  ): void {
    if (hit === null) {
      return;
    }

    const scrollable = resolveScrollableNode(hit.path);
    if (scrollable === null) {
      return;
    }

    const previousOffset = currentScrollOffsets.get(scrollable.nodeId) ?? {
      x: 0,
      y: 0,
    };
    const nextOffset = clampScrollOffset(scrollable, previousOffset, delta);

    if (
      nextOffset.x === previousOffset.x &&
      nextOffset.y === previousOffset.y
    ) {
      return;
    }

    currentScrollOffsets.set(scrollable.nodeId, nextOffset);
  }
}

function cloneRuntimeOptions<THandler>(
  options: TuiRuntimeOptions<THandler>,
): TuiRuntimeOptions<THandler> {
  return {
    ...options,
    scrollOffsets: cloneScrollOffsets(options.scrollOffsets),
  };
}

function mergeRuntimeOptions<THandler>(
  current: TuiRuntimeOptions<THandler>,
  patch: Partial<TuiRuntimeOptions<THandler>>,
): TuiRuntimeOptions<THandler> {
  return {
    ...current,
    ...patch,
  };
}

function cloneScrollOffsets(
  scrollOffsets: ReadonlyMap<number, ScrollOffset> | undefined,
): Map<number, ScrollOffset> {
  const next = new Map<number, ScrollOffset>();
  if (scrollOffsets === undefined) {
    return next;
  }

  for (const [nodeId, offset] of scrollOffsets) {
    next.set(nodeId, normalizeScrollOffset(offset));
  }

  return next;
}

function normalizeScrollOffset(offset: ScrollOffset): ScrollOffset {
  return {
    x: Math.max(0, Math.trunc(offset.x)),
    y: Math.max(0, Math.trunc(offset.y)),
  };
}

function collectFocusableNodeIds(root: UINode): number[] {
  const nodeIds: number[] = [];

  visitNode(root, (node) => {
    if (node.kind === "view" && node.spec.focusable) {
      nodeIds.push(node.id);
    }
  });

  return nodeIds;
}

function visitNode(node: UINode, visitor: (node: UINode) => void): void {
  visitor(node);
  for (const child of node.children) {
    visitNode(child, visitor);
  }
}

function resolveFocusableNodeId(path: RenderTreeNode[] | null): number | null {
  if (path === null) {
    return null;
  }

  for (let index = path.length - 1; index >= 0; index -= 1) {
    const node = path[index];
    if (node?.kind === "view" && node.node.spec.focusable) {
      return node.nodeId;
    }
  }

  return null;
}

function resolveScrollableNode(path: RenderTreeNode[]): RenderTreeNode | null {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const node = path[index];
    if (
      node?.kind === "view" &&
      node.node.spec.scroll !== null &&
      (node.contentSize.width > node.frame.width ||
        node.contentSize.height > node.frame.height)
    ) {
      return node;
    }
  }

  return null;
}

function clampScrollOffset(
  node: RenderTreeNode,
  offset: ScrollOffset,
  delta: TuiScrollDelta,
): ScrollOffset {
  if (node.kind !== "view") {
    return offset;
  }

  const maxX = Math.max(0, node.contentSize.width - node.frame.width);
  const maxY = Math.max(0, node.contentSize.height - node.frame.height);
  const scroll = node.node.spec.scroll;

  return {
    x:
      scroll === "x" || scroll === "both"
        ? clampAxis(offset.x + Math.trunc(delta.x), maxX)
        : offset.x,
    y:
      scroll === "y" || scroll === "both"
        ? clampAxis(offset.y + Math.trunc(delta.y), maxY)
        : offset.y,
  };
}

function clampAxis(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

function findHitByNodeId(tree: RenderTree, nodeId: NodeId): RenderHit | null {
  const path = findPathByNodeId(tree.root, nodeId);
  if (path === null) {
    return null;
  }

  const node = path[path.length - 1];
  if (node === undefined) {
    return null;
  }

  return {
    node,
    path,
    localPoint: { x: 0, y: 0 },
  };
}

function findPathByNodeId(
  node: RenderTreeNode,
  nodeId: NodeId,
): RenderTreeNode[] | null {
  if (node.nodeId === nodeId) {
    return [node];
  }

  for (const child of node.children) {
    const childPath = findPathByNodeId(child, nodeId);
    if (childPath !== null) {
      return [node, ...childPath];
    }
  }

  return null;
}
