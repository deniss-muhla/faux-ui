import {
  type LayoutNode,
  type LayoutResult,
  alignOffset,
  containsPoint,
  intersectRects,
} from "./layout.js";
import {
  type BoxNode,
  type NodeId,
  type Point,
  type Rect,
  type ScrollAxis,
  type SemanticColor,
  type SemanticNode,
  type Style,
  findNode,
  hasScrollAxis,
  walkTree,
} from "./model.js";
import type { RenderWorkTracker } from "./render-work.js";
import {
  cellizeLineWithWork,
  clipCellGraphemes,
  splitTextLines,
} from "./unicode.js";
import type { TextStore } from "./text-store.js";

export interface ResolvedStyle {
  readonly foreground: SemanticColor;
  readonly background: SemanticColor;
  readonly bold: boolean;
  readonly dim: boolean;
  readonly inverse: boolean;
  readonly underline: boolean;
}

export interface Cell {
  readonly glyph: string;
  readonly continuation: boolean;
  readonly style: ResolvedStyle;
  readonly ownerId: NodeId | null;
}

export interface CellScene {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly Cell[];
}

export interface SceneState {
  readonly focusedId?: NodeId | null;
  readonly hoveredIds?: ReadonlySet<NodeId>;
  readonly offsets?: ReadonlyMap<NodeId, Point>;
}

export interface SceneRun {
  readonly x: number;
  readonly width: number;
  readonly text: string;
  readonly style: ResolvedStyle;
}

export interface SceneRow {
  readonly y: number;
  readonly runs: readonly SceneRun[];
}

const DEFAULT_STYLE: ResolvedStyle = {
  foreground: "fg",
  background: "bg",
  bold: false,
  dim: false,
  inverse: false,
  underline: false,
};

const BORDER_GLYPHS = {
  single: {
    top: "─",
    right: "│",
    bottom: "─",
    left: "│",
    tl: "┌",
    tr: "┐",
    br: "┘",
    bl: "└",
  },
  double: {
    top: "═",
    right: "║",
    bottom: "═",
    left: "║",
    tl: "╔",
    tr: "╗",
    br: "╝",
    bl: "╚",
  },
  rounded: {
    top: "─",
    right: "│",
    bottom: "─",
    left: "│",
    tl: "╭",
    tr: "╮",
    br: "╯",
    bl: "╰",
  },
} as const;

export function paintScene(
  root: SemanticNode,
  layout: LayoutResult,
  state: SceneState = {},
  work?: RenderWorkTracker,
  textStore?: TextStore,
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
  const mutable: MutableScene = {
    width: layout.size.width,
    height: layout.size.height,
    cells,
    copiedGlyphPayloadCodeUnits:
      work === undefined
        ? undefined
        : Array.from({ length: cells.length }, () => 0),
  };
  const rootClip: Rect = {
    x: 0,
    y: 0,
    width: layout.size.width,
    height: layout.size.height,
  };

  paintNode(
    mutable,
    root,
    layout.root,
    rootClip,
    0,
    0,
    DEFAULT_STYLE,
    state,
    work,
    textStore,
    null,
  );

  if (work !== undefined) {
    const textEntryIds = new Set(
      walkTree(root).flatMap((node) => (node.kind === "text" ? [node.id] : [])),
    );
    if (textStore === undefined) {
      let retainedSlots = 0;
      let retainedPayload = 0;
      for (let index = 0; index < mutable.cells.length; index += 1) {
        const cell = mutable.cells[index];
        if (cell !== undefined && textEntryIds.has(cell.ownerId ?? -1)) {
          retainedSlots += 1;
          retainedPayload += mutable.copiedGlyphPayloadCodeUnits?.[index] ?? 0;
        }
      }
      work.retainTextScene(textEntryIds, retainedSlots, retainedPayload);
    } else {
      const prepared = textStore.preparedCounts();
      work.retainTextScene(
        textEntryIds,
        prepared.cellSlots,
        prepared.copiedGlyphPayloadCodeUnits,
      );
    }
  }

  return mutable;
}

export function sceneRows(scene: CellScene): SceneRow[] {
  const rows: SceneRow[] = [];
  for (let y = 0; y < scene.height; y += 1) {
    const runs: SceneRun[] = [];
    let x = 0;
    while (x < scene.width) {
      const first = cellAt(scene, x, y);
      if (first === null) break;
      const style = first.style;
      const start = x;
      let text = "";
      while (x < scene.width) {
        const cell = cellAt(scene, x, y);
        if (cell === null || !stylesEqual(cell.style, style)) break;
        if (!cell.continuation) text += cell.glyph === "" ? " " : cell.glyph;
        x += 1;
      }
      runs.push({ x: start, width: x - start, text, style });
    }
    rows.push({ y, runs });
  }
  return rows;
}

