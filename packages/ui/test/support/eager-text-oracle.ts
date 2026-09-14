import { InteractionController } from "../../src/internal/controller.js";
import type {
  LayoutNode,
  LayoutResult,
  PreferredNode,
} from "../../src/internal/layout.js";
import {
  type Align,
  type BoxNode,
  type Point,
  type Rect,
  type SemanticNode,
  type Size,
  type Track,
  hasScrollAxis,
} from "../../src/internal/model.js";
import type {
  Cell,
  CellScene,
  ResolvedStyle,
} from "../../src/internal/scene.js";
import {
  cellizeLine,
  type CellGrapheme,
  type TextOverflow,
} from "../../src/internal/unicode.js";

const DEFAULT_STYLE: ResolvedStyle = {
  foreground: "fg",
  background: "bg",
  bold: false,
  dim: false,
  inverse: false,
  underline: false,
};

/**
 * The pre-windowing text path, retained only as a correctness oracle for tests.
 * It eagerly splits and cellizes every line before it paints the visible scene.
 */
export interface EagerTextLineIndex {
  readonly start: number;
  readonly end: number;
  readonly newlineStart: number | null;
  readonly newlineEnd: number | null;
  readonly width: number;
}

export function eagerTextIndex(text: string): readonly EagerTextLineIndex[] {
  let offset = 0;
  return text.split("\n").map((line, index, lines) => {
    const start = offset;
    const end = start + line.length;
    offset = end;
    const hasNewline = index < lines.length - 1;
    const newlineStart = hasNewline ? end : null;
    const newlineEnd = hasNewline ? end + 1 : null;
    if (hasNewline) offset += 1;
    return {
      start,
      end,
      newlineStart,
      newlineEnd,
      width: eagerLineWidth(line),
    };
  });
}

export function renderEagerTextOracle(
  root: SemanticNode,
  size: Size,
  offsets: ReadonlyMap<number, Point> = new Map(),
): { readonly layout: LayoutResult; readonly scene: CellScene } {
  const layout = eagerLayout(root, size);
  return {
    layout,
    scene: eagerScene(root, layout, offsets),
  };
}

export class EagerTextOracleSession {
  readonly #root: SemanticNode;
  readonly #size: Size;
  readonly #controller: InteractionController;
  #layout: LayoutResult;
  #scene: CellScene;
  #dirty = false;

  constructor(root: SemanticNode, size: Size) {
    this.#root = root;
    this.#size = size;
    const initial = renderEagerTextOracle(root, size);
    this.#layout = initial.layout;
    this.#scene = initial.scene;
    this.#controller = new InteractionController(() => {
      this.#dirty = true;
    });
    this.#controller.update(root, this.#layout, this.#scene);
    this.#refresh();
  }

  get layout(): LayoutResult {
    this.#refresh();
    return this.#layout;
  }

  get scene(): CellScene {
    this.#refresh();
    return this.#scene;
  }

  get controller(): InteractionController {
    return this.#controller;
  }

  focusNext(): boolean {
    const changed = this.#controller.focusNext();
    this.#refresh();
    return changed;
  }

  keyDown(key: string): void {
    this.#controller.keyDown({ key });
    this.#refresh();
  }

  pointerMove(point: Point): void {
    this.#controller.pointerMove(point);
    this.#refresh();
  }

  pointerDown(point: Point): void {
    this.#controller.pointerDown({ ...point, button: 0 });
    this.#refresh();
  }

  pointerUp(point: Point): void {
    this.#controller.pointerUp({ ...point, button: 0 });
    this.#refresh();
  }

  scroll(point: Point, delta: Point): void {
    this.#controller.scroll({
      ...point,
      deltaX: delta.x,
      deltaY: delta.y,
    });
    this.#refresh();
  }

  setScrollOffset(nodeId: number, offset: Point): boolean {
    const changed = this.#controller.setScrollOffset(nodeId, offset);
    this.#refresh();
    return changed;
  }

  #refresh(): void {
    while (this.#dirty) {
      this.#dirty = false;
      const next = renderEagerTextOracle(
        this.#root,
        this.#size,
        this.#controller.snapshot().offsets,
      );
      this.#layout = next.layout;
      this.#scene = next.scene;
      this.#controller.update(this.#root, this.#layout, this.#scene);
    }
  }
}

