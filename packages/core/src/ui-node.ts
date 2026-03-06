import type { Constraints, Size, TrackShorthand } from "./types.js";

export type NodeId = number;
export type BindingToken = number;
export type ScrollAxis = "x" | "y" | "both";
export type SemanticColor =
  | "fg"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "bg"
  | "bgAlt"
  | "border"
  | "focus"
  | "selection"
  | "inverse";

export type StyleValue = {
  color?: SemanticColor;
  background?: SemanticColor;
};

export type BoundActions = {
  focus?: BindingToken;
  blur?: BindingToken;
  keyDown?: BindingToken;
  keyUp?: BindingToken;
  press?: BindingToken;
  click?: BindingToken;
  mouseDown?: BindingToken;
  mouseUp?: BindingToken;
  mouseEnter?: BindingToken;
  mouseLeave?: BindingToken;
  mouseMove?: BindingToken;
  scroll?: BindingToken;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutState = {
  cachedConstraints: Constraints | undefined;
  cachedSize: Size | undefined;
  cachedSubtreeRevision: number | undefined;
  contentSize: Size | undefined;
  rowSizes: number[] | undefined;
  columnSizes: number[] | undefined;
  childFrames: Rect[] | undefined;
  intrinsicVersion: number;
  layoutVersion: number;
};

export type LayoutComputation = {
  constraints?: Constraints;
  size: Size;
  contentSize?: Size;
  rowSizes?: number[];
  columnSizes?: number[];
  childFrames?: Rect[];
};

export type NormalizedViewSpec = {
  rows: TrackShorthand[] | null;
  columns: TrackShorthand[] | null;
  scroll: ScrollAxis | null;
  style: StyleValue | null;
  styleHover: StyleValue | null;
  styleFocus: StyleValue | null;
  focusable: boolean;
};

export type NormalizedTextSpec = {
  text: string;
  wrap: boolean;
  style: StyleValue | null;
};

export type UINode = ViewNode | TextNode;

export type UINodeBase = {
  id: NodeId;
  kind: "view" | "text";
  parent: UINode | null;
  children: UINode[];
  key: string | undefined;
  revision: number;
  subtreeRevision: number;
  dirtyLayout: boolean;
  dirtyIntrinsic: boolean;
  dirtyPaint: boolean;
  bindings: BoundActions | null;
  layout: LayoutState;
};

export type ViewNode = UINodeBase & {
  kind: "view";
  spec: NormalizedViewSpec;
};

export type TextNode = UINodeBase & {
  kind: "text";
  spec: NormalizedTextSpec;
};

export type ViewSpecPatch = Partial<NormalizedViewSpec>;
export type TextSpecPatch = Partial<NormalizedTextSpec>;

let nextNodeId = 1;

export function createViewNode(
  options: {
    id?: NodeId;
    key?: string;
    bindings?: BoundActions | null;
    spec?: Partial<NormalizedViewSpec>;
  } = {},
): ViewNode {
  const base = createNodeBase(options.id, options.key, options.bindings);

  return {
    ...base,
    kind: "view",
    spec: normalizeViewSpec(options.spec),
  };
}

export function createTextNode(options: {
  id?: NodeId;
  key?: string;
  bindings?: BoundActions | null;
  spec: NormalizedTextSpec;
}): TextNode {
  const base = createNodeBase(options.id, options.key, options.bindings);

  return {
    ...base,
    kind: "text",
    spec: normalizeTextSpec(options.spec),
  };
}

export function appendChild(parent: ViewNode, child: UINode): void {
  detachNode(child);
  child.parent = parent;
  parent.children.push(child);
  recordMutation(parent);
  markLayoutDirty(parent);
}

export function replaceChildren(parent: ViewNode, children: UINode[]): void {
  for (const child of parent.children) {
    child.parent = null;
  }

  parent.children = [];
  for (const child of children) {
    detachNode(child);
    child.parent = parent;
    parent.children.push(child);
  }

  recordMutation(parent);
  markLayoutDirty(parent);
}

export function detachNode(node: UINode): void {
  const parent = node.parent;
  if (parent === null) {
    return;
  }

  const nextChildren = parent.children.filter((child) => child !== node);
  if (nextChildren.length !== parent.children.length) {
    parent.children = nextChildren;
    recordMutation(parent);
    markLayoutDirty(parent);
  }

  node.parent = null;
}

export function updateViewNode(node: ViewNode, patch: ViewSpecPatch): boolean {
  let changed = false;
  let layoutChanged = false;
  let paintChanged = false;

  if (
    patch.rows !== undefined &&
    !sameTrackList(node.spec.rows, patch.rows ?? null)
  ) {
    node.spec.rows = cloneTrackList(patch.rows ?? null);
    changed = true;
    layoutChanged = true;
    paintChanged = true;
  }

  if (
    patch.columns !== undefined &&
    !sameTrackList(node.spec.columns, patch.columns ?? null)
  ) {
    node.spec.columns = cloneTrackList(patch.columns ?? null);
    changed = true;
    layoutChanged = true;
    paintChanged = true;
  }

  if (patch.scroll !== undefined && node.spec.scroll !== patch.scroll) {
    node.spec.scroll = patch.scroll ?? null;
    changed = true;
    layoutChanged = true;
    paintChanged = true;
  }

  if (
    patch.focusable !== undefined &&
    node.spec.focusable !== patch.focusable
  ) {
    node.spec.focusable = patch.focusable;
    changed = true;
    paintChanged = true;
  }

  if (
    patch.style !== undefined &&
    !sameStyle(node.spec.style, patch.style ?? null)
  ) {
    node.spec.style = cloneStyle(patch.style ?? null);
    changed = true;
    paintChanged = true;
  }

  if (
    patch.styleHover !== undefined &&
    !sameStyle(node.spec.styleHover, patch.styleHover ?? null)
  ) {
    node.spec.styleHover = cloneStyle(patch.styleHover ?? null);
    changed = true;
    paintChanged = true;
  }

  if (
    patch.styleFocus !== undefined &&
    !sameStyle(node.spec.styleFocus, patch.styleFocus ?? null)
  ) {
    node.spec.styleFocus = cloneStyle(patch.styleFocus ?? null);
    changed = true;
    paintChanged = true;
  }

  if (!changed) {
    return false;
  }

  recordMutation(node);
  if (layoutChanged) {
    markLayoutDirty(node);
  }
  if (paintChanged) {
    markPaintDirty(node);
  }

  return true;
}

export function updateTextNode(node: TextNode, patch: TextSpecPatch): boolean {
  let changed = false;
  let intrinsicChanged = false;
  let paintChanged = false;

  if (patch.text !== undefined && node.spec.text !== patch.text) {
    node.spec.text = patch.text;
    changed = true;
    intrinsicChanged = true;
    paintChanged = true;
  }

  if (patch.wrap !== undefined && node.spec.wrap !== patch.wrap) {
    node.spec.wrap = patch.wrap;
    changed = true;
    intrinsicChanged = true;
    paintChanged = true;
  }

  if (
    patch.style !== undefined &&
    !sameStyle(node.spec.style, patch.style ?? null)
  ) {
    node.spec.style = cloneStyle(patch.style ?? null);
    changed = true;
    paintChanged = true;
  }

  if (!changed) {
    return false;
  }

  recordMutation(node);
  if (intrinsicChanged) {
    markIntrinsicDirty(node);
  }
  if (paintChanged) {
    markPaintDirty(node);
  }

  return true;
}

export function setNodeBindings(
  node: UINode,
  bindings: BoundActions | null,
): boolean {
  if (sameBindings(node.bindings, bindings)) {
    return false;
  }

  node.bindings = cloneBindings(bindings);
  recordMutation(node);
  markPaintDirty(node);
  return true;
}

export function markIntrinsicDirty(node: UINode): void {
  node.dirtyIntrinsic = true;
  node.dirtyLayout = true;
  node.dirtyPaint = true;
}

export function markLayoutDirty(node: UINode): void {
  node.dirtyLayout = true;
  node.dirtyPaint = true;
}

export function markPaintDirty(node: UINode): void {
  for (
    let current: UINode | null = node;
    current !== null;
    current = current.parent
  ) {
    current.dirtyPaint = true;
  }
}

export function clearPaintDirtySubtree(node: UINode): void {
  node.dirtyPaint = false;
  for (const child of node.children) {
    clearPaintDirtySubtree(child);
  }
}

export function commitLayout(
  node: UINode,
  computation: LayoutComputation,
): void {
  node.layout.cachedConstraints = computation.constraints;
  node.layout.cachedSize = cloneSize(computation.size);
  node.layout.cachedSubtreeRevision = node.subtreeRevision;
  node.layout.contentSize =
    computation.contentSize === undefined
      ? undefined
      : cloneSize(computation.contentSize);
  node.layout.rowSizes =
    computation.rowSizes === undefined ? undefined : [...computation.rowSizes];
  node.layout.columnSizes =
    computation.columnSizes === undefined
      ? undefined
      : [...computation.columnSizes];
  node.layout.childFrames =
    computation.childFrames === undefined
      ? undefined
      : computation.childFrames.map(cloneRect);
  node.layout.layoutVersion += 1;
  if (node.dirtyIntrinsic) {
    node.layout.intrinsicVersion += 1;
  }
  node.dirtyIntrinsic = false;
  node.dirtyLayout = false;
}

export function clearPaintDirty(node: UINode): void {
  node.dirtyPaint = false;
}

function createNodeBase(
  id?: NodeId,
  key?: string,
  bindings?: BoundActions | null,
): Omit<UINodeBase, "kind"> {
  return {
    id: id ?? allocateNodeId(),
    parent: null,
    children: [],
    key,
    revision: 0,
    subtreeRevision: 0,
    dirtyLayout: true,
    dirtyIntrinsic: true,
    dirtyPaint: true,
    bindings: cloneBindings(bindings ?? null),
    layout: {
      cachedConstraints: undefined,
      cachedSize: undefined,
      cachedSubtreeRevision: undefined,
      contentSize: undefined,
      rowSizes: undefined,
      columnSizes: undefined,
      childFrames: undefined,
      intrinsicVersion: 0,
      layoutVersion: 0,
    },
  };
}

function allocateNodeId(): NodeId {
  const id = nextNodeId;
  nextNodeId += 1;
  return id;
}

function normalizeViewSpec(
  spec: Partial<NormalizedViewSpec> | undefined,
): NormalizedViewSpec {
  return {
    rows: cloneTrackList(spec?.rows ?? null),
    columns: cloneTrackList(spec?.columns ?? null),
    scroll: spec?.scroll ?? null,
    style: cloneStyle(spec?.style ?? null),
    styleHover: cloneStyle(spec?.styleHover ?? null),
    styleFocus: cloneStyle(spec?.styleFocus ?? null),
    focusable: spec?.focusable ?? false,
  };
}

function normalizeTextSpec(spec: NormalizedTextSpec): NormalizedTextSpec {
  return {
    text: spec.text,
    wrap: spec.wrap,
    style: cloneStyle(spec.style ?? null),
  };
}

function recordMutation(node: UINode): void {
  node.revision += 1;
  for (
    let current: UINode | null = node;
    current !== null;
    current = current.parent
  ) {
    current.subtreeRevision += 1;
  }
}

function sameTrackList(
  left: TrackShorthand[] | null,
  right: TrackShorthand[] | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null || left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function sameStyle(left: StyleValue | null, right: StyleValue | null): boolean {
  return left?.color === right?.color && left?.background === right?.background;
}

function sameBindings(
  left: BoundActions | null,
  right: BoundActions | null,
): boolean {
  if (left === right) {
    return true;
  }

  const leftKeys = Object.keys(left ?? {});
  const rightKeys = Object.keys(right ?? {});
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    const token = left?.[key as keyof BoundActions];
    const nextToken = right?.[key as keyof BoundActions];
    if (token !== nextToken) {
      return false;
    }
  }

  return true;
}

function cloneTrackList(
  value: TrackShorthand[] | null,
): TrackShorthand[] | null {
  return value === null ? null : [...value];
}

function cloneStyle(value: StyleValue | null): StyleValue | null {
  if (value === null) {
    return null;
  }

  const next: StyleValue = {};
  if (value.color !== undefined) {
    next.color = value.color;
  }
  if (value.background !== undefined) {
    next.background = value.background;
  }

  return next;
}

function cloneBindings(value: BoundActions | null): BoundActions | null {
  return value === null ? null : { ...value };
}

function cloneSize(size: Size): Size {
  return {
    width: size.width,
    height: size.height,
  };
}

function cloneRect(rect: Rect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}
