import {
  type LayoutResult,
  findLayoutNode,
} from "./layout.js";
import {
  type BoxNode,
  type EventHandlers,
  type FocusUiEvent,
  type KeyInput,
  type KeyUiEvent,
  type NodeId,
  type Point,
  type PointerInput,
  type PointerUiEvent,
  type PressUiEvent,
  type ScrollInput,
  type ScrollUiEvent,
  type SemanticNode,
  type UiEvent,
  findNode,
  nodePath,
  walkTree,
} from "./model.js";
import {
  type CellScene,
  clampScrollOffset,
  hitTestScene,
} from "./scene.js";

export interface ControllerSnapshot {
  readonly focusedId: NodeId | null;
  readonly hoveredIds: ReadonlySet<NodeId>;
  readonly offsets: ReadonlyMap<NodeId, Point>;
}

export interface DispatchResult {
  readonly handled: boolean;
  readonly defaultPrevented: boolean;
}

export interface EventTraceEntry {
  readonly type: string;
  readonly targetId: NodeId;
  readonly currentTargetId: NodeId;
}

export class InteractionController {
  #root: SemanticNode | null = null;
  #layout: LayoutResult | null = null;
  #scene: CellScene | null = null;
  #focusedId: NodeId | null = null;
  #hoverPath: NodeId[] = [];
  #activePressId: NodeId | null = null;
  #offsets = new Map<NodeId, Point>();
  #trace: EventTraceEntry[] = [];
  readonly #onChange: () => void;

  constructor(onChange: () => void = () => {}) {
    this.#onChange = onChange;
  }