function eagerLayout(root: SemanticNode, size: Size): LayoutResult {
  const preferred = preferredNode(root);
  const frame = { x: 0, y: 0, width: size.width, height: size.height };
  return {
    size: { ...size },
    preferred,
    root: allocatedNode(root, preferred, frame, frame),
  };
}

function preferredNode(node: SemanticNode): PreferredNode {
  if (node.kind === "text") {
    const lines = node.text.split("\n");
    return {
      nodeId: node.id,
      kind: "text",
      size: {
        width: lines.reduce(
          (maximum, line) => Math.max(maximum, eagerLineWidth(line)),
          0,
        ),
        height: lines.length,
      },
      children: [],
    };
  }

  const children = node.children.map(preferredNode);
  const childSizes = children.map((child) => child.size);
  let content: Size;
  if (node.layout !== null) {
    content = node.layout.preferred(childSizes.map((child) => ({ ...child })));
  } else if (node.axis === null) {
    content = childSizes[0] ?? { width: 0, height: 0 };
  } else {
    const tracks = effectiveTracks(node);
    const main = childSizes.map((child, index) => {
      const track = tracks[index] ?? "auto";
      return typeof track === "number"
        ? track
        : node.axis === "row"
          ? child.width
          : child.height;
    });
    const gap = node.gap * Math.max(0, children.length - 1);
    content = node.axis === "row"
      ? {
          width: sum(main) + gap,
          height: maximum(childSizes.map((child) => child.height)),
        }
      : {
          width: maximum(childSizes.map((child) => child.width)),
          height: sum(main) + gap,
        };
  }

  const border = node.border === null ? 0 : 2;
  return {
    nodeId: node.id,
    kind: "box",
    size: {
      width: content.width + node.padding.left + node.padding.right + border,
      height: content.height + node.padding.top + node.padding.bottom + border,
    },
    children,
  };
}

function allocatedNode(
  node: SemanticNode,
  preferred: PreferredNode,
  frame: Rect,
  parentClip: Rect,
): LayoutNode {
  const clip = intersect(frame, parentClip);
  if (node.kind === "text") {
    return {
      nodeId: node.id,
      kind: "text",
      frame,
      clip,
      contentFrame: frame,
      contentSize: preferred.size,
      children: [],
    };
  }

  const contentFrame = inset(frame, node);
  const childClip = intersect(clip, contentFrame);
  const allocation = allocate(node, preferred.children, contentFrame);
  const children = node.children.map((child, index) => {
    const childPreferred = preferred.children[index];
    const childFrame = allocation.frames[index];
    if (childPreferred === undefined || childFrame === undefined) {
      throw new Error(`Eager oracle has no frame for child ${index}.`);
    }
    return allocatedNode(child, childPreferred, childFrame, childClip);
  });
  return {
    nodeId: node.id,
    kind: "box",
    frame,
    clip,
    contentFrame,
    contentSize: allocation.contentSize ?? contentExtent(node, contentFrame, allocation.frames),
    children,
  };
}

