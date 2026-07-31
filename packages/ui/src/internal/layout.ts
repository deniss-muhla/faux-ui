import {
  type Align,
  type BoxNode,
  type Insets,
  type Rect,
  type SemanticNode,
  type Size,
  type Track,
  hasScrollAxis,
  normalizeSize,
} from "./model.js";
import { textPreferredSize } from "./unicode.js";

export interface PreferredNode {
  readonly nodeId: number;
  readonly kind: SemanticNode["kind"];
  readonly size: Size;
  readonly children: readonly PreferredNode[];
}

export interface LayoutNode {
  readonly nodeId: number;
  readonly kind: SemanticNode["kind"];
  readonly frame: Rect;
  readonly clip: Rect;
  readonly contentFrame: Rect;
  readonly contentSize: Size;
  readonly children: readonly LayoutNode[];
}

export interface LayoutResult {
  readonly size: Size;
  readonly preferred: PreferredNode;
  readonly root: LayoutNode;
}

export function computePreferredTree(root: SemanticNode): PreferredNode {
  if (root.kind === "text") {
    return {
      nodeId: root.id,
      kind: root.kind,
      size: textPreferredSize(root.text),
      children: [],
    };
  }

  validateBoxShape(root);
  const children = root.children.map(computePreferredTree);
  const content = preferredBoxContent(root, children);
  const chrome = chromeSize(root);
  return {
    nodeId: root.id,
    kind: root.kind,
    size: {
      width: content.width + chrome.width,
      height: content.height + chrome.height,
    },
    children,
  };
}

export function computeLayout(root: SemanticNode, inputSize: Size): LayoutResult {
  const size = normalizeSize(inputSize);
  const preferred = computePreferredTree(root);
  const frame: Rect = { x: 0, y: 0, width: size.width, height: size.height };
  return {
    size,
    preferred,
    root: layoutNode(root, preferred, frame, frame),
  };
}

export function findLayoutNode(
  root: LayoutNode,
  nodeId: number,
): LayoutNode | null {
  if (root.nodeId === nodeId) return root;
  for (const child of root.children) {
    const found = findLayoutNode(child, nodeId);
    if (found !== null) return found;
  }
  return null;
}

export function intersectRects(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

export function containsPoint(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x < rect.x + rect.width &&
    y < rect.y + rect.height
  );
}

export function alignOffset(
  available: number,
  content: number,
  align: Align,
): number {
  const remainder = Math.max(0, available - content);
  if (align === "center") return Math.floor(remainder / 2);
  if (align === "end") return remainder;
  return 0;
}

function layoutNode(
  node: SemanticNode,
  preferred: PreferredNode,
  frame: Rect,
  parentClip: Rect,
): LayoutNode {
  const clip = intersectRects(frame, parentClip);
  if (node.kind === "text") {
    return {
      nodeId: node.id,
      kind: node.kind,
      frame,
      clip,
      contentFrame: frame,
      contentSize: preferred.size,
      children: [],
    };
  }

  const contentFrame = insetRect(frame, node.padding, node.border !== null);
  const childClip = intersectRects(clip, contentFrame);
  const childFrames = allocateChildFrames(node, preferred.children, contentFrame);
  const children = node.children.map((child, index) => {
    const childPreferred = preferred.children[index];
    const childFrame = childFrames[index];
    if (childPreferred === undefined || childFrame === undefined) {
      throw new Error(`Missing allocation for child ${index} of box ${node.id}.`);
    }
    return layoutNode(child, childPreferred, childFrame, childClip);
  });

  return {
    nodeId: node.id,
    kind: node.kind,
    frame,
    clip,
    contentFrame,
    contentSize: deriveContentSize(node, contentFrame, childFrames),
    children,
  };
}

function preferredBoxContent(
  box: BoxNode,
  children: readonly PreferredNode[],
): Size {
  if (box.axis === null) {
    return children[0]?.size ?? { width: 0, height: 0 };
  }

  const tracks = effectiveTracks(box);
  const mainSizes = children.map((child, index) => {
    const track = tracks[index] ?? "auto";
    return typeof track === "number"
      ? track
      : box.axis === "row"
        ? child.size.width
        : child.size.height;
  });
  const gap = box.gap * Math.max(0, children.length - 1);

  if (box.axis === "row") {
    return {
      width: sum(mainSizes) + gap,
      height: maximum(children.map((child) => child.size.height)),
    };
  }

  return {
    width: maximum(children.map((child) => child.size.width)),
    height: sum(mainSizes) + gap,
  };
}