  update(root: SemanticNode, layout: LayoutResult, scene: CellScene): void {
    const oldRoot = this.#root;
    const oldFocused =
      oldRoot === null || this.#focusedId === null
        ? null
        : findNode(oldRoot, this.#focusedId);

    this.#root = root;
    this.#layout = layout;
    this.#scene = scene;

    let changed = false;
    if (this.#focusedId !== null && !this.#isFocusable(this.#focusedId)) {
      if (oldFocused !== null) {
        this.#dispatchFocus(oldFocused, "blur", null);
      }
      this.#focusedId = null;
      changed = true;
    }

    const validIds = new Set(walkTree(root).map((node) => node.id));
    const nextHoverPath = this.#hoverPath.filter((id) => validIds.has(id));
    if (nextHoverPath.length !== this.#hoverPath.length) {
      this.#hoverPath = nextHoverPath;
      changed = true;
    }
    if (this.#activePressId !== null && !validIds.has(this.#activePressId)) {
      this.#activePressId = null;
    }

    for (const [id, requested] of this.#offsets) {
      const node = findNode(root, id);
      const nodeLayout = findLayoutNode(layout.root, id);
      if (node?.kind !== "box" || nodeLayout === null || node.scroll === null) {
        this.#offsets.delete(id);
        changed = true;
        continue;
      }
      const clamped = clampScrollOffset(node, nodeLayout, requested);
      if (!pointsEqual(requested, clamped)) {
        this.#offsets.set(id, clamped);
        changed = true;
      }
    }

    if (changed) this.#onChange();
  }

  snapshot(): ControllerSnapshot {
    return {
      focusedId: this.#focusedId,
      hoveredIds: new Set(this.#hoverPath),
      offsets: new Map(this.#offsets),
    };
  }

  eventTrace(): readonly EventTraceEntry[] {
    return [...this.#trace];
  }

  clearEventTrace(): void {
    this.#trace = [];
  }

  focus(nodeId: NodeId | null): boolean {
    if (nodeId === this.#focusedId) return false;
    if (nodeId !== null && !this.#isFocusable(nodeId)) return false;

    const previous = this.#node(this.#focusedId);
    const next = this.#node(nodeId);
    this.#focusedId = nodeId;

    if (previous !== null) this.#dispatchFocus(previous, "blur", next);
    if (next !== null) this.#dispatchFocus(next, "focus", previous);
    this.#onChange();
    return true;
  }

  focusNext(reverse = false): boolean {
    const order = this.#focusOrder();
    if (order.length === 0) return this.focus(null);
    const current = this.#focusedId === null ? -1 : order.indexOf(this.#focusedId);
    const nextIndex = reverse
      ? current <= 0
        ? order.length - 1
        : current - 1
      : current < 0 || current >= order.length - 1
        ? 0
        : current + 1;
    return this.focus(order[nextIndex] ?? null);
  }

  keyDown(input: KeyInput): DispatchResult {
    const target = this.#node(this.#focusedId) ?? this.#root;
    if (target === null) return { handled: false, defaultPrevented: false };

    const dispatched = this.#dispatchKey(target, "keyDown", input);
    let handled = dispatched.handled;
    let defaultPrevented = dispatched.defaultPrevented;

    const key = normalizeKey(input.key);
    if (!defaultPrevented && key === "Tab") {
      this.focusNext(input.shift === true);
      handled = true;
      defaultPrevented = true;
    } else if (!defaultPrevented && (key === "Enter" || key === "Space")) {
      const pressTarget = nearestPressTarget(target);
      if (pressTarget !== null) {
        const press = this.#dispatchPress(pressTarget, "keyboard");
        handled ||= press.handled;
        defaultPrevented ||= press.defaultPrevented;
      }
    } else if (!defaultPrevented && this.#scrollFromKey(target, key)) {
      handled = true;
      defaultPrevented = true;
    }

    return { handled, defaultPrevented };
  }

  keyUp(input: KeyInput): DispatchResult {
    const target = this.#node(this.#focusedId) ?? this.#root;
    return target === null
      ? { handled: false, defaultPrevented: false }
      : this.#dispatchKey(target, "keyUp", input);
  }

  pointerMove(input: PointerInput): DispatchResult {
    const target = this.#pointTarget(input);
    this.#setHoverTarget(target, input);
    if (target === null) return { handled: false, defaultPrevented: false };
    return this.#dispatchPointer(target, "pointerMove", input);
  }

  pointerDown(input: PointerInput): DispatchResult {
    const target = this.#pointTarget(input);
    this.#setHoverTarget(target, input);
    if (target === null) {
      this.focus(null);
      this.#activePressId = null;
      return { handled: false, defaultPrevented: false };
    }

    const focusTarget = nearestFocusable(target);
    if (focusTarget !== null) this.focus(focusTarget.id);
    const pressTarget = nearestPressTarget(target);
    this.#activePressId = input.button === undefined || input.button === 0
      ? pressTarget?.id ?? null
      : null;
    return this.#dispatchPointer(target, "pointerDown", input);
  }

  pointerUp(input: PointerInput): DispatchResult {
    const target = this.#pointTarget(input);
    this.#setHoverTarget(target, input);
    const pointer =
      target === null
        ? { handled: false, defaultPrevented: false }
        : this.#dispatchPointer(target, "pointerUp", input);

    let handled = pointer.handled;
    let defaultPrevented = pointer.defaultPrevented;
    const active = this.#node(this.#activePressId);
    this.#activePressId = null;
    if (
      active !== null &&
      target !== null &&
      nodePath(target).some((node) => node.id === active.id) &&
      (input.button === undefined || input.button === 0)
    ) {
      const press = this.#dispatchPress(active, "pointer");
      handled ||= press.handled;
      defaultPrevented ||= press.defaultPrevented;
    }
    return { handled, defaultPrevented };
  }

  pointerLeave(input: PointerInput): void {
    this.#setHoverTarget(null, input);
  }

  scroll(input: ScrollInput): DispatchResult {
    const target = this.#pointTarget(input) ?? this.#node(this.#focusedId);
    if (target === null) return { handled: false, defaultPrevented: false };
    const scrollTarget = nodePath(target).find(
      (node): node is BoxNode => node.kind === "box" && node.scroll !== null,
    );
    if (scrollTarget === undefined) {
      return { handled: false, defaultPrevented: false };
    }

    const previous = this.#offsets.get(scrollTarget.id) ?? { x: 0, y: 0 };
    const changed = this.setScrollOffset(scrollTarget.id, {
      x: previous.x + input.deltaX,
      y: previous.y + input.deltaY,
    });
    const next = this.#offsets.get(scrollTarget.id) ?? { x: 0, y: 0 };
    const dispatched = this.#dispatchScroll(
      scrollTarget,
      previous,
      next,
      input.deltaX,
      input.deltaY,
    );
    return {
      handled: changed || dispatched.handled,
      defaultPrevented: changed || dispatched.defaultPrevented,
    };
  }

  setScrollOffset(nodeId: NodeId, requested: Point): boolean {
    const node = this.#node(nodeId);
    const layout =
      this.#layout === null ? null : findLayoutNode(this.#layout.root, nodeId);
    if (node?.kind !== "box" || node.scroll === null || layout === null) {
      return false;
    }
    const previous = this.#offsets.get(nodeId) ?? { x: 0, y: 0 };
    const next = clampScrollOffset(node, layout, requested);
    if (pointsEqual(previous, next)) return false;
    this.#offsets.set(nodeId, next);
    this.#onChange();
    return true;
  }

  #setHoverTarget(target: SemanticNode | null, input: PointerInput): void {
    const previous = this.#hoverPath;
    const next = target === null ? [] : nodePath(target).map((node) => node.id);
    if (arraysEqual(previous, next)) return;

    const nextSet = new Set(next);
    const previousSet = new Set(previous);
    for (const id of previous) {
      if (nextSet.has(id)) continue;
      const node = this.#node(id);
      if (node !== null) this.#dispatchPointerDirect(node, "pointerLeave", input);
    }
    for (const id of next.toReversed()) {
      if (previousSet.has(id)) continue;
      const node = this.#node(id);
      if (node !== null) this.#dispatchPointerDirect(node, "pointerEnter", input);
    }
    this.#hoverPath = next;
    this.#onChange();
  }

  #dispatchKey(
    target: SemanticNode,
    type: "keyDown" | "keyUp",
    input: KeyInput,
  ): DispatchResult {
    return this.#dispatch(target, type, (current, shared) => ({
      ...sharedEvent(type, target, current, shared),
      key: normalizeKey(input.key),
      alt: input.alt ?? false,
      ctrl: input.ctrl ?? false,
      meta: input.meta ?? false,
      shift: input.shift ?? false,
      repeat: input.repeat ?? false,
    }) satisfies KeyUiEvent);
  }

