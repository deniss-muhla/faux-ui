import {
  buildRenderTree,
  collectDispatchActions,
  dispatchBindingAtPoint,
  layoutNode,
  type ActivationEvent,
  type BindingName,
  type DispatchAction,
  type DispatchExecution,
  type DispatchHandlerResolver,
  type DispatchResult,
  type EventTargetHandle,
  type FocusEvent,
  type KeyEvent,
  type NodeId,
  type PointerButton,
  type PointerDispatchMeta,
  type PointerEvent,
  type PointerModifiers,
  type RenderHit,
  type RenderTree,
  type RenderTreeNode,
  type ScrollEvent,
  type ScrollOffset,
  type UINode,
} from "@faux-ui/core";

import { renderToFrameBuffer, type RenderOptions } from "./render.js";
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
      pointer?: PointerDispatchMeta;
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
      pointer?: PointerDispatchMeta;
      nativeEvent?: unknown;
    };

export interface TuiDispatchEvent<THandler = unknown> {
  binding: BindingName;
  result: DispatchResult;
  execution: DispatchExecution<THandler> | null;
  pointer: PointerDispatchMeta | null;
  nativeEvent: unknown;
}

export interface TuiFocusChangeEvent {
  previousNodeId: number | null;
  nodeId: number | null;
}

export interface TuiRuntimeOptions<THandler = unknown> extends RenderOptions {
  resolveAction?: DispatchHandlerResolver<THandler>;
  onDispatch?: (event: TuiDispatchEvent<THandler>) => void;
  onFocusChange?: (event: TuiFocusChangeEvent) => void;
  onStateChange?: () => void;
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
  sanitizeStoredScrollOffsets();
  let focusedNodeId: number | null = null;
  let hoveredPathNodeIds: NodeId[] = [];
  let activePointer: {
    point: TuiPoint;
    button: PointerButton | null;
    modifiers: PointerModifiers;
    dragging: boolean;
  } | null = null;
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
      hoveredPathNodeIds = hoveredPathNodeIds.filter(
        (nodeId) => findSemanticNodeById(currentRoot, nodeId) !== null,
      );
      sanitizeStoredScrollOffsets();
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
      const nextOffset = clampStoredScrollOffset(nodeId, normalizeScrollOffset(offset));
      const previousOffset = currentScrollOffsets.get(nodeId);
      currentScrollOffsets.set(nodeId, nextOffset);
      sanitizeStoredScrollOffsets();
      if (
        previousOffset?.x !== nextOffset.x ||
        previousOffset?.y !== nextOffset.y
      ) {
        currentOptions.onStateChange?.();
      }
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
        dispatchAtPointInternal(
          "click",
          event.point,
          event.nativeEvent,
          event.pointer ?? null,
        );
        return;
      case "pointerDown":
        focusAtPointInternal(event.point, event.nativeEvent);
        activePointer = {
          point: event.point,
          button: event.pointer?.button ?? null,
          modifiers: event.pointer?.modifiers ?? emptyPointerModifiers(),
          dragging: false,
        };
        dispatchAtPointInternal(
          "mouseDown",
          event.point,
          event.nativeEvent,
          event.pointer ?? null,
        );
        return;
      case "pointerMove":
        syncHoveredPathAtPoint(event.point, event.nativeEvent);
        dispatchAtPointInternal(
          "mouseMove",
          event.point,
          event.nativeEvent,
          event.pointer ?? activePointerMeta(event.point),
        );

