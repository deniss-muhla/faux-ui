import {
  buildRenderTree,
  collectDispatchActions,
  dispatchBindingAtPoint,
  layoutNode,
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
  type UINode,
} from "@faux-ui/core";

import type { DomPoint } from "./events.js";
import { renderToDomModel, type DomRenderOptions } from "./model.js";

type EventListener = (event: unknown) => void;

export interface DomRectLike {
  left: number;
  top: number;
}

export interface DomStyleDeclarationLike {
  setProperty(name: string, value: string): void;
}

export interface DomDocumentLike {
  createElement(tag: string): DomElementLike;
}

export interface DomElementLike {
  ownerDocument?: DomDocumentLike;
  style: DomStyleDeclarationLike;
  textContent: string | null;
  tabIndex: number;
  replaceChildren(...children: DomElementLike[]): void;
  appendChild(child: DomElementLike): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  getBoundingClientRect(): DomRectLike;
  focus?(): void;
}

export interface DomPointerEventLike {
  clientX: number;
  clientY: number;
  preventDefault?(): void;
}

export interface DomWheelEventLike extends DomPointerEventLike {
  deltaX: number;
  deltaY: number;
}

export interface DomKeyboardEventLike {
  key: string;
  preventDefault?(): void;
}

export interface DomFocusEventLike {
  relatedTarget?: DomElementLike | null;
}

export interface DomDispatchEvent<THandler = unknown> {
  binding: BindingName;
  result: DispatchResult;
  execution: DispatchExecution<THandler> | null;
  nativeEvent: unknown;
}

export interface DomFocusChangeEvent {
  previousNodeId: number | null;
  nodeId: number | null;
}

export interface DomMountOptions<THandler = unknown> extends DomRenderOptions {
  container: DomElementLike;
  document?: DomDocumentLike;
  resolveAction?: BindingHandlerResolver<THandler>;
  onDispatch?: (event: DomDispatchEvent<THandler>) => void;
  onFocusChange?: (event: DomFocusChangeEvent) => void;
}

export interface MountedDomRoot<THandler = unknown> {
  update(
    root?: UINode,
    options?: Partial<Omit<DomMountOptions<THandler>, "container">>,
  ): void;
  rerender(): void;
  unmount(): void;
  dispatchAtPoint(
    binding: BindingName,
    point: DomPoint,
    nativeEvent?: unknown,
  ): DispatchResult;
  focusAtPoint(point: DomPoint, nativeEvent?: unknown): number | null;
  focusNode(nodeId: number | null, nativeEvent?: unknown): void;
  getFocusedNodeId(): number | null;
  setScrollOffset(nodeId: number, offset: ScrollOffset): void;
  getScrollOffset(nodeId: number): ScrollOffset | undefined;
}