  #dispatchPress(
    target: SemanticNode,
    source: "keyboard" | "pointer",
  ): DispatchResult {
    return this.#dispatch(target, "press", (current, shared) => ({
      ...sharedEvent("press", target, current, shared),
      source,
    }) satisfies PressUiEvent);
  }

  #dispatchPointer(
    target: SemanticNode,
    type: "pointerDown" | "pointerUp" | "pointerMove",
    input: PointerInput,
  ): DispatchResult {
    return this.#dispatch(target, type, (current, shared) => ({
      ...sharedEvent(type, target, current, shared),
      x: input.x,
      y: input.y,
      button: input.button ?? 0,
      buttons: input.buttons ?? 0,
      alt: input.alt ?? false,
      ctrl: input.ctrl ?? false,
      meta: input.meta ?? false,
      shift: input.shift ?? false,
    }) satisfies PointerUiEvent);
  }

  #dispatchPointerDirect(
    target: SemanticNode,
    type: "pointerEnter" | "pointerLeave",
    input: PointerInput,
  ): void {
    const shared = createSharedEventState();
    const event = {
      ...sharedEvent(type, target, target, shared),
      x: input.x,
      y: input.y,
      button: input.button ?? 0,
      buttons: input.buttons ?? 0,
      alt: input.alt ?? false,
      ctrl: input.ctrl ?? false,
      meta: input.meta ?? false,
      shift: input.shift ?? false,
    } satisfies PointerUiEvent;
    this.#trace.push({ type, targetId: target.id, currentTargetId: target.id });
    handlerFor(target.handlers, type)?.(event as never);
  }

  #dispatchScroll(
    target: SemanticNode,
    previousOffset: Point,
    offset: Point,
    deltaX: number,
    deltaY: number,
  ): DispatchResult {
    return this.#dispatch(target, "scroll", (current, shared) => ({
      ...sharedEvent("scroll", target, current, shared),
      previousOffset,
      offset,
      deltaX,
      deltaY,
    }) satisfies ScrollUiEvent);
  }

  #dispatchFocus(
    target: SemanticNode,
    type: "focus" | "blur",
    relatedTarget: SemanticNode | null,
  ): DispatchResult {
    return this.#dispatch(target, type, (current, shared) => ({
      ...sharedEvent(type, target, current, shared),
      relatedTarget: relatedTarget === null ? null : eventTarget(relatedTarget),
    }) satisfies FocusUiEvent);
  }

  #dispatch<TEvent extends UiEvent>(
    target: SemanticNode,
    type: keyof HandlerMap,
    createEvent: (currentTarget: SemanticNode, state: SharedEventState) => TEvent,
  ): DispatchResult {
    const shared = createSharedEventState();
    let handled = false;
    for (const current of nodePath(target)) {
      const handler = handlerFor(current.handlers, type);
      if (handler !== undefined) {
        handled = true;
        this.#trace.push({
          type,
          targetId: target.id,
          currentTargetId: current.id,
        });
        handler(createEvent(current, shared) as never);
      }
      if (shared.propagationStopped) break;
    }
    return { handled, defaultPrevented: shared.defaultPrevented };
  }

  #pointTarget(point: Point): SemanticNode | null {
    if (this.#root === null || this.#scene === null) return null;
    const id = hitTestScene(this.#scene, point);
    return id === null ? null : findNode(this.#root, id);
  }

  #node(id: NodeId | null): SemanticNode | null {
    return id === null || this.#root === null ? null : findNode(this.#root, id);
  }

  #isFocusable(id: NodeId | null): boolean {
    const node = this.#node(id);
    if (node?.kind !== "box" || !node.focusable || node.disabled) return false;
    if (this.#scene === null) return false;
    const owners = new Set(
      this.#scene.cells.flatMap((cell) =>
        cell.ownerId === null ? [] : [cell.ownerId],
      ),
    );
    for (const ownerId of owners) {
      const owner = this.#node(ownerId);
      if (owner !== null && nodePath(owner).some((entry) => entry.id === id)) {
        return true;
      }
    }
    return false;
  }

  #scrollFromKey(target: SemanticNode, key: string): boolean {
    const scrollTarget = nodePath(target).find(
      (node): node is BoxNode => node.kind === "box" && node.scroll !== null,
    );
    if (scrollTarget === undefined || this.#layout === null) return false;
    const layout = findLayoutNode(this.#layout.root, scrollTarget.id);
    if (layout === null) return false;
    const previous = this.#offsets.get(scrollTarget.id) ?? { x: 0, y: 0 };
    if (key === "ArrowUp") {
      return this.setScrollOffset(scrollTarget.id, { ...previous, y: previous.y - 1 });
    }
    if (key === "ArrowDown") {
      return this.setScrollOffset(scrollTarget.id, { ...previous, y: previous.y + 1 });
    }
    if (key === "ArrowLeft") {
      return this.setScrollOffset(scrollTarget.id, { ...previous, x: previous.x - 1 });
    }
    if (key === "ArrowRight") {
      return this.setScrollOffset(scrollTarget.id, { ...previous, x: previous.x + 1 });
    }
    if (key === "PageUp") {
      return this.setScrollOffset(scrollTarget.id, {
        ...previous,
        y: previous.y - layout.contentFrame.height,
      });
    }
    if (key === "PageDown") {
      return this.setScrollOffset(scrollTarget.id, {
        ...previous,
        y: previous.y + layout.contentFrame.height,
      });
    }
    if (key === "Home") {
      return this.setScrollOffset(scrollTarget.id, { x: 0, y: 0 });
    }
    if (key === "End") {
      return this.setScrollOffset(scrollTarget.id, {
        x: Number.MAX_SAFE_INTEGER,
        y: Number.MAX_SAFE_INTEGER,
      });
    }
    return false;
  }

  #focusOrder(): NodeId[] {
    if (this.#root === null) return [];
    return walkTree(this.#root)
      .filter((node) => this.#isFocusable(node.id))
      .map((node) => node.id);
  }
}

type HandlerMap = {
  focus: EventHandlers["onFocus"];
  blur: EventHandlers["onBlur"];
  keyDown: EventHandlers["onKeyDown"];
  keyUp: EventHandlers["onKeyUp"];
  press: EventHandlers["onPress"];
  pointerDown: EventHandlers["onPointerDown"];
  pointerUp: EventHandlers["onPointerUp"];
  pointerMove: EventHandlers["onPointerMove"];
  pointerEnter: EventHandlers["onPointerEnter"];
  pointerLeave: EventHandlers["onPointerLeave"];
  scroll: EventHandlers["onScroll"];
};

function handlerFor<TType extends keyof HandlerMap>(
  handlers: EventHandlers,
  type: TType,
): HandlerMap[TType] {
  const names: { [K in keyof HandlerMap]: keyof EventHandlers } = {
    focus: "onFocus",
    blur: "onBlur",
    keyDown: "onKeyDown",
    keyUp: "onKeyUp",
    press: "onPress",
    pointerDown: "onPointerDown",
    pointerUp: "onPointerUp",
    pointerMove: "onPointerMove",
    pointerEnter: "onPointerEnter",
    pointerLeave: "onPointerLeave",
    scroll: "onScroll",
  };
  return handlers[names[type]] as HandlerMap[TType];
}

interface SharedEventState {
  defaultPrevented: boolean;
  propagationStopped: boolean;
}

function createSharedEventState(): SharedEventState {
  return { defaultPrevented: false, propagationStopped: false };
}

function sharedEvent<TType extends string>(
  type: TType,
  target: SemanticNode,
  currentTarget: SemanticNode,
  state: SharedEventState,
): UiEvent<TType> {
  return {
    type,
    target: eventTarget(target),
    currentTarget: eventTarget(currentTarget),
    get defaultPrevented() {
      return state.defaultPrevented;
    },
    get propagationStopped() {
      return state.propagationStopped;
    },
    preventDefault(): void {
      state.defaultPrevented = true;
    },
    stopPropagation(): void {
      state.propagationStopped = true;
    },
  };
}

function eventTarget(node: SemanticNode) {
  return { kind: node.kind, accessibleLabel: node.accessibleLabel } as const;
}

function nearestFocusable(node: SemanticNode): BoxNode | null {
  return (
    nodePath(node).find(
      (candidate): candidate is BoxNode =>
        candidate.kind === "box" &&
        candidate.focusable &&
        !candidate.disabled,
    ) ?? null
  );
}

function nearestPressTarget(node: SemanticNode): SemanticNode | null {
  return (
    nodePath(node).find(
      (candidate) =>
        candidate.handlers.onPress !== undefined &&
        !(candidate.kind === "box" && candidate.disabled),
    ) ?? null
  );
}

function normalizeKey(key: string): string {
  if (key === " " || key === "Spacebar") return "Space";
  if (key === "Esc") return "Escape";
  if (key.length === 1) return key;
  return key;
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
