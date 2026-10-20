import {
  type LayoutNode,
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
  type Rect,
  type ScrollInput,
  type ScrollUiEvent,
  type SemanticNode,
  type UiEvent,
  findNode,
  hasScrollAxis,
  nodePath,
  walkTree,
} from "./model.js";
import { type CellScene, clampScrollOffset, hitTestScene } from "./scene.js";

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
  #selectedIds = new Set<NodeId>();
  #trace: EventTraceEntry[] = [];
  #disposed = false;
  readonly #onChange: () => void;

  constructor(onChange: () => void = () => {}) {
    this.#onChange = onChange;
  }

  /**
   * Reconciles controller state with the newest root, layout, and painted
   * scene. Visibility and focusability checks use that scene, so the caller
   * must paint one corrected scene and call this again when reconciliation
   * reports a paint-relevant change.
   *
   * Returns true when offsets, focus, hover, or press state changed. State
   * changes requested by dispatched handlers still notify `onChange`.
   */
  update(root: SemanticNode, layout: LayoutResult, scene: CellScene): boolean {
    if (this.#disposed) return false;
    const oldRoot = this.#root;
    const oldLayout = this.#layout;
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

    const nodes = walkTree(root);
    const validIds = new Set(nodes.map((node) => node.id));
    const nextHoverPath = this.#hoverPath.filter((id) => validIds.has(id));
    if (nextHoverPath.length !== this.#hoverPath.length) {
      this.#hoverPath = nextHoverPath;
      changed = true;
    }
    if (this.#activePressId !== null && !validIds.has(this.#activePressId)) {
      this.#activePressId = null;
    }

    for (const node of nodes) {
      if (
        node.kind !== "box" ||
        node.scroll === null ||
        node.followEnd === null
      ) {
        continue;
      }
      const nodeLayout = findLayoutNode(layout.root, node.id);
      if (nodeLayout === null) continue;
      const requested = this.#offsets.get(node.id) ?? { x: 0, y: 0 };
      const oldNodeLayout =
        oldLayout === null ? null : findLayoutNode(oldLayout.root, node.id);
      const previousEnd =
        oldNodeLayout === null ? null : scrollEndOffset(node, oldNodeLayout);
      const nextEnd = scrollEndOffset(node, nodeLayout);
      const next = {
        x:
          hasScrollAxis(node.followEnd, "x") &&
          (previousEnd === null || requested.x === previousEnd.x)
            ? nextEnd.x
            : requested.x,
        y:
          hasScrollAxis(node.followEnd, "y") &&
          (previousEnd === null || requested.y === previousEnd.y)
            ? nextEnd.y
            : requested.y,
      };
      if (!pointsEqual(requested, next)) {
        this.#offsets.set(node.id, next);
        changed = true;
      }
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

    // A control that becomes the single selected control in each of its
    // scrolling ancestors is revealed the way a focused one is, so a list whose
    // selection moves without focus still paints it. Ids are remembered instead
    // of read from the previous tree because the reconciler updates node objects
    // in place, and a node revealed once is not revealed again, so scrolling
    // away from a selection holds until the selection itself moves. A region
    // holding several selected controls has no single selection to reveal and
    // keeps the offset the caller scrolled it to. Reveal never moves focus.
    const selectedNodes = nodes.filter(
      (node): node is BoxNode => node.kind === "box" && node.selected,
    );
    const selectedPerRegion = new Map<NodeId, number>();
    for (const node of selectedNodes) {
      for (const ancestor of nodePath(node)) {
        if (ancestor.kind !== "box" || ancestor.scroll === null) continue;
        selectedPerRegion.set(
          ancestor.id,
          (selectedPerRegion.get(ancestor.id) ?? 0) + 1,
        );
      }
    }
    for (const node of selectedNodes) {
      if (this.#selectedIds.has(node.id)) continue;
      const exclusive = nodePath(node).every(
        (ancestor) =>
          ancestor.kind !== "box" ||
          ancestor.scroll === null ||
          selectedPerRegion.get(ancestor.id) === 1,
      );
      if (exclusive && this.#applyReveal(node)) changed = true;
    }
    this.#selectedIds = new Set(selectedNodes.map((node) => node.id));

    return changed;
  }

  clear(): void {
    this.#root = null;
    this.#layout = null;
    this.#scene = null;
    this.#focusedId = null;
    this.#hoverPath = [];
    this.#activePressId = null;
    this.#offsets.clear();
    this.#selectedIds.clear();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clear();
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
    // Focus may reach a control that no viewport currently shows, so reveal it
    // before handlers and the next paint observe the focused control.
    if (next !== null) this.#applyReveal(next);

    if (previous !== null) this.#dispatchFocus(previous, "blur", next);
    if (next !== null) this.#dispatchFocus(next, "focus", previous);
    this.#onChange();
    return true;
  }

  focusNext(reverse = false): boolean {
    const order = this.#focusOrder();
    if (order.length === 0) return this.focus(null);
    const current =
      this.#focusedId === null ? -1 : order.indexOf(this.#focusedId);
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
    this.#activePressId =
      input.button === undefined || input.button === 0
        ? (pressTarget?.id ?? null)
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
    const candidates = nodePath(target).filter(
      (node): node is BoxNode => node.kind === "box" && node.scroll !== null,
    );
    const first = candidates[0];
    if (first === undefined) {
      return { handled: false, defaultPrevented: false };
    }

    // Wheel chaining. Each region consumes the part of the delta its clamped
    // offset allows and passes the remainder to the next scrollable ancestor,
    // so a region that moves only part of the delta, such as an inner list one
    // cell from its end, does not swallow the rest. A region that cannot move
    // passes the whole delta on.
    let remaining = { x: input.deltaX, y: input.deltaY };
    let moved = false;
    for (const candidate of candidates) {
      if (remaining.x === 0 && remaining.y === 0) break;
      const previous = this.#offsets.get(candidate.id) ?? { x: 0, y: 0 };
      const next = this.#clampedScrollOffset(candidate.id, {
        x: previous.x + remaining.x,
        y: previous.y + remaining.y,
      });
      if (next === null || pointsEqual(previous, next)) continue;
      const consumed = { x: next.x - previous.x, y: next.y - previous.y };
      this.setScrollOffset(candidate.id, next);
      remaining = {
        x: remaining.x - consumed.x,
        y: remaining.y - consumed.y,
      };
      moved = true;
      this.#dispatchScroll(candidate, previous, next, consumed.x, consumed.y);
    }

    if (moved) {
      return { handled: true, defaultPrevented: true };
    }

    const firstOffset = this.#offsets.get(first.id) ?? { x: 0, y: 0 };
    const dispatched = this.#dispatchScroll(
      first,
      firstOffset,
      firstOffset,
      input.deltaX,
      input.deltaY,
    );
    return {
      handled: dispatched.handled,
      defaultPrevented: dispatched.defaultPrevented,
    };
  }

  setScrollOffset(nodeId: NodeId, requested: Point): boolean {
    const next = this.#clampedScrollOffset(nodeId, requested);
    if (next === null) return false;
    const previous = this.#offsets.get(nodeId) ?? { x: 0, y: 0 };
    if (pointsEqual(previous, next)) return false;
    this.#offsets.set(nodeId, next);
    this.#onChange();
    return true;
  }

  /** The offset a scrolling box clamps `requested` to, or null when it cannot scroll. */
  #clampedScrollOffset(nodeId: NodeId, requested: Point): Point | null {
    const node = this.#node(nodeId);
    const layout =
      this.#layout === null ? null : findLayoutNode(this.#layout.root, nodeId);
    if (node?.kind !== "box" || node.scroll === null || layout === null) {
      return null;
    }
    return clampScrollOffset(node, layout, requested);
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
      if (node !== null)
        this.#dispatchPointerDirect(node, "pointerLeave", input);
    }
    for (const id of next.toReversed()) {
      if (previousSet.has(id)) continue;
      const node = this.#node(id);
      if (node !== null)
        this.#dispatchPointerDirect(node, "pointerEnter", input);
    }
    this.#hoverPath = next;
    this.#onChange();
  }

  #dispatchKey(
    target: SemanticNode,
    type: "keyDown" | "keyUp",
    input: KeyInput,
  ): DispatchResult {
    return this.#dispatch(
      target,
      type,
      (current, shared) =>
        ({
          ...sharedEvent(type, target, current, shared),
          key: normalizeKey(input.key),
          alt: input.alt ?? false,
          ctrl: input.ctrl ?? false,
          meta: input.meta ?? false,
          shift: input.shift ?? false,
          repeat: input.repeat ?? false,
        }) satisfies KeyUiEvent,
    );
  }

  #dispatchPress(
    target: SemanticNode,
    source: "keyboard" | "pointer",
  ): DispatchResult {
    return this.#dispatch(
      target,
      "press",
      (current, shared) =>
        ({
          ...sharedEvent("press", target, current, shared),
          source,
        }) satisfies PressUiEvent,
    );
  }

  #dispatchPointer(
    target: SemanticNode,
    type: "pointerDown" | "pointerUp" | "pointerMove",
    input: PointerInput,
  ): DispatchResult {
    return this.#dispatch(
      target,
      type,
      (current, shared) =>
        ({
          ...sharedEvent(type, target, current, shared),
          x: input.x,
          y: input.y,
          button: input.button ?? 0,
          buttons: input.buttons ?? 0,
          alt: input.alt ?? false,
          ctrl: input.ctrl ?? false,
          meta: input.meta ?? false,
          shift: input.shift ?? false,
        }) satisfies PointerUiEvent,
    );
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
    return this.#dispatch(
      target,
      "scroll",
      (current, shared) =>
        ({
          ...sharedEvent("scroll", target, current, shared),
          previousOffset,
          offset,
          deltaX,
          deltaY,
        }) satisfies ScrollUiEvent,
    );
  }

  #dispatchFocus(
    target: SemanticNode,
    type: "focus" | "blur",
    relatedTarget: SemanticNode | null,
  ): DispatchResult {
    return this.#dispatch(
      target,
      type,
      (current, shared) =>
        ({
          ...sharedEvent(type, target, current, shared),
          relatedTarget:
            relatedTarget === null ? null : eventTarget(relatedTarget),
        }) satisfies FocusUiEvent,
    );
  }

  #dispatch<TEvent extends UiEvent>(
    target: SemanticNode,
    type: keyof HandlerMap,
    createEvent: (
      currentTarget: SemanticNode,
      state: SharedEventState,
    ) => TEvent,
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
    if (this.#hasPaintedCell(node.id)) return true;
    // Layout and offsets stay current between paints, so a control outside the
    // freshest scene is still visible or reachable when geometry says so. A
    // control clipped by a fixed non-scrolling ancestor stays unreachable.
    return (
      this.#paintedClip(node, this.#offsets) !== null ||
      this.#isReachableAfterScroll(node)
    );
  }

  #hasPaintedCell(id: NodeId): boolean {
    const owners = new Set(
      this.#scene?.cells.flatMap((cell) =>
        cell.ownerId === null ? [] : [cell.ownerId],
      ) ?? [],
    );
    for (const ownerId of owners) {
      const owner = this.#node(ownerId);
      if (owner !== null && nodePath(owner).some((entry) => entry.id === id)) {
        return true;
      }
    }
    return false;
  }

  #isReachableAfterScroll(node: SemanticNode): boolean {
    if (this.#layout === null) return false;
    const revealed = this.#revealOffsets(node, new Map(this.#offsets));
    if (revealed.size === 0) return false;
    return (
      this.#paintedClip(node, new Map([...this.#offsets, ...revealed])) !== null
    );
  }

  /** Applies a reveal and reports whether any ancestor offset moved. */
  #applyReveal(node: SemanticNode): boolean {
    const revealed = this.#revealOffsets(node, new Map(this.#offsets));
    for (const [id, offset] of revealed) {
      const ancestor = this.#node(id);
      const previous = this.#offsets.get(id) ?? { x: 0, y: 0 };
      this.#offsets.set(id, offset);
      // A reveal moves a scrolling region exactly as a wheel would, so it emits
      // the same scroll event with the delta it consumed. A consumer that paints
      // a position indicator from `onScroll` would otherwise keep reporting the
      // offset the scene no longer shows.
      if (ancestor !== null) {
        this.#dispatchScroll(
          ancestor,
          previous,
          offset,
          offset.x - previous.x,
          offset.y - previous.y,
        );
      }
    }
    return revealed.size > 0;
  }

  /**
   * Smallest per-ancestor offset change that shows `node` inside every
   * scrolling ancestor, innermost first. Returns only the changed entries so
   * a caller can simulate the result before applying it.
   */
  #revealOffsets(
    node: SemanticNode,
    start: ReadonlyMap<NodeId, Point>,
  ): Map<NodeId, Point> {
    const revealed = new Map<NodeId, Point>();
    if (this.#layout === null) return revealed;
    let offsets = start;
    const path = nodePath(node);
    for (let index = path.length - 1; index >= 1; index -= 1) {
      const ancestor = path[index];
      if (ancestor?.kind !== "box" || ancestor.scroll === null) continue;
      const layout = findLayoutNode(this.#layout.root, ancestor.id);
      const frame = this.#revealedFrame(node, ancestor.id, offsets);
      if (layout === null || frame === null) continue;
      const previous = offsets.get(ancestor.id) ?? { x: 0, y: 0 };
      const next = revealOffset(ancestor, layout, frame, previous);
      if (pointsEqual(previous, next)) continue;
      revealed.set(ancestor.id, next);
      offsets = new Map([...offsets, [ancestor.id, next]]);
    }
    return revealed;
  }

  /**
   * Frame `node` occupies inside one ancestor's content coordinates, meaning
   * its layout frame translated by the offsets of the scrolling nodes strictly
   * between it and that ancestor.
   */
  #revealedFrame(
    node: SemanticNode,
    ancestorId: NodeId,
    offsets: ReadonlyMap<NodeId, Point>,
  ): Rect | null {
    const frame = this.#frameOf(node.id);
    if (frame === null) return null;
    let x = frame.x;
    let y = frame.y;
    for (const current of nodePath(node)) {
      if (current.id === ancestorId) break;
      if (current.id === node.id || current.kind !== "box") continue;
      if (current.scroll === null) continue;
      const offset = offsets.get(current.id) ?? { x: 0, y: 0 };
      x -= offset.x;
      y -= offset.y;
    }
    return { x, y, width: frame.width, height: frame.height };
  }

  /**
   * Clip `node` would paint inside for a given offset state, following the same
   * frame, content-frame, and ancestor clipping order as scene painting.
   * Returns null when the node paints no cell.
   */
  #paintedClip(
    node: SemanticNode,
    offsets: ReadonlyMap<NodeId, Point>,
  ): Rect | null {
    if (this.#layout === null) return null;
    let clip: Rect = {
      x: 0,
      y: 0,
      width: this.#layout.size.width,
      height: this.#layout.size.height,
    };
    let translateX = 0;
    let translateY = 0;
    for (const current of nodePath(node).toReversed()) {
      const frame = this.#frameOf(current.id);
      if (frame === null) return null;
      clip = intersectRects(clip, translateRect(frame, translateX, translateY));
      if (clip.width === 0 || clip.height === 0) return null;
      if (current.kind === "box") {
        const content = this.#contentFrameOf(current.id);
        if (content !== null) {
          clip = intersectRects(
            clip,
            translateRect(content, translateX, translateY),
          );
          if (clip.width === 0 || clip.height === 0) return null;
        }
      }
      if (current.id === node.id) return clip;
      if (current.kind === "box" && current.scroll !== null) {
        const requested = offsets.get(current.id) ?? { x: 0, y: 0 };
        const layout = findLayoutNode(this.#layout.root, current.id);
        const offset =
          layout === null
            ? { x: 0, y: 0 }
            : clampScrollOffset(current, layout, requested);
        translateX -= offset.x;
        translateY -= offset.y;
      }
    }
    return null;
  }

  #frameOf(id: NodeId): Rect | null {
    if (this.#layout === null) return null;
    const layout = findLayoutNode(this.#layout.root, id);
    return layout === null ? null : layout.frame;
  }

  #contentFrameOf(id: NodeId): Rect | null {
    if (this.#layout === null) return null;
    const layout = findLayoutNode(this.#layout.root, id);
    return layout === null ? null : layout.contentFrame;
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
      return this.setScrollOffset(scrollTarget.id, {
        ...previous,
        y: previous.y - 1,
      });
    }
    if (key === "ArrowDown") {
      return this.setScrollOffset(scrollTarget.id, {
        ...previous,
        y: previous.y + 1,
      });
    }
    if (key === "ArrowLeft") {
      return this.setScrollOffset(scrollTarget.id, {
        ...previous,
        x: previous.x - 1,
      });
    }
    if (key === "ArrowRight") {
      return this.setScrollOffset(scrollTarget.id, {
        ...previous,
        x: previous.x + 1,
      });
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
    if (key === "Home" || key === "End") {
      // Home and End scroll the primary axis. When the vertical axis can
      // scroll, they move the vertical offset and return to the left edge, so
      // a horizontal offset left over from inspecting a long line cannot hide
      // the newest or oldest rows. A viewport whose vertical axis cannot
      // scroll keeps the horizontal behavior.
      const toEnd = key === "End";
      const requested = toEnd ? Number.MAX_SAFE_INTEGER : 0;
      const verticalScrolls =
        hasScrollAxis(scrollTarget.scroll, "y") &&
        layout.contentSize.height > layout.contentFrame.height;
      if (verticalScrolls) {
        return this.setScrollOffset(scrollTarget.id, { x: 0, y: requested });
      }
      if (hasScrollAxis(scrollTarget.scroll, "x")) {
        return this.setScrollOffset(scrollTarget.id, {
          ...previous,
          x: requested,
        });
      }
      if (hasScrollAxis(scrollTarget.scroll, "y")) {
        return this.setScrollOffset(scrollTarget.id, {
          ...previous,
          y: requested,
        });
      }
      return false;
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
        candidate.kind === "box" && candidate.focusable && !candidate.disabled,
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

function scrollEndOffset(node: BoxNode, layout: LayoutNode): Point {
  return clampScrollOffset(node, layout, {
    x: Number.MAX_SAFE_INTEGER,
    y: Number.MAX_SAFE_INTEGER,
  });
}

/**
 * Smallest clamped offset that brings `frame` fully inside the viewport of
 * `node`, keeping the other axis where it is.
 */
function revealOffset(
  node: BoxNode,
  layout: LayoutNode,
  frame: Rect,
  current: Point,
): Point {
  const requested = { ...current };
  if (hasScrollAxis(node.scroll, "x")) {
    const viewport = layout.contentFrame;
    if (frame.x < viewport.x + current.x) {
      requested.x = frame.x - viewport.x;
    } else if (
      frame.x + frame.width >
      viewport.x + current.x + viewport.width
    ) {
      requested.x = frame.x + frame.width - viewport.x - viewport.width;
    }
  }
  if (hasScrollAxis(node.scroll, "y")) {
    const viewport = layout.contentFrame;
    if (frame.y < viewport.y + current.y) {
      requested.y = frame.y - viewport.y;
    } else if (
      frame.y + frame.height >
      viewport.y + current.y + viewport.height
    ) {
      requested.y = frame.y + frame.height - viewport.y - viewport.height;
    }
  }
  return clampScrollOffset(node, layout, requested);
}

function translateRect(
  rect: Rect,
  translateX: number,
  translateY: number,
): Rect {
  return {
    x: rect.x + translateX,
    y: rect.y + translateY,
    width: rect.width,
    height: rect.height,
  };
}

function intersectRects(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