function allocateChildFrames(
  box: BoxNode,
  children: readonly PreferredNode[],
  contentFrame: Rect,
): Rect[] {
  if (children.length === 0) return [];

  if (box.axis === null) {
    const child = children[0];
    if (child === undefined) return [];
    const width = hasScrollAxis(box.scroll, "x")
      ? Math.max(contentFrame.width, child.size.width)
      : contentFrame.width;
    const height = hasScrollAxis(box.scroll, "y")
      ? Math.max(contentFrame.height, child.size.height)
      : contentFrame.height;
    return [
      {
        x: contentFrame.x,
        y: contentFrame.y,
        width,
        height,
      },
    ];
  }

  const tracks = effectiveTracks(box);
  const availableMain =
    box.axis === "row" ? contentFrame.width : contentFrame.height;
  const gapCost = box.gap * Math.max(0, children.length - 1);
  const resolved = resolveTracks(
    tracks,
    children.map((child) =>
      box.axis === "row" ? child.size.width : child.size.height,
    ),
    Math.max(0, availableMain - gapCost),
  );

  const output: Rect[] = [];
  let cursor = box.axis === "row" ? contentFrame.x : contentFrame.y;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const main = resolved[index] ?? 0;
    if (child === undefined) continue;

    if (box.axis === "row") {
      output.push({
        x: cursor,
        y: contentFrame.y,
        width: main,
        height: hasScrollAxis(box.scroll, "y")
          ? Math.max(contentFrame.height, child.size.height)
          : contentFrame.height,
      });
    } else {
      output.push({
        x: contentFrame.x,
        y: cursor,
        width: hasScrollAxis(box.scroll, "x")
          ? Math.max(contentFrame.width, child.size.width)
          : contentFrame.width,
        height: main,
      });
    }
    cursor += main + box.gap;
  }
  return output;
}

function resolveTracks(
  tracks: readonly Track[],
  preferredMain: readonly number[],
  available: number,
): number[] {
  const resolved = tracks.map((track, index) => {
    if (typeof track === "number") return track;
    if (track === "auto") return preferredMain[index] ?? 0;
    return 0;
  });

  const remaining = Math.max(0, available - sum(resolved));
  const fractionIndexes = tracks.flatMap((track, index) =>
    typeof track === "string" && track.endsWith("fr") ? [index] : [],
  );
  const totalWeight = fractionIndexes.reduce(
    (total, index) => total + fractionWeight(tracks[index]),
    0,
  );

  if (remaining === 0 || totalWeight === 0) return resolved;

  for (const index of fractionIndexes) {
    resolved[index] = Math.floor(
      (remaining * fractionWeight(tracks[index])) / totalWeight,
    );
  }

  let remainder =
    remaining -
    fractionIndexes.reduce(
      (total, index) => total + (resolved[index] ?? 0),
      0,
    );
  for (const index of fractionIndexes) {
    if (remainder === 0) break;
    resolved[index] = (resolved[index] ?? 0) + 1;
    remainder -= 1;
  }

  return resolved;
}

function deriveContentSize(
  box: BoxNode,
  contentFrame: Rect,
  children: readonly Rect[],
): Size {
  let extentWidth = 0;
  let extentHeight = 0;
  for (const child of children) {
    extentWidth = Math.max(extentWidth, child.x + child.width - contentFrame.x);
    extentHeight = Math.max(
      extentHeight,
      child.y + child.height - contentFrame.y,
    );
  }

  return {
    width: hasScrollAxis(box.scroll, "x")
      ? Math.max(contentFrame.width, extentWidth)
      : extentWidth,
    height: hasScrollAxis(box.scroll, "y")
      ? Math.max(contentFrame.height, extentHeight)
      : extentHeight,
  };
}

function effectiveTracks(box: BoxNode): readonly Track[] {
  if (box.axis === null) return [];
  const tracks =
    box.tracks ?? box.children.map((): Track => "auto");
  if (tracks.length !== box.children.length) {
    throw new Error(
      `Box ${box.id} has ${box.children.length} children but ${tracks.length} tracks.`,
    );
  }
  return tracks;
}

function validateBoxShape(box: BoxNode): void {
  if (box.axis === null) {
    if (box.children.length > 1) {
      throw new Error(`Box ${box.id} without an axis accepts at most one child.`);
    }
    if (box.tracks !== null) {
      throw new Error(`Box ${box.id} cannot define tracks without an axis.`);
    }
    return;
  }
  effectiveTracks(box);
}

function chromeSize(box: BoxNode): Size {
  const border = box.border === null ? 0 : 2;
  return {
    width: box.padding.left + box.padding.right + border,
    height: box.padding.top + box.padding.bottom + border,
  };
}

function insetRect(frame: Rect, padding: Insets, border: boolean): Rect {
  const borderSize = border ? 1 : 0;
  const left = borderSize + padding.left;
  const top = borderSize + padding.top;
  const right = borderSize + padding.right;
  const bottom = borderSize + padding.bottom;
  return {
    x: frame.x + Math.min(frame.width, left),
    y: frame.y + Math.min(frame.height, top),
    width: Math.max(0, frame.width - left - right),
    height: Math.max(0, frame.height - top - bottom),
  };
}

function fractionWeight(track: Track | undefined): number {
  return typeof track === "string" && track.endsWith("fr")
    ? Number.parseFloat(track.slice(0, -2))
    : 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function maximum(values: readonly number[]): number {
  return values.reduce((current, value) => Math.max(current, value), 0);
}