function allocate(
  box: BoxNode,
  children: readonly PreferredNode[],
  contentFrame: Rect,
): { readonly frames: readonly Rect[]; readonly contentSize?: Size } {
  if (box.layout !== null) {
    const output = box.layout.layout({
      size: { width: contentFrame.width, height: contentFrame.height },
      children: children.map((child) => ({ ...child.size })),
    });
    const frames = output.children.map((frame) => ({
      x: contentFrame.x + frame.x,
      y: contentFrame.y + frame.y,
      width: frame.width,
      height: frame.height,
    }));
    const derived = contentExtent(box, contentFrame, frames);
    return {
      frames,
      contentSize: output.contentSize === undefined
        ? derived
        : {
            width: Math.max(derived.width, output.contentSize.width),
            height: Math.max(derived.height, output.contentSize.height),
          },
    };
  }

  if (children.length === 0) return { frames: [] };
  if (box.axis === null) {
    const preferred = children[0]?.size ?? { width: 0, height: 0 };
    return {
      frames: [{
        ...contentFrame,
        width: hasScrollAxis(box.scroll, "x")
          ? Math.max(contentFrame.width, preferred.width)
          : contentFrame.width,
        height: hasScrollAxis(box.scroll, "y")
          ? Math.max(contentFrame.height, preferred.height)
          : contentFrame.height,
      }],
    };
  }

  const preferredMain = children.map((child) =>
    box.axis === "row" ? child.size.width : child.size.height
  );
  const available = box.axis === "row" ? contentFrame.width : contentFrame.height;
  const tracks = resolveTracks(
    effectiveTracks(box),
    preferredMain,
    Math.max(0, available - box.gap * Math.max(0, children.length - 1)),
  );
  let cursor = box.axis === "row" ? contentFrame.x : contentFrame.y;
  return {
    frames: children.map((child, index) => {
      const main = tracks[index] ?? 0;
      const frame = box.axis === "row"
        ? {
            x: cursor,
            y: contentFrame.y,
            width: main,
            height: hasScrollAxis(box.scroll, "y")
              ? Math.max(contentFrame.height, child.size.height)
              : contentFrame.height,
          }
        : {
            x: contentFrame.x,
            y: cursor,
            width: hasScrollAxis(box.scroll, "x")
              ? Math.max(contentFrame.width, child.size.width)
              : contentFrame.width,
            height: main,
          };
      cursor += main + box.gap;
      return frame;
    }),
  };
}

function eagerScene(
  root: SemanticNode,
  layout: LayoutResult,
  offsets: ReadonlyMap<number, Point>,
): CellScene {
  const cells: MutableCell[] = Array.from(
    { length: layout.size.width * layout.size.height },
    () => ({
      glyph: " ",
      continuation: false,
      style: DEFAULT_STYLE,
      ownerId: null,
    }),
  );
  const scene: MutableScene = { ...layout.size, cells };
  paintNode(
    scene,
    root,
    layout.root,
    { x: 0, y: 0, ...layout.size },
    { x: 0, y: 0 },
    DEFAULT_STYLE,
    offsets,
  );
  return scene;
}

function paintNode(
  scene: MutableScene,
  node: SemanticNode,
  layout: LayoutNode,
  parentClip: Rect,
  translation: Point,
  inheritedStyle: ResolvedStyle,
  offsets: ReadonlyMap<number, Point>,
): void {
  const frame = translate(layout.frame, translation);
  const clip = intersect(parentClip, frame);
  if (clip.width === 0 || clip.height === 0) return;
  const style = mergeStyle(inheritedStyle, node.style);
  fill(scene, frame, clip, style, node.id);

  if (node.kind === "text") {
    paintText(scene, node.text, node.overflow, node.alignX, node.alignY, frame, clip, style, node.id);
    return;
  }

  const contentFrame = translate(layout.contentFrame, translation);
  const contentClip = intersect(clip, contentFrame);
  if (contentClip.width === 0 || contentClip.height === 0) return;
  const requested = offsets.get(node.id) ?? { x: 0, y: 0 };
  const offset = clampOffset(node, layout, requested);
  const childTranslation = {
    x: translation.x - offset.x,
    y: translation.y - offset.y,
  };
  node.children.forEach((child, index) => {
    const childLayout = layout.children[index];
    if (childLayout !== undefined) {
      paintNode(
        scene,
        child,
        childLayout,
        contentClip,
        childTranslation,
        style,
        offsets,
      );
    }
  });
}