export function mountDomRoot(
  root: UINode,
  options: DomMountOptions,
): MountedDomRoot;
export function mountDomRoot<THandler>(
  root: UINode,
  options: DomMountOptions<THandler>,
): MountedDomRoot<THandler>;
export function mountDomRoot<THandler>(
  root: UINode,
  options: DomMountOptions<THandler>,
): MountedDomRoot<THandler> {
  let currentRoot = root;
  let currentOptions = cloneMountOptions(options);
  let currentScrollOffsets = cloneScrollOffsets(options.scrollOffsets);
  sanitizeStoredScrollOffsets();
  let focusedNodeId: number | null = null;
  let hoveredPathNodeIds: NodeId[] = [];
  let elementNodeIds = new WeakMap<DomElementLike, NodeId>();
  let nodeElements = new Map<NodeId, DomElementLike>();
  let focusableNodeIds = collectFocusableNodeIds(currentRoot);

  const container = options.container;
  const document = resolveDocument(options);

  const clickListener: EventListener = (event) => {
    if (!isPointerEventLike(event)) {
      return;
    }

    dispatchAtPointInternal(
      "click",
      pointFromPointerEvent(container, event),
      event,
    );
  };

  const mouseDownListener: EventListener = (event) => {
    if (!isPointerEventLike(event)) {
      return;
    }

    const point = pointFromPointerEvent(container, event);
    focusAtPointInternal(point, event);
    dispatchAtPointInternal("mouseDown", point, event);
  };

  const mouseUpListener: EventListener = (event) => {
    if (!isPointerEventLike(event)) {
      return;
    }

    dispatchAtPointInternal(
      "mouseUp",
      pointFromPointerEvent(container, event),
      event,
    );
  };

  const mouseMoveListener: EventListener = (event) => {
    if (!isPointerEventLike(event)) {
      return;
    }

    const point = pointFromPointerEvent(container, event);
    syncHoveredPathAtPoint(point, event);

    dispatchAtPointInternal("mouseMove", point, event);
  };

  const mouseLeaveListener: EventListener = (event) => {
    if (syncHoveredPath(null, event)) {
      rerenderInternal();
    }
  };

  const wheelListener: EventListener = (event) => {
    if (!isWheelEventLike(event)) {
      return;
    }

    dispatchWheelAtPointInternal(
      pointFromPointerEvent(container, event),
      event,
    );
  };

  const keyDownListener: EventListener = (event) => {
    if (!isKeyboardEventLike(event)) {
      return;
    }

    dispatchFocusedBindingInternal("keyDown", event);
    if (event.key === "Enter" || event.key === " ") {
      dispatchFocusedBindingInternal("press", event);
    }
  };

  const keyUpListener: EventListener = (event) => {
    if (!isKeyboardEventLike(event)) {
      return;
    }

    dispatchFocusedBindingInternal("keyUp", event);
  };

  applyContainerStyles(container);
  container.addEventListener("click", clickListener);
  container.addEventListener("mousedown", mouseDownListener);
  container.addEventListener("mouseup", mouseUpListener);
  container.addEventListener("mousemove", mouseMoveListener);
  container.addEventListener("mouseleave", mouseLeaveListener);
  container.addEventListener("wheel", wheelListener);
  container.addEventListener("keydown", keyDownListener);
  container.addEventListener("keyup", keyUpListener);
  rerenderInternal();

  return {
    update(nextRoot, nextOptions) {
      const previousRoot = currentRoot;
      const previousOptions = renderOptions();
      const previousFocusedNodeId = focusedNodeId;
      const previousHoveredPathNodeIds = [...hoveredPathNodeIds];

      if (nextRoot !== undefined) {
        currentRoot = nextRoot;
      }

      if (nextOptions !== undefined) {
        currentOptions = mergeMountOptions(currentOptions, nextOptions);
        if (nextOptions.scrollOffsets !== undefined) {
          currentScrollOffsets = cloneScrollOffsets(nextOptions.scrollOffsets);
        }
      }

      focusableNodeIds = collectFocusableNodeIds(currentRoot);
      sanitizeStoredScrollOffsets();
      reconcileDetachedInteractionState(
        previousRoot,
        previousOptions,
        previousFocusedNodeId,
        previousHoveredPathNodeIds,
      );
      rerenderInternal();
    },
    rerender() {
      rerenderInternal();
    },
    unmount() {
      flushInteractionState(currentRoot, renderOptions(), { type: "unmount" });
      container.removeEventListener("click", clickListener);
      container.removeEventListener("mousedown", mouseDownListener);
      container.removeEventListener("mouseup", mouseUpListener);
      container.removeEventListener("mousemove", mouseMoveListener);
      container.removeEventListener("mouseleave", mouseLeaveListener);
      container.removeEventListener("wheel", wheelListener);
      container.removeEventListener("keydown", keyDownListener);
      container.removeEventListener("keyup", keyUpListener);
      container.replaceChildren();
      nodeElements = new Map<NodeId, DomElementLike>();
      elementNodeIds = new WeakMap<DomElementLike, NodeId>();
      hoveredPathNodeIds = [];
      focusedNodeId = null;
    },
    dispatchAtPoint(binding, point, nativeEvent) {
      return dispatchAtPointInternal(binding, point, nativeEvent);
    },
    focusAtPoint(point, nativeEvent) {
      return focusAtPointInternal(point, nativeEvent);
    },
    focusNode(nodeId, nativeEvent) {
      focusNodeInternal(nodeId, nativeEvent);
    },
    getFocusedNodeId() {
      return focusedNodeId;
    },
    setScrollOffset(nodeId, offset) {
      currentScrollOffsets.set(nodeId, normalizeScrollOffset(offset));
      sanitizeStoredScrollOffsets();
      rerenderInternal();
    },
    getScrollOffset(nodeId) {
      const offset = currentScrollOffsets.get(nodeId);
      return offset === undefined ? undefined : { x: offset.x, y: offset.y };
    },
  };

  function rerenderInternal(): void {
    focusableNodeIds = collectFocusableNodeIds(currentRoot);
    const model = renderToDomModel(currentRoot, renderOptions());
    const rootElement = createLiveNode(model);
    container.replaceChildren(rootElement);

    if (focusedNodeId !== null) {
      const focusedElement = nodeElements.get(focusedNodeId);
      focusedElement?.focus?.();
    }
  }

  function renderOptions(): DomRenderOptions {
    const base = {
      constraints: currentOptions.constraints,
      measureText: currentOptions.measureText,
      ...(hoveredPathNodeIds.length > 0
        ? { hoveredNodeIds: new Set(hoveredPathNodeIds) }
        : {}),
      ...(focusedNodeId !== null ? { focusedNodeId } : {}),
    } satisfies DomRenderOptions;

    return currentScrollOffsets.size === 0
      ? base
      : {
          ...base,
          scrollOffsets: currentScrollOffsets,
        };
  }

  function createLiveNode(
    model: ReturnType<typeof renderToDomModel>,
  ): DomElementLike {
    nodeElements = new Map<NodeId, DomElementLike>();
    elementNodeIds = new WeakMap<DomElementLike, NodeId>();
    return createLiveNodeRecursive(model);
  }

  function createLiveNodeRecursive(
    model: ReturnType<typeof renderToDomModel>,
  ): DomElementLike {
    const element = document.createElement(model.tag);
    nodeElements.set(model.nodeId, element);
    elementNodeIds.set(element, model.nodeId);

    for (const [name, value] of Object.entries(model.styles)) {
      element.style.setProperty(name, value);
    }

    if (model.kind === "text") {
      element.textContent = model.textContent ?? "";
    } else {
      element.textContent = null;
      const isFocusable = focusableNodeIds.has(model.nodeId);
      element.tabIndex = isFocusable ? 0 : -1;
      if (isFocusable) {
        element.addEventListener("focus", () => {
          focusNodeInternal(model.nodeId, { type: "native-focus" });
        });
        element.addEventListener("blur", (event) => {
          const relatedNodeId = resolveNodeIdFromElement(
            (event as DomFocusEventLike).relatedTarget,
          );
          focusNodeInternal(relatedNodeId, event);
        });
      }
      for (const child of model.children) {
        element.appendChild(createLiveNodeRecursive(child));
      }
    }

    return element;
  }

  function dispatchAtPointInternal(
    binding: BindingName,
    point: DomPoint,
    nativeEvent: unknown,
  ): DispatchResult {
    const result = dispatchBindingAtPoint(buildInputTree(), point, binding);
    notifyDispatch(binding, result, nativeEvent);
    return result;
  }

  function dispatchWheelAtPointInternal(
    point: DomPoint,
    event: DomWheelEventLike,
  ): DispatchResult {
    const result = dispatchBindingAtPoint(buildInputTree(), point, "scroll");
    const didScroll = applyScrollDelta(result.hit, {
      x: event.deltaX,
      y: event.deltaY,
    });

    if (didScroll) {
      event.preventDefault?.();
      rerenderInternal();
    }

    notifyDispatch("scroll", result, event);
    return result;
  }

  function focusAtPointInternal(
    point: DomPoint,
    nativeEvent: unknown,
  ): number | null {
    const path = hitPathAtPoint(point);
    const target = resolveFocusableNodeId(path);
    focusNodeInternal(target, nativeEvent);
    return target;
  }

  function focusNodeInternal(
    nodeId: number | null,
    nativeEvent: unknown,
  ): void {
    const nextNodeId =
      nodeId !== null && focusableNodeIds.has(nodeId) ? nodeId : null;
    if (focusedNodeId === nextNodeId) {
      return;
    }

    const previousNodeId = focusedNodeId;
    if (previousNodeId !== null) {
      dispatchBindingForNodeInternal(previousNodeId, "blur", nativeEvent);
    }

    focusedNodeId = nextNodeId;
    rerenderInternal();

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

  function syncHoveredPathAtPoint(point: DomPoint, nativeEvent: unknown): void {
    if (syncHoveredPath(hitPathAtPoint(point), nativeEvent)) {
      rerenderInternal();
    }
  }

  function syncHoveredPath(
    nextPath: RenderTreeNode[] | null,
    nativeEvent: unknown,
  ): boolean {
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

    const changed =
      sharedPrefixLength !== hoveredPathNodeIds.length ||
      sharedPrefixLength !== nextNodeIds.length;

    hoveredPathNodeIds = nextNodeIds;
    return changed;
  }

  function hitPathAtPoint(point: DomPoint): RenderTreeNode[] | null {
    return (
      dispatchBindingAtPoint(buildInputTree(), point, "click").hit?.path ?? null
    );
  }

  function buildInputTree(): RenderTree {
    const options = renderOptions();
    return buildRenderTree(
      currentRoot,
      options.scrollOffsets === undefined
        ? {
            constraints: options.constraints,
            measureText: options.measureText,
          }
        : {
            constraints: options.constraints,
            measureText: options.measureText,
            scrollOffsets: options.scrollOffsets,
          },
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
            token,
            nodeId,
            currentTarget: hit.node,
            target: hit.node,
          },
        ],
      },
      nativeEvent,
    );
  }

  function resolveNodeIdFromElement(
    element: DomElementLike | null | undefined,
  ): number | null {
    if (element === undefined || element === null) {
      return null;
    }

    return elementNodeIds.get(element) ?? null;
  }

  function applyScrollDelta(
    hit: RenderHit | null,
    delta: ScrollOffset,
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

  function reconcileDetachedInteractionState(
    previousRoot: UINode,
    previousOptions: DomRenderOptions,
    previousFocusedNodeId: number | null,
    previousHoveredNodeIds: NodeId[],
  ): void {
    const currentNodeIds = collectNodeIds(currentRoot);
    const detachedHoveredNodeIds = previousHoveredNodeIds.filter(
      (nodeId) => !currentNodeIds.has(nodeId),
    );

    if (detachedHoveredNodeIds.length > 0) {
      const previousTree = buildRenderTree(
        previousRoot,
        previousOptions.scrollOffsets === undefined
          ? {
              constraints: previousOptions.constraints,
              measureText: previousOptions.measureText,
            }
          : {
              constraints: previousOptions.constraints,
              measureText: previousOptions.measureText,
              scrollOffsets: previousOptions.scrollOffsets,
            },
      );

      for (
        let index = detachedHoveredNodeIds.length - 1;
        index >= 0;
        index -= 1
      ) {
        const nodeId = detachedHoveredNodeIds[index];
        if (nodeId !== undefined) {
          dispatchOwnBindingForNodeFromTree(
            previousTree,
            nodeId,
            "mouseLeave",
            { type: "tree-update" },
          );
        }
      }

      hoveredPathNodeIds = hoveredPathNodeIds.filter((nodeId) =>
        currentNodeIds.has(nodeId),
      );
    }

    if (
      previousFocusedNodeId !== null &&
      !focusableNodeIds.has(previousFocusedNodeId)
    ) {
      const previousTree = buildRenderTree(
        previousRoot,
        previousOptions.scrollOffsets === undefined
          ? {
              constraints: previousOptions.constraints,
              measureText: previousOptions.measureText,
            }
          : {
              constraints: previousOptions.constraints,
              measureText: previousOptions.measureText,
              scrollOffsets: previousOptions.scrollOffsets,
            },
      );

      dispatchBindingForNodeFromTree(
        previousTree,
        previousFocusedNodeId,
        "blur",
        { type: "tree-update" },
      );
      focusedNodeId = null;
      currentOptions.onFocusChange?.({
        previousNodeId: previousFocusedNodeId,
        nodeId: null,
      });
    }
  }

  function flushInteractionState(
    root: UINode,
    options: DomRenderOptions,
    nativeEvent: unknown,
  ): void {
    const tree = buildRenderTree(
      root,
      options.scrollOffsets === undefined
        ? {
            constraints: options.constraints,
            measureText: options.measureText,
          }
        : {
            constraints: options.constraints,
            measureText: options.measureText,
            scrollOffsets: options.scrollOffsets,
          },
    );

    for (let index = hoveredPathNodeIds.length - 1; index >= 0; index -= 1) {
      const nodeId = hoveredPathNodeIds[index];
      if (nodeId !== undefined) {
        dispatchOwnBindingForNodeFromTree(
          tree,
          nodeId,
          "mouseLeave",
          nativeEvent,
        );
      }
    }

    if (focusedNodeId !== null) {
      dispatchBindingForNodeFromTree(tree, focusedNodeId, "blur", nativeEvent);
      currentOptions.onFocusChange?.({
        previousNodeId: focusedNodeId,
        nodeId: null,
      });
    }
  }

  function dispatchBindingForNodeFromTree(
    tree: RenderTree,
    nodeId: number,
    binding: BindingName,
    nativeEvent: unknown,
  ): void {
    const hit = findHitByNodeId(tree, nodeId);
    const result = {
      hit,
      actions: collectDispatchActions(hit, binding),
    } satisfies DispatchResult;

    notifyDispatch(binding, result, nativeEvent);
  }

  function dispatchOwnBindingForNodeFromTree(
    tree: RenderTree,
    nodeId: number,
    binding: BindingName,
    nativeEvent: unknown,
  ): void {
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
            token,
            nodeId,
            currentTarget: hit.node,
            target: hit.node,
          },
        ],
      },
      nativeEvent,
    );
  }

  function collectNodeIds(root: UINode): Set<NodeId> {
    const nodeIds = new Set<NodeId>();

    visitNode(root, (node) => {
      nodeIds.add(node.id);
    });

    return nodeIds;
  }

  function sanitizeStoredScrollOffsets(): void {
    if (currentScrollOffsets.size === 0) {
      return;
    }

    layoutNode(currentRoot, currentOptions.constraints, {
      measureText: currentOptions.measureText,
    });

    const next = new Map<NodeId, ScrollOffset>();
    for (const [nodeId, offset] of currentScrollOffsets) {
      next.set(nodeId, clampStoredScrollOffset(nodeId, offset));
    }

    currentScrollOffsets = next;
  }

  function clampStoredScrollOffset(
    nodeId: NodeId,
    offset: ScrollOffset,
  ): ScrollOffset {
    const normalized = normalizeScrollOffset(offset);
    const node = findNodeById(currentRoot, nodeId);

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

function cloneMountOptions<THandler>(
  options: DomMountOptions<THandler>,
): DomMountOptions<THandler> {
  return {
    ...options,
    scrollOffsets: cloneScrollOffsets(options.scrollOffsets),
  };
}

function mergeMountOptions<THandler>(
  current: DomMountOptions<THandler>,
  patch: Partial<Omit<DomMountOptions<THandler>, "container">>,
): DomMountOptions<THandler> {
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

function resolveDocument<THandler>(
  options: DomMountOptions<THandler>,
): DomDocumentLike {
  if (options.document !== undefined) {
    return options.document;
  }

  if (options.container.ownerDocument !== undefined) {
    return options.container.ownerDocument;
  }

  throw new Error(
    "mountDomRoot() requires a document or container.ownerDocument.",
  );
}

function applyContainerStyles(container: DomElementLike): void {
  container.style.setProperty("position", "relative");
  container.style.setProperty("overflow", "hidden");
}

function pointFromPointerEvent(
  container: DomElementLike,
  event: DomPointerEventLike,
): DomPoint {
  const rect = container.getBoundingClientRect();
  return {
    x: Math.floor(event.clientX - rect.left),
    y: Math.floor(event.clientY - rect.top),
  };
}

function collectFocusableNodeIds(root: UINode): Set<number> {
  const nodeIds = new Set<number>();

  visitNode(root, (node) => {
    if (node.kind === "view" && node.spec.focusable) {
      nodeIds.add(node.id);
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

function findNodeById(root: UINode, nodeId: NodeId): UINode | null {
  if (root.id === nodeId) {
    return root;
  }

  for (const child of root.children) {
    const match = findNodeById(child, nodeId);
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
  delta: ScrollOffset,
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

function findHitByNodeId(tree: RenderTree, nodeId: number): RenderHit | null {
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
  nodeId: number,
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

function isPointerEventLike(value: unknown): value is DomPointerEventLike {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).clientX === "number" &&
    typeof (value as Record<string, unknown>).clientY === "number"
  );
}

function isWheelEventLike(value: unknown): value is DomWheelEventLike {
  const record = value as unknown as {
    deltaX?: unknown;
    deltaY?: unknown;
  };

  return (
    isPointerEventLike(value) &&
    typeof record.deltaX === "number" &&
    typeof record.deltaY === "number"
  );
}

function isKeyboardEventLike(value: unknown): value is DomKeyboardEventLike {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).key === "string"
  );
}