export function sceneToText(scene: CellScene): string {
  return Array.from({ length: scene.height }, (_, y) => {
    let line = "";
    for (let x = 0; x < scene.width; x += 1) {
      const cell = cellAt(scene, x, y);
      if (cell !== null && !cell.continuation) {
        line += cell.glyph === "" ? " " : cell.glyph;
      }
    }
    return line;
  }).join("\n");
}

export function hitTestScene(scene: CellScene, point: Point): NodeId | null {
  return cellAt(scene, point.x, point.y)?.ownerId ?? null;
}

export function clampScrollOffset(
  node: BoxNode,
  layout: LayoutNode,
  requested: Point,
): Point {
  return {
    x: hasScrollAxis(node.scroll, "x")
      ? clamp(
          requested.x,
          0,
          Math.max(0, layout.contentSize.width - layout.contentFrame.width),
        )
      : 0,
    y: hasScrollAxis(node.scroll, "y")
      ? clamp(
          requested.y,
          0,
          Math.max(0, layout.contentSize.height - layout.contentFrame.height),
        )
      : 0,
  };
}

function paintNode(
  scene: MutableScene,
  node: SemanticNode,
  layout: LayoutNode,
  parentClip: Rect,
  translateX: number,
  translateY: number,
  inheritedStyle: ResolvedStyle,
  state: SceneState,
  work?: RenderWorkTracker,
  textStore?: TextStore,
  scrollAxes: ScrollAxis | null = null,
): void {
  const frame = translateRect(layout.frame, translateX, translateY);
  const clip = intersectRects(parentClip, frame);
  if (clip.width === 0 || clip.height === 0) {
    clearPreparedTextNodes(node, textStore);
    return;
  }

  let style = mergeStyle(inheritedStyle, node.style);
  if (state.hoveredIds?.has(node.id) === true) {
    style = mergeStyle(style, node.hoverStyle);
  }
  if (state.focusedId === node.id) {
    style = mergeStyle(style, node.focusStyle);
  }

  fillRect(scene, frame, clip, style, node.id, work);

  if (node.kind === "text") {
    paintText(scene, node, frame, clip, style, work, textStore, scrollAxes);
    return;
  }

  if (node.border !== null) {
    paintBorder(scene, node, frame, clip, style, work);
  }

  const contentFrame = translateRect(
    layout.contentFrame,
    translateX,
    translateY,
  );
  const contentClip = intersectRects(clip, contentFrame);
  if (contentClip.width === 0 || contentClip.height === 0) {
    clearPreparedTextNodes(node, textStore);
    return;
  }

  const requestedOffset = state.offsets?.get(node.id) ?? { x: 0, y: 0 };
  const offset = clampScrollOffset(node, layout, requestedOffset);
  const childTranslateX = translateX - offset.x;
  const childTranslateY = translateY - offset.y;
  const childScrollAxes = mergeScrollAxes(scrollAxes, node.scroll);

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    const childLayout = layout.children[index];
    if (child === undefined || childLayout === undefined) continue;
    paintNode(
      scene,
      child,
      childLayout,
      contentClip,
      childTranslateX,
      childTranslateY,
      style,
      state,
      work,
      textStore,
      childScrollAxes,
    );
  }
}

function clearPreparedTextNodes(
  node: SemanticNode,
  textStore?: TextStore,
): void {
  if (textStore === undefined) return;
  walkTree(node).forEach((current) => {
    if (current.kind === "text") textStore.clearPrepared(current.id);
  });
}

function paintText(
  scene: MutableScene,
  node: Extract<SemanticNode, { kind: "text" }>,
  frame: Rect,
  clip: Rect,
  style: ResolvedStyle,
  work?: RenderWorkTracker,
  textStore?: TextStore,
  scrollAxes: ScrollAxis | null = null,
): void {
  if (node.fill) {
    const token = cellizeLineWithWork(node.text, 0, work)[0] ?? {
      glyph: " ",
      width: 1 as const,
    };
    for (let y = frame.y; y < frame.y + frame.height; y += 1) {
      let x = frame.x;
      while (x < frame.x + frame.width) {
        if (x + token.width > frame.x + frame.width) break;
        writeGrapheme(
          scene,
          x,
          y,
          token.glyph,
          token.width,
          clip,
          style,
          node.id,
          work,
        );
        x += token.width;
      }
    }
    return;
  }

  if (textStore !== undefined) {
    paintPreparedText(
      scene,
      node,
      frame,
      clip,
      style,
      scrollAxes,
      textStore,
      work,
    );
    return;
  }

  const lines = splitTextLines(node.text, work);
  const visibleLineCount = Math.min(lines.length, frame.height);
  const startY =
    frame.y + alignOffset(frame.height, visibleLineCount, node.alignY);

  for (let lineIndex = 0; lineIndex < visibleLineCount; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const graphemes = clipCellGraphemes(
      cellizeLineWithWork(line, 0, work),
      frame.width,
      node.overflow,
    );
    const lineWidth = graphemes.reduce(
      (total, grapheme) => total + grapheme.width,
      0,
    );
    let x = frame.x + alignOffset(frame.width, lineWidth, node.alignX);
    const y = startY + lineIndex;
    for (const grapheme of graphemes) {
      writeGrapheme(
        scene,
        x,
        y,
        grapheme.glyph,
        grapheme.width,
        clip,
        style,
        node.id,
        work,
      );
      x += grapheme.width;
    }
  }
}