        if (
          activePointer !== null &&
          !samePoint(activePointer.point, event.point)
        ) {
          const pointer = event.pointer ?? activePointerMeta(event.point);
          if (!activePointer.dragging) {
            dispatchAtPointInternal(
              "dragStart",
              event.point,
              event.nativeEvent,
              pointer,
            );
            activePointer.dragging = true;
          }

          dispatchAtPointInternal(
            "drag",
            event.point,
            event.nativeEvent,
            pointer,
          );
          activePointer.point = event.point;
          activePointer.modifiers =
            pointer?.modifiers ?? emptyPointerModifiers();
        }
        return;
      case "pointerUp":
        dispatchAtPointInternal(
          "mouseUp",
          event.point,
          event.nativeEvent,
          event.pointer ?? activePointerMeta(event.point),
        );
        if (activePointer?.dragging) {
          dispatchAtPointInternal(
            "dragEnd",
            event.point,
            event.nativeEvent,
            event.pointer ?? activePointerMeta(event.point),
          );
        }
        activePointer = null;
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
        scrollAtPointInternal(
          event.point,
          event.delta,
          event.nativeEvent,
          event.pointer ?? null,
        );
        return;
    }
  }

  function renderOptions(): RenderOptions {
    const base = {
      constraints: currentOptions.constraints,
      ...(hoveredPathNodeIds.length > 0
        ? { hoveredNodeIds: new Set(hoveredPathNodeIds) }
        : {}),
      ...(focusedNodeId !== null ? { focusedNodeId } : {}),
    } satisfies RenderOptions;

    return currentScrollOffsets.size === 0
      ? base
      : {
          ...base,
          scrollOffsets: currentScrollOffsets,
        };
  }

  function dispatchAtPointInternal(
    binding: BindingName,
    point: TuiPoint,
    nativeEvent: unknown,
    pointer: PointerDispatchMeta | null = null,
  ): DispatchResult {
    const result = dispatchBindingAtPoint(buildInputTree(), point, binding);
    notifyDispatch(binding, result, nativeEvent, pointer);
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
    pointer: PointerDispatchMeta | null = null,
  ): DispatchResult {
    const result = dispatchBindingAtPoint(buildInputTree(), point, "scroll");
    const didScroll = applyScrollDelta(result.hit, delta);
    if (didScroll) {
      currentOptions.onStateChange?.();
    }
    notifyDispatch(
      "scroll",
      result,
      nativeEvent ?? { point, delta },
      pointer,
      delta,
    );
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
    pointer: PointerDispatchMeta | null = null,
    scrollDelta: ScrollOffset | null = null,
  ): void {
    const execution = resolveExecution(
      binding,
      result,
      nativeEvent,
      pointer,
      scrollDelta,
    );

    for (const action of execution?.resolvedActions ?? []) {
      if (typeof action.handler === "function") {
        action.handler();
      }
    }

    currentOptions.onDispatch?.({
      binding,
      result,
      execution,
      pointer,
      nativeEvent,
    });
  }

  function activePointerMeta(point: TuiPoint): PointerDispatchMeta | null {
    if (activePointer === null) {
      return null;
    }

    return {
      point,
      button: activePointer.button,
      modifiers: activePointer.modifiers,
    };
  }

  function syncHoveredPathAtPoint(point: TuiPoint, nativeEvent: unknown): void {
    syncHoveredPath(hitPathAtPoint(point), nativeEvent);
  }

  function syncHoveredPath(
    nextPath: RenderTreeNode[] | null,
    nativeEvent: unknown,
  ): void {
    const nextNodeIds = nextPath?.map((node) => node.nodeId) ?? [];
    let sharedPrefixLength = 0;

    while (
      sharedPrefixLength < hoveredPathNodeIds.length &&
      sharedPrefixLength < nextNodeIds.length &&
      hoveredPathNodeIds[sharedPrefixLength] === nextNodeIds[sharedPrefixLength]
    ) {
      sharedPrefixLength += 1;
    }

    for (
      let index = hoveredPathNodeIds.length - 1;
      index >= sharedPrefixLength;
      index -= 1
    ) {
      const nodeId = hoveredPathNodeIds[index];
      if (nodeId !== undefined) {
        dispatchOwnBindingForNodeInternal(nodeId, "mouseLeave", nativeEvent);
      }
    }

    for (
      let index = sharedPrefixLength;
      index < nextNodeIds.length;
      index += 1
    ) {
      const nodeId = nextNodeIds[index];
      if (nodeId !== undefined) {
        dispatchOwnBindingForNodeInternal(nodeId, "mouseEnter", nativeEvent);
      }
    }

    hoveredPathNodeIds = nextNodeIds;
  }

  function hitPathAtPoint(point: TuiPoint): RenderTreeNode[] | null {
    return (
      dispatchBindingAtPoint(buildInputTree(), point, "click").hit?.path ?? null
    );
  }

  function dispatchOwnBindingForNodeInternal(
    nodeId: number,
    binding: BindingName,
    nativeEvent: unknown,
  ): void {
    const tree = buildInputTree();
    const hit = findHitByNodeId(tree, nodeId);
    const token = hit?.node.node.bindings?.[binding];

    if (hit === null || token === undefined) {
      return;
    }

    notifyDispatch(
      binding,
      {
        hit,
        actions: [
          {
            binding,
            action: token,
            nodeId,
            currentTarget: hit.node,
            target: hit.node,
          },
        ],
      },
      nativeEvent,
    );
  }

  function buildInputTree(): RenderTree {
    return buildRenderTree(
      currentRoot,
      currentScrollOffsets.size === 0
        ? {
            constraints: currentOptions.constraints,
          }
        : {
            constraints: currentOptions.constraints,
            scrollOffsets: currentScrollOffsets,
          },
    );
  }

  function applyScrollDelta(
    hit: RenderHit | null,
    delta: TuiScrollDelta,
  ): boolean {
    if (hit === null) {
      return false;
    }

    const scrollable = resolveScrollableNode(hit.path);
    if (scrollable === null) {
      return false;
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
      return false;
    }

    currentScrollOffsets.set(scrollable.nodeId, nextOffset);
    return true;
  }

  function sanitizeStoredScrollOffsets(): void {
    if (currentScrollOffsets.size === 0) {
      return;
    }

    layoutNode(currentRoot, currentOptions.constraints);

    const next = new Map<NodeId, ScrollOffset>();
    for (const [nodeId, offset] of currentScrollOffsets) {
      next.set(nodeId, clampStoredScrollOffset(nodeId, offset));
    }

    currentScrollOffsets = next;
  }

  function resolveExecution(
    binding: BindingName,
    result: DispatchResult,
    nativeEvent: unknown,
    pointer: PointerDispatchMeta | null,
    scrollDelta: ScrollOffset | null,
  ): DispatchExecution<THandler> | null {
    const resolvedActions: DispatchExecution<THandler>["resolvedActions"] = [];

    for (const dispatchAction of result.actions) {
      const handler = resolveHandler(
        dispatchAction,
        result,
        nativeEvent,
        pointer,
        scrollDelta,
      );
      if (handler === undefined) {
        continue;
      }

      resolvedActions.push({
        ...dispatchAction,
        handler,
      });
    }

    if (resolvedActions.length === 0) {
      return currentOptions.resolveAction === undefined
        ? null
        : {
            ...result,
            binding,
            target: result.hit?.node ?? null,
            resolvedActions,
          };
    }

    return {
      ...result,
      binding,
      target: result.hit?.node ?? null,
      resolvedActions,
    };
  }

  function resolveHandler(
    dispatchAction: DispatchAction,
    result: DispatchResult,
    nativeEvent: unknown,
    pointer: PointerDispatchMeta | null,
    scrollDelta: ScrollOffset | null,
  ): THandler | undefined {
    if (typeof dispatchAction.action === "function") {
      const directHandler = dispatchAction.action;
      return (() => {
        directHandler(
          createDispatchEventPayload(
            dispatchAction,
            nativeEvent,
            pointer,
            scrollDelta,
          ),
        );
      }) as THandler;
    }

    return currentOptions.resolveAction?.(
      dispatchAction.action,
      dispatchAction,
      result,
    );
  }

  function createDispatchEventPayload(
    dispatchAction: DispatchAction,
    nativeEvent: unknown,
    pointer: PointerDispatchMeta | null,
    scrollDelta: ScrollOffset | null,
  ): FocusEvent | KeyEvent | PointerEvent | ActivationEvent | ScrollEvent {
    const base = {
      currentTarget: toEventTargetHandle(dispatchAction.currentTarget),
      target: toEventTargetHandle(dispatchAction.target),
      nativeEvent,
    };

    if (
      dispatchAction.binding === "focus" ||
      dispatchAction.binding === "blur"
    ) {
      return base;
    }

    if (
      dispatchAction.binding === "keyDown" ||
      dispatchAction.binding === "keyUp"
    ) {
      return {
        ...base,
        key: readKey(nativeEvent),
      };
    }

    const point = pointer?.point;
    const button = pointer?.button ?? null;
    const modifiers = pointer?.modifiers ?? emptyPointerModifiers();

    if (dispatchAction.binding === "scroll") {
      return {
        ...base,
        point,
        button,
        modifiers,
        delta: scrollDelta ?? { x: 0, y: 0 },
      };
    }

    if (dispatchAction.binding === "press") {
      return {
        ...base,
        key: readKey(nativeEvent) || undefined,
        point,
        button,
        modifiers,
      };
    }

    return {
      ...base,
      point,
      button,
      modifiers,
    };
  }

  function toEventTargetHandle(node: RenderTreeNode): EventTargetHandle {
    return {
      id: node.nodeId,
      kind: node.kind,
    };
  }

  function readKey(nativeEvent: unknown): string {
    return typeof nativeEvent === "object" &&
      nativeEvent !== null &&
      "key" in nativeEvent
      ? String((nativeEvent as { key: unknown }).key ?? "")
      : "";
  }

  function clampStoredScrollOffset(
    nodeId: NodeId,
    offset: ScrollOffset,
  ): ScrollOffset {
    const normalized = normalizeScrollOffset(offset);
    const node = findSemanticNodeById(currentRoot, nodeId);

    if (node === null || node.kind !== "view") {
      return normalized;
    }

    const viewportSize = node.layout.cachedSize;
    const contentSize = node.layout.contentSize ?? viewportSize;

    if (viewportSize === undefined || contentSize === undefined) {
      return normalized;
    }

    const scroll = node.spec.scroll;
    const maxX =
      scroll === "x" || scroll === "both"
        ? Math.max(0, contentSize.width - viewportSize.width)
        : 0;
    const maxY =
      scroll === "y" || scroll === "both"
        ? Math.max(0, contentSize.height - viewportSize.height)
        : 0;

    return {
      x: clampAxis(normalized.x, maxX),
      y: clampAxis(normalized.y, maxY),
    };
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

function findSemanticNodeById(root: UINode, nodeId: NodeId): UINode | null {
  if (root.id === nodeId) {
    return root;
  }

  for (const child of root.children) {
    const match = findSemanticNodeById(child, nodeId);
    if (match !== null) {
      return match;
    }
  }

  return null;
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

function emptyPointerModifiers(): PointerModifiers {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
}

function samePoint(left: TuiPoint, right: TuiPoint): boolean {
  return left.x === right.x && left.y === right.y;
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