function paintText(
  scene: MutableScene,
  text: string,
  overflow: TextOverflow,
  alignX: Align,
  alignY: Align,
  frame: Rect,
  clip: Rect,
  style: ResolvedStyle,
  ownerId: number,
): void {
  const lines = text.split("\n");
  const count = Math.min(lines.length, frame.height);
  const y = frame.y + alignmentOffset(frame.height, count, alignY);
  for (let lineIndex = 0; lineIndex < count; lineIndex += 1) {
    const graphemes = eagerClip(
      cellizeLine(lines[lineIndex] ?? ""),
      frame.width,
      overflow,
    );
    const width = graphemes.reduce((total, grapheme) => total + grapheme.width, 0);
    let x = frame.x + alignmentOffset(frame.width, width, alignX);
    for (const grapheme of graphemes) {
      write(scene, x, y + lineIndex, grapheme, clip, style, ownerId);
      x += grapheme.width;
    }
  }
}

function eagerClip(
  graphemes: readonly CellGrapheme[],
  width: number,
  overflow: TextOverflow,
): CellGrapheme[] {
  if (eagerCellWidth(graphemes) <= width) return [...graphemes];
  if (overflow === "clip") return prefix(graphemes, width);
  if (width === 0) return [];
  const ellipsis = { glyph: "…", width: 1 as const };
  const remaining = width - 1;
  if (overflow === "ellipsis-start") {
    return [ellipsis, ...suffix(graphemes, remaining)];
  }
  if (overflow === "ellipsis-middle") {
    const left = Math.ceil(remaining / 2);
    return [...prefix(graphemes, left), ellipsis, ...suffix(graphemes, remaining - left)];
  }
  return [...prefix(graphemes, remaining), ellipsis];
}

function prefix(graphemes: readonly CellGrapheme[], width: number): CellGrapheme[] {
  const output: CellGrapheme[] = [];
  let used = 0;
  for (const grapheme of graphemes) {
    if (used + grapheme.width > width) break;
    output.push(grapheme);
    used += grapheme.width;
  }
  return output;
}

function suffix(graphemes: readonly CellGrapheme[], width: number): CellGrapheme[] {
  const output: CellGrapheme[] = [];
  let used = 0;
  for (let index = graphemes.length - 1; index >= 0; index -= 1) {
    const grapheme = graphemes[index];
    if (grapheme === undefined || used + grapheme.width > width) break;
    output.unshift(grapheme);
    used += grapheme.width;
  }
  return output;
}

function write(
  scene: MutableScene,
  x: number,
  y: number,
  grapheme: CellGrapheme,
  clip: Rect,
  style: ResolvedStyle,
  ownerId: number,
): void {
  if (!contains(clip, x, y)) return;
  if (grapheme.width === 2 && !contains(clip, x + 1, y)) return;
  if (x < 0 || y < 0 || x + grapheme.width > scene.width || y >= scene.height) return;
  setCell(scene, x, y, {
    glyph: grapheme.glyph,
    continuation: false,
    style,
    ownerId,
  });
  if (grapheme.width === 2) {
    setCell(scene, x + 1, y, {
      glyph: "",
      continuation: true,
      style,
      ownerId,
    });
  }
}

function fill(
  scene: MutableScene,
  frame: Rect,
  clip: Rect,
  style: ResolvedStyle,
  ownerId: number,
): void {
  const visible = intersect(frame, clip);
  for (let y = visible.y; y < visible.y + visible.height; y += 1) {
    for (let x = visible.x; x < visible.x + visible.width; x += 1) {
      setCell(scene, x, y, {
        glyph: " ",
        continuation: false,
        style,
        ownerId,
      });
    }
  }
}

function setCell(scene: MutableScene, x: number, y: number, cell: MutableCell): void {
  const index = y * scene.width + x;
  if (index >= 0 && index < scene.cells.length) scene.cells[index] = cell;
}