function paintPreparedText(
  scene: MutableScene,
  node: Extract<SemanticNode, { kind: "text" }>,
  frame: Rect,
  clip: Rect,
  style: ResolvedStyle,
  scrollAxes: ScrollAxis | null,
  textStore: TextStore,
  work?: RenderWorkTracker,
): void {
  const prepared = textStore.prepare(node, frame, clip, scrollAxes, work);
  for (const line of prepared.lines) {
    const y = prepared.baseY + line.index;
    if (line.width > frame.width) {
      const overflow = textStore.prepareOverflowLine(
        node.id,
        line.index,
        frame.width,
        node.overflow,
        work,
      );
      const startX =
        frame.x + alignOffset(frame.width, overflow.width, node.alignX);
      for (const cell of overflow.cells) {
        writeGrapheme(
          scene,
          startX + cell.column,
          y,
          cell.glyph,
          cell.width,
          clip,
          style,
          node.id,
          work,
          cell.copiedGlyphPayloadCodeUnits,
        );
      }
      continue;
    }

    const lineWidth = line.width;
    const startX = frame.x + alignOffset(frame.width, lineWidth, node.alignX);
    for (const cell of line.cells) {
      if (cell.column + cell.width > lineWidth) continue;
      writeGrapheme(
        scene,
        startX + cell.column,
        y,
        cell.glyph,
        cell.width,
        clip,
        style,
        node.id,
        work,
        cell.copiedGlyphPayloadCodeUnits,
      );
    }
  }
}

function paintBorder(
  scene: MutableScene,
  node: BoxNode,
  frame: Rect,
  clip: Rect,
  style: ResolvedStyle,
  work?: RenderWorkTracker,
): void {
  const border = node.border;
  if (border === null || frame.width === 0 || frame.height === 0) return;
  const glyphs = BORDER_GLYPHS[border.kind];
  const borderStyle = mergeStyle(style, {
    ...(border.foreground === undefined
      ? {}
      : { foreground: border.foreground }),
  });
  const left = frame.x;
  const right = frame.x + frame.width - 1;
  const top = frame.y;
  const bottom = frame.y + frame.height - 1;

  for (let x = left; x <= right; x += 1) {
    writeGrapheme(
      scene,
      x,
      top,
      glyphs.top,
      1,
      clip,
      borderStyle,
      node.id,
      work,
    );
    if (bottom !== top) {
      writeGrapheme(
        scene,
        x,
        bottom,
        glyphs.bottom,
        1,
        clip,
        borderStyle,
        node.id,
        work,
      );
    }
  }
  for (let y = top; y <= bottom; y += 1) {
    writeGrapheme(
      scene,
      left,
      y,
      glyphs.left,
      1,
      clip,
      borderStyle,
      node.id,
      work,
    );
    if (right !== left) {
      writeGrapheme(
        scene,
        right,
        y,
        glyphs.right,
        1,
        clip,
        borderStyle,
        node.id,
        work,
      );
    }
  }

  writeGrapheme(
    scene,
    left,
    top,
    glyphs.tl,
    1,
    clip,
    borderStyle,
    node.id,
    work,
  );
  if (right !== left) {
    writeGrapheme(
      scene,
      right,
      top,
      glyphs.tr,
      1,
      clip,
      borderStyle,
      node.id,
      work,
    );
  }
  if (bottom !== top) {
    writeGrapheme(
      scene,
      left,
      bottom,
      glyphs.bl,
      1,
      clip,
      borderStyle,
      node.id,
      work,
    );
    if (right !== left) {
      writeGrapheme(
        scene,
        right,
        bottom,
        glyphs.br,
        1,
        clip,
        borderStyle,
        node.id,
        work,
      );
    }
  }

  if (node.title !== null && frame.width > 2) {
    const title = clipCellGraphemes(
      cellizeLineWithWork(` ${node.title} `, 0, work),
      frame.width - 2,
      "ellipsis-end",
    );
    let x = left + 1;
    for (const grapheme of title) {
      writeGrapheme(
        scene,
        x,
        top,
        grapheme.glyph,
        grapheme.width,
        clip,
        borderStyle,
        node.id,
        work,
      );
      x += grapheme.width;
    }
  }
}

