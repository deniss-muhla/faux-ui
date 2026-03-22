import { layoutNode } from "./layout.js";
import {
  assertBoundedConstraints,
  type BoundedConstraints,
  type Size,
} from "./types.js";
import type { NodeId, Rect, TextNode, UINode, ViewNode } from "./ui-node.js";
import { clearPaintDirtySubtree } from "./ui-node.js";

export interface Point {
  x: number;
  y: number;
}

export interface ScrollOffset {
  x: number;
  y: number;
}

export interface RenderTreeOptions {
  constraints: BoundedConstraints;
  scrollOffsets?: ReadonlyMap<NodeId, ScrollOffset>;
}

type RenderTreeNodeBase<TNode extends UINode> = {
  node: TNode;
  nodeId: NodeId;
  frame: Rect;
  clipRect: Rect;
  contentSize: Size;
  scrollOffset: ScrollOffset;
  children: RenderTreeNode[];
};

export type RenderTextNode = RenderTreeNodeBase<TextNode> & {
  kind: "text";
};

export type RenderViewNode = RenderTreeNodeBase<ViewNode> & {
  kind: "view";
};

export type RenderTreeNode = RenderTextNode | RenderViewNode;

export interface RenderTree {
  size: Size;
  root: RenderTreeNode;
}

export interface RenderHit {
  node: RenderTreeNode;
  path: RenderTreeNode[];
  localPoint: Point;
}

type RenderTreeCacheEntry = {
  constraints: BoundedConstraints;
  scrollOffsets: ReadonlyMap<NodeId, ScrollOffset>;
  subtreeRevision: number;
  tree: RenderTree;
};

const ZERO_SCROLL_OFFSET: ScrollOffset = { x: 0, y: 0 };
const EMPTY_SCROLL_OFFSETS = new Map<NodeId, ScrollOffset>();
const renderTreeCache = new WeakMap<UINode, RenderTreeCacheEntry>();

export function buildRenderTree(
  root: UINode,
  options: RenderTreeOptions,
): RenderTree {
  const cached = renderTreeCache.get(root);
  if (cached !== undefined && canReuseRenderTree(root, options, cached)) {
    return cached.tree;
  }

  const viewport = assertBoundedConstraints(
    options.constraints,
    "root constraints",
  );
  const size = layoutNode(root, viewport);
  const frame =
    root.kind === "view"
      ? { x: 0, y: 0, width: viewport.maxWidth, height: viewport.maxHeight }
      : { x: 0, y: 0, width: size.width, height: size.height };
  const tree = {
    size: { width: frame.width, height: frame.height },
    root: buildRenderNode(
      root,
      options.scrollOffsets ?? EMPTY_SCROLL_OFFSETS,
      frame,
      frame,
    ),
  };

  clearPaintDirtySubtree(root);
  renderTreeCache.set(root, {
    constraints: cloneConstraints(options.constraints),
    scrollOffsets: cloneScrollOffsets(options.scrollOffsets),
    subtreeRevision: root.subtreeRevision,
    tree,
  });

  return tree;
}

export function hitTestRenderTree(
  tree: RenderTree,
  point: Point,
): RenderHit | null {
  return hitTestRenderNode(tree.root, point);
}

export function hitTestRenderNode(
  node: RenderTreeNode,
  point: Point,
): RenderHit | null {
  if (!containsPoint(node.clipRect, point)) {
    return null;
  }

  for (let index = node.children.length - 1; index >= 0; index -= 1) {
    const child = node.children[index];
    if (child === undefined) {
      continue;
    }

    const hit = hitTestRenderNode(child, point);
    if (hit !== null) {
      return {
        ...hit,
        path: [node, ...hit.path],
      };
    }
  }

  return {
    node,
    path: [node],
    localPoint: {
      x: point.x - node.frame.x,
      y: point.y - node.frame.y,
    },
  };
}

function buildRenderNode(
  node: UINode,
  scrollOffsets: ReadonlyMap<NodeId, ScrollOffset>,
  frame: Rect,
  clipRect: Rect,
): RenderTreeNode {
  const contentSize = resolveContentSize(node, frame);

  if (node.kind === "text") {
    return {
      kind: "text",
      node,
      nodeId: node.id,
      frame,
      clipRect,
      contentSize,
      scrollOffset: ZERO_SCROLL_OFFSET,
      children: [],
    };
  }

  const scrollOffset = scrollOffsets.get(node.id) ?? ZERO_SCROLL_OFFSET;
  const children: RenderTreeNode[] = [];

  node.children.forEach((child, index) => {
    const childFrame = node.layout.childFrames?.[index];
    if (childFrame === undefined) {
      return;
    }

    const absoluteFrame = {
      x: frame.x + childFrame.x - scrollOffset.x,
      y: frame.y + childFrame.y - scrollOffset.y,
      width: childFrame.width,
      height: childFrame.height,
    };
    const childClip = intersectRects(clipRect, absoluteFrame);

    if (childClip === null) {
      return;
    }

    children.push(
      buildRenderNode(child, scrollOffsets, absoluteFrame, childClip),
    );
  });

  return {
    kind: "view",
    node,
    nodeId: node.id,
    frame,
    clipRect,
    contentSize,
    scrollOffset,
    children,
  };
}

function resolveContentSize(node: UINode, frame: Rect): Size {
  const contentSize = node.layout.contentSize ?? node.layout.cachedSize;

  return contentSize === undefined
    ? { width: frame.width, height: frame.height }
    : { width: contentSize.width, height: contentSize.height };
}

function canReuseRenderTree(
  root: UINode,
  options: RenderTreeOptions,
  cached: RenderTreeCacheEntry,
): boolean {
  return (
    !root.dirtyPaint &&
    cached.subtreeRevision === root.subtreeRevision &&
    sameConstraints(cached.constraints, options.constraints) &&
    sameScrollOffsets(cached.scrollOffsets, options.scrollOffsets)
  );
}

function sameConstraints(
  left: BoundedConstraints,
  right: BoundedConstraints,
): boolean {
  return left.maxWidth === right.maxWidth && left.maxHeight === right.maxHeight;
}

function sameScrollOffsets(
  left: ReadonlyMap<NodeId, ScrollOffset>,
  right: ReadonlyMap<NodeId, ScrollOffset> | undefined,
): boolean {
  const rightSize = right?.size ?? 0;
  if (left.size !== rightSize) {
    return false;
  }

  for (const [nodeId, leftOffset] of left) {
    const rightOffset = right?.get(nodeId);
    if (
      rightOffset === undefined ||
      leftOffset.x !== rightOffset.x ||
      leftOffset.y !== rightOffset.y
    ) {
      return false;
    }
  }

  return true;
}

function cloneConstraints(constraints: BoundedConstraints): BoundedConstraints {
  return {
    maxWidth: constraints.maxWidth,
    maxHeight: constraints.maxHeight,
  };
}

function cloneScrollOffsets(
  scrollOffsets: ReadonlyMap<NodeId, ScrollOffset> | undefined,
): ReadonlyMap<NodeId, ScrollOffset> {
  if (scrollOffsets === undefined || scrollOffsets.size === 0) {
    return EMPTY_SCROLL_OFFSETS;
  }

  const next = new Map<NodeId, ScrollOffset>();
  for (const [nodeId, offset] of scrollOffsets) {
    next.set(nodeId, { x: offset.x, y: offset.y });
  }

  return next;
}

function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}

function intersectRects(left: Rect, right: Rect): Rect | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  const width = rightEdge - x;
  const height = bottomEdge - y;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
}