function resolveTracks(
  tracks: readonly Track[],
  preferred: readonly number[],
  available: number,
): number[] {
  const resolved = tracks.map((track, index) => {
    if (typeof track === "number") return track;
    return track === "auto" ? preferred[index] ?? 0 : 0;
  });
  const fractions = tracks.flatMap((track, index) =>
    typeof track === "string" && track.endsWith("fr") ? [index] : []
  );
  const remaining = Math.max(0, available - sum(resolved));
  const weight = sum(fractions.map((index) => fractionWeight(tracks[index])));
  fractions.forEach((index) => {
    resolved[index] = Math.floor(remaining * fractionWeight(tracks[index]) / weight);
  });
  let remainder = remaining - sum(fractions.map((index) => resolved[index] ?? 0));
  for (const index of fractions) {
    if (remainder === 0) break;
    resolved[index] = (resolved[index] ?? 0) + 1;
    remainder -= 1;
  }
  return resolved;
}

function effectiveTracks(box: BoxNode): readonly Track[] {
  return box.tracks ?? box.children.map((): Track => "auto");
}

function contentExtent(box: BoxNode, contentFrame: Rect, frames: readonly Rect[]): Size {
  const width = maximum(frames.map((frame) => frame.x + frame.width - contentFrame.x));
  const height = maximum(frames.map((frame) => frame.y + frame.height - contentFrame.y));
  return {
    width: hasScrollAxis(box.scroll, "x") ? Math.max(contentFrame.width, width) : width,
    height: hasScrollAxis(box.scroll, "y") ? Math.max(contentFrame.height, height) : height,
  };
}

function inset(frame: Rect, box: BoxNode): Rect {
  const border = box.border === null ? 0 : 1;
  const left = border + box.padding.left;
  const right = border + box.padding.right;
  const top = border + box.padding.top;
  const bottom = border + box.padding.bottom;
  return {
    x: frame.x + Math.min(frame.width, left),
    y: frame.y + Math.min(frame.height, top),
    width: Math.max(0, frame.width - left - right),
    height: Math.max(0, frame.height - top - bottom),
  };
}

function clampOffset(box: BoxNode, layout: LayoutNode, requested: Point): Point {
  return {
    x: hasScrollAxis(box.scroll, "x")
      ? clamp(requested.x, layout.contentSize.width - layout.contentFrame.width)
      : 0,
    y: hasScrollAxis(box.scroll, "y")
      ? clamp(requested.y, layout.contentSize.height - layout.contentFrame.height)
      : 0,
  };
}

function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

function translate(rect: Rect, offset: Point): Rect {
  return { ...rect, x: rect.x + offset.x, y: rect.y + offset.y };
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

function mergeStyle(base: ResolvedStyle, overlay: SemanticNode["style"]): ResolvedStyle {
  return {
    foreground: overlay.foreground ?? base.foreground,
    background: overlay.background ?? base.background,
    bold: overlay.bold ?? base.bold,
    dim: overlay.dim ?? base.dim,
    inverse: overlay.inverse ?? base.inverse,
    underline: overlay.underline ?? base.underline,
  };
}

function alignmentOffset(available: number, content: number, align: Align): number {
  const remainder = Math.max(0, available - content);
  return align === "center" ? Math.floor(remainder / 2) : align === "end" ? remainder : 0;
}

function eagerLineWidth(line: string): number {
  return eagerCellWidth(cellizeLine(line));
}

function eagerCellWidth(graphemes: readonly CellGrapheme[]): number {
  return sum(graphemes.map((grapheme) => grapheme.width));
}

function fractionWeight(track: Track | undefined): number {
  return typeof track === "string" && track.endsWith("fr")
    ? Number.parseFloat(track.slice(0, -2))
    : 0;
}

function clamp(value: number, maximum: number): number {
  return Math.min(Math.max(0, maximum), Math.max(0, Math.floor(value)));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function maximum(values: readonly number[]): number {
  return values.reduce((result, value) => Math.max(result, value), 0);
}

interface MutableCell extends Cell {
  glyph: string;
  continuation: boolean;
  style: ResolvedStyle;
  ownerId: number | null;
}

interface MutableScene {
  readonly width: number;
  readonly height: number;
  readonly cells: MutableCell[];
}