function fillRect(
  scene: MutableScene,
  frame: Rect,
  clip: Rect,
  style: ResolvedStyle,
  ownerId: NodeId,
  work?: RenderWorkTracker,
): void {
  const visible = intersectRects(frame, clip);
  for (let y = visible.y; y < visible.y + visible.height; y += 1) {
    for (let x = visible.x; x < visible.x + visible.width; x += 1) {
      setCell(
        scene,
        x,
        y,
        {
          glyph: " ",
          continuation: false,
          style,
          ownerId,
        },
        0,
        work,
      );
    }
  }
}

function writeGrapheme(
  scene: MutableScene,
  x: number,
  y: number,
  glyph: string,
  width: 1 | 2,
  clip: Rect,
  style: ResolvedStyle,
  ownerId: NodeId,
  work?: RenderWorkTracker,
  copiedGlyphPayloadCodeUnits = glyph.length,
): void {
  if (!containsPoint(clip, x, y)) return;
  if (width === 2 && !containsPoint(clip, x + 1, y)) return;
  if (x < 0 || y < 0 || x + width > scene.width || y >= scene.height) return;

  setCell(
    scene,
    x,
    y,
    {
      glyph,
      continuation: false,
      style,
      ownerId,
    },
    copiedGlyphPayloadCodeUnits,
    work,
  );
  if (width === 2) {
    setCell(
      scene,
      x + 1,
      y,
      {
        glyph: "",
        continuation: true,
        style,
        ownerId,
      },
      0,
      work,
    );
  }
}

function setCell(
  scene: MutableScene,
  x: number,
  y: number,
  cell: MutableCell,
  copiedGlyphPayloadCodeUnits: number,
  work?: RenderWorkTracker,
): void {
  const index = y * scene.width + x;
  if (index < 0 || index >= scene.cells.length) return;
  scene.cells[index] = cell;
  if (scene.copiedGlyphPayloadCodeUnits !== undefined) {
    scene.copiedGlyphPayloadCodeUnits[index] = copiedGlyphPayloadCodeUnits;
  }
  work?.paintCells(1);
}

function cellAt(scene: CellScene, x: number, y: number): Cell | null {
  if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return null;
  return scene.cells[y * scene.width + x] ?? null;
}

function mergeStyle(base: ResolvedStyle, overlay: Style): ResolvedStyle {
  return {
    foreground: overlay.foreground ?? base.foreground,
    background: overlay.background ?? base.background,
    bold: overlay.bold ?? base.bold,
    dim: overlay.dim ?? base.dim,
    inverse: overlay.inverse ?? base.inverse,
    underline: overlay.underline ?? base.underline,
  };
}

function stylesEqual(a: ResolvedStyle, b: ResolvedStyle): boolean {
  return (
    a.foreground === b.foreground &&
    a.background === b.background &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.inverse === b.inverse &&
    a.underline === b.underline
  );
}

function translateRect(rect: Rect, x: number, y: number): Rect {
  return { ...rect, x: rect.x + x, y: rect.y + y };
}

function mergeScrollAxes(
  inherited: ScrollAxis | null,
  current: ScrollAxis | null,
): ScrollAxis | null {
  if (inherited === "both" || current === "both") return "both";
  if (inherited === null) return current;
  if (current === null || inherited === current) return inherited;
  return "both";
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

interface MutableCell {
  glyph: string;
  continuation: boolean;
  style: ResolvedStyle;
  ownerId: NodeId | null;
}

interface MutableScene {
  readonly width: number;
  readonly height: number;
  readonly cells: MutableCell[];
  readonly copiedGlyphPayloadCodeUnits: number[] | undefined;
}

export function accessibleNodes(root: SemanticNode): Array<{
  readonly id: NodeId;
  readonly label: string;
  readonly role: "button" | "group";
  readonly disabled: boolean;
}> {
  const result: Array<{
    id: NodeId;
    label: string;
    role: "button" | "group";
    disabled: boolean;
  }> = [];
  const visit = (node: SemanticNode): void => {
    if (node.accessibleLabel !== null) {
      result.push({
        id: node.id,
        label: node.accessibleLabel,
        role: node.handlers.onPress === undefined ? "group" : "button",
        disabled: node.kind === "box" ? node.disabled : false,
      });
    }
    if (node.kind === "box") node.children.forEach(visit);
  };
  visit(root);
  return result;
}

export function ownerNode(
  root: SemanticNode,
  scene: CellScene,
  point: Point,
): SemanticNode | null {
  const id = hitTestScene(scene, point);
  return id === null ? null : findNode(root, id);
}
