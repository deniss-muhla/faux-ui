import { hasScrollAxis } from "./model.js";
import type { Rect, ScrollAxis, TextNode } from "./model.js";
import type { RenderWorkTracker } from "./render-work.js";
import type { TextOverflow } from "./unicode.js";

export interface TextSourceRange {
  readonly start: number;
  readonly end: number;
}

export interface PreparedTextCell {
  readonly lineIndex: number;
  readonly column: number;
  readonly glyph: string;
  readonly width: 1 | 2;
  readonly sourceRange: TextSourceRange;
  readonly copiedGlyphPayloadCodeUnits: number;
}

export interface PreparedTextLine {
  readonly index: number;
  readonly width: number;
  readonly cells: readonly PreparedTextCell[];
}

export interface PreparedOverflowLine {
  readonly width: number;
  readonly cells: readonly PreparedTextCell[];
}

export interface PreparedTextWindow {
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
  readonly baseY: number;
  readonly lines: readonly PreparedTextLine[];
}

export interface PreparedTextCounts {
  readonly cellSlots: number;
  readonly copiedGlyphPayloadCodeUnits: number;
}

export interface TextPreparationLine {
  readonly width: number;
  readonly end: number;
}

/**
 * The bounded metadata view a compact text index exposes to window
 * preparation. Implementations retain line metrics and source ranges; the
 * cache never sees segments, chunks, or boundary state.
 */
export interface TextPreparationSource {
  readonly lineCount: number;
  readonly contentWidth: number;
  line(lineIndex: number): TextPreparationLine | null;
  prepareLineRange(
    lineIndex: number,
    columnStart: number,
    columnEnd: number,
    work?: RenderWorkTracker,
  ): readonly PreparedTextCell[];
}

interface PreparedWindowBounds {
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly alignX: TextNode["alignX"];
  readonly overflow: TextNode["overflow"];
}

/**
 * Bounded prepared-cell and overflow cache for one text index. The cache
 * prepares at most one viewport of overscan on each enabled scroll axis,
 * evicts cells outside the current window, and separately tracks copied
 * glyph payload.
 */
export class TextWindowCache {
  readonly #source: TextPreparationSource;
  /** The single authoritative regular-cell store, keyed by line then column. */
  readonly #preparedByLine = new Map<number, Map<number, PreparedTextCell>>();
  readonly #preparedOverflow = new Map<
    number,
    Map<string, PreparedOverflowLine>
  >();
  #preparedWindow: PreparedWindowBounds | null = null;

  constructor(source: TextPreparationSource) {
    this.#source = source;
  }

  prepare(
    node: TextNode,
    frame: Rect,
    clip: Rect,
    scroll: ScrollAxis | null,
    work?: RenderWorkTracker,
  ): PreparedTextWindow {
    const lineCount = Math.min(this.#source.lineCount, frame.height);
    const baseY = frame.y + alignOffset(frame.height, lineCount, node.alignY);
    const visibleLineStart = clamp(clip.y - baseY, 0, lineCount);
    const visibleLineEnd = clamp(
      clip.y + clip.height - baseY,
      visibleLineStart,
      lineCount,
    );
    const verticalMargin = hasScrollAxis(scroll, "y") ? clip.height : 0;
    const lineStart = Math.max(0, visibleLineStart - verticalMargin);
    const lineEnd = Math.min(lineCount, visibleLineEnd + verticalMargin);

    const maxColumn = this.#source.contentWidth;
    const horizontal = horizontalWindow(
      frame,
      clip,
      maxColumn,
      hasScrollAxis(scroll, "x"),
    );
    const bounds: PreparedWindowBounds = {
      lineStart,
      lineEnd,
      columnStart: horizontal.start,
      columnEnd: horizontal.end,
      frameWidth: frame.width,
      frameHeight: frame.height,
      alignX: node.alignX,
      overflow: node.overflow,
    };

    const previous = this.#preparedWindow;
    if (previous === null || !windowEquals(previous, bounds)) {
      if (previous !== null && canReuseWindow(previous, bounds)) {
        this.reuseWindow(previous, bounds, work);
      } else {
        this.clear();
        this.prepareWindow(bounds, work);
      }
    }
    this.#preparedWindow = bounds;

    const lines = [] as PreparedTextLine[];
    for (let index = lineStart; index < lineEnd; index += 1) {
      lines.push({
        index,
        width: this.#source.line(index)?.width ?? 0,
        cells: this.cellsForLine(index),
      });
    }
    return {
      lineStart: bounds.lineStart,
      lineEnd: bounds.lineEnd,
      columnStart: bounds.columnStart,
      columnEnd: bounds.columnEnd,
      baseY,
      lines,
    };
  }

  prepareOverflowLine(
    lineIndex: number,
    frameWidth: number,
    overflow: TextOverflow,
    work?: RenderWorkTracker,
  ): PreparedOverflowLine {
    const key = `${frameWidth}:${overflow}`;
    const cached = this.#preparedOverflow.get(lineIndex)?.get(key);
    if (cached !== undefined) return cached;

    const line = this.#source.line(lineIndex);
    const available = Math.max(0, Math.floor(frameWidth));
    if (line === null || line.width <= available || available === 0) {
      return this.cacheOverflowLine(lineIndex, key, freezeOverflowLine([]));
    }

    if (overflow === "clip") {
      const cells = this.prefixCells(lineIndex, available, work);
      return this.cacheOverflowLine(
        lineIndex,
        key,
        freezeOverflowLine(positionCells(lineIndex, cells)),
      );
    }

    const contentWidth = available - 1;
    if (contentWidth === 0) {
      return this.cacheOverflowLine(
        lineIndex,
        key,
        freezeOverflowLine([createEllipsisCell(lineIndex, 0, line.end)]),
      );
    }

    const output: PreparedTextCell[] = [];
    if (overflow === "ellipsis-start") {
      output.push(createEllipsisCell(lineIndex, 0, line.end));
      output.push(
        ...positionCells(
          lineIndex,
          this.suffixCells(lineIndex, contentWidth, work),
          1,
        ),
      );
    } else if (overflow === "ellipsis-middle") {
      const leftWidth = Math.ceil(contentWidth / 2);
      const rightWidth = contentWidth - leftWidth;
      const prefix = this.prefixCells(lineIndex, leftWidth, work);
      const prefixWidth = preparedCellWidth(prefix);
      output.push(...positionCells(lineIndex, prefix, 0));
      output.push(createEllipsisCell(lineIndex, prefixWidth, line.end));
      output.push(
        ...positionCells(
          lineIndex,
          this.suffixCells(lineIndex, rightWidth, work),
          prefixWidth + 1,
        ),
      );
    } else {
      const prefix = this.prefixCells(lineIndex, contentWidth, work);
      const prefixWidth = preparedCellWidth(prefix);
      output.push(...positionCells(lineIndex, prefix, 0));
      output.push(createEllipsisCell(lineIndex, prefixWidth, line.end));
    }

    return this.cacheOverflowLine(lineIndex, key, freezeOverflowLine(output));
  }

  clear(): void {
    this.#preparedByLine.clear();
    this.#preparedOverflow.clear();
    this.#preparedWindow = null;
  }

  counts(): PreparedTextCounts {
    let cellSlots = 0;
    let copiedGlyphPayloadCodeUnits = 0;
    for (const lineCells of this.#preparedByLine.values()) {
      for (const cell of lineCells.values()) {
        cellSlots += cell.width;
        copiedGlyphPayloadCodeUnits += cell.copiedGlyphPayloadCodeUnits;
      }
    }
    for (const lineEntries of this.#preparedOverflow.values()) {
      for (const line of lineEntries.values()) {
        for (const cell of line.cells) {
          cellSlots += cell.width;
          copiedGlyphPayloadCodeUnits += cell.copiedGlyphPayloadCodeUnits;
        }
      }
    }
    return { cellSlots, copiedGlyphPayloadCodeUnits };
  }

  /** Prepares the complete bounded window from scratch. */
  private prepareWindow(
    bounds: PreparedWindowBounds,
    work?: RenderWorkTracker,
  ): void {
    for (let index = bounds.lineStart; index < bounds.lineEnd; index += 1) {
      const line = this.#source.line(index);
      if (line === null) continue;
      const lineWindow = this.lineWindow(bounds, line.width);
      if (lineWindow !== null && line.width <= bounds.frameWidth) {
        this.prepareLine(index, lineWindow.start, lineWindow.end, work);
      }
    }
  }

  /**
   * Retains the old and new window intersection, prepares only entering
   * strips, keeps valid overflow entries, and evicts everything outside the
   * new bound. Strips carry one extra column of context so a width-2 grapheme
   * that straddles the intersection edge is still prepared exactly once.
   */
  private reuseWindow(
    previous: PreparedWindowBounds,
    next: PreparedWindowBounds,
    work?: RenderWorkTracker,
  ): void {
    this.evictOutside(next);
    for (let index = next.lineStart; index < next.lineEnd; index += 1) {
      const line = this.#source.line(index);
      if (line === null) continue;
      const cells = this.#preparedByLine.get(index);
      if (line.width > next.frameWidth) {
        if (cells !== undefined) this.#preparedByLine.delete(index);
        continue;
      }
      const nextWindow = this.lineWindow(next, line.width);
      if (nextWindow === null) continue;
      if (cells === undefined) {
        this.prepareLine(index, nextWindow.start, nextWindow.end, work);
        continue;
      }
      for (const [column, cell] of cells) {
        if (column < nextWindow.start || column + cell.width > nextWindow.end) {
          cells.delete(column);
        }
      }
      const previousWindow = this.lineWindow(previous, line.width);
      if (previousWindow === null) continue;
      const entersBefore = nextWindow.start < previousWindow.start;
      const entersAfter = nextWindow.end > previousWindow.end;
      if (entersBefore) {
        this.prepareLine(
          index,
          nextWindow.start,
          Math.min(previousWindow.start + 1, nextWindow.end),
          work,
        );
      }
      if (entersAfter) {
        this.prepareLine(
          index,
          Math.max(previousWindow.end - 1, nextWindow.start),
          nextWindow.end,
          work,
        );
      }
      if (entersBefore || entersAfter) this.reindexLine(index);
    }
  }

  private evictOutside(bounds: PreparedWindowBounds): void {
    for (const lineIndex of this.#preparedByLine.keys()) {
      if (lineIndex < bounds.lineStart || lineIndex >= bounds.lineEnd) {
        this.#preparedByLine.delete(lineIndex);
      }
    }
    for (const lineIndex of this.#preparedOverflow.keys()) {
      if (lineIndex < bounds.lineStart || lineIndex >= bounds.lineEnd) {
        this.#preparedOverflow.delete(lineIndex);
      }
    }
  }

  /** Keeps one line's prepared cells in ascending column order. */
  private reindexLine(lineIndex: number): void {
    const cells = this.#preparedByLine.get(lineIndex);
    if (cells === undefined) return;
    this.#preparedByLine.set(
      lineIndex,
      new Map([...cells.entries()].sort(([left], [right]) => left - right)),
    );
  }

  private lineWindow(
    bounds: PreparedWindowBounds,
    lineWidth: number,
  ): { readonly start: number; readonly end: number } | null {
    return horizontalLineWindow(
      lineWidth,
      bounds.frameWidth,
      { start: bounds.columnStart, end: bounds.columnEnd },
      bounds.alignX,
    );
  }

  private cacheOverflowLine(
    lineIndex: number,
    key: string,
    line: PreparedOverflowLine,
  ): PreparedOverflowLine {
    const lineEntries =
      this.#preparedOverflow.get(lineIndex) ??
      new Map<string, PreparedOverflowLine>();
    lineEntries.set(key, line);
    this.#preparedOverflow.set(lineIndex, lineEntries);
    return line;
  }

  private prepareLine(
    lineIndex: number,
    columnStart: number,
    columnEnd: number,
    work?: RenderWorkTracker,
  ): void {
    const cells = this.#source.prepareLineRange(
      lineIndex,
      columnStart,
      columnEnd,
      work,
    );
    for (const cell of cells) {
      const lineCells =
        this.#preparedByLine.get(cell.lineIndex) ??
        new Map<number, PreparedTextCell>();
      lineCells.set(cell.column, cell);
      this.#preparedByLine.set(cell.lineIndex, lineCells);
    }
  }

  private prefixCells(
    lineIndex: number,
    width: number,
    work?: RenderWorkTracker,
  ): PreparedTextCell[] {
    if (width <= 0) return [];
    return [...this.#source.prepareLineRange(lineIndex, 0, width, work)];
  }

  private suffixCells(
    lineIndex: number,
    width: number,
    work?: RenderWorkTracker,
  ): PreparedTextCell[] {
    const line = this.#source.line(lineIndex);
    if (line === null || width <= 0) return [];
    return takePreparedSuffix(
      this.#source.prepareLineRange(
        lineIndex,
        Math.max(0, line.width - width),
        line.width,
        work,
      ),
      width,
    );
  }

  private cellsForLine(lineIndex: number): readonly PreparedTextCell[] {
    const lineCells = this.#preparedByLine.get(lineIndex);
    if (lineCells === undefined) return [];
    return [...lineCells.values()];
  }
}

function createEllipsisCell(
  lineIndex: number,
  column: number,
  sourceOffset: number,
): PreparedTextCell {
  return Object.freeze({
    lineIndex,
    column,
    glyph: "…",
    width: 1,
    sourceRange: Object.freeze({ start: sourceOffset, end: sourceOffset }),
    copiedGlyphPayloadCodeUnits: 0,
  });
}

function horizontalWindow(
  frame: Rect,
  clip: Rect,
  maxColumn: number,
  scrollable: boolean,
): { readonly start: number; readonly end: number } {
  const maximum = Math.max(0, maxColumn, frame.width);
  const visibleStart = clamp(clip.x - frame.x, 0, maximum);
  const visibleEnd = clamp(
    clip.x + clip.width - frame.x,
    visibleStart,
    maximum,
  );
  const margin = scrollable ? clip.width : 0;
  return {
    start: Math.max(0, visibleStart - margin),
    end: Math.min(maximum, visibleEnd + margin),
  };
}

function horizontalLineWindow(
  lineWidth: number,
  frameWidth: number,
  horizontal: { readonly start: number; readonly end: number },
  align: TextNode["alignX"],
): { readonly start: number; readonly end: number } | null {
  const contentWidth = Math.min(lineWidth, frameWidth);
  const offset = alignOffset(frameWidth, contentWidth, align);
  const start = clamp(horizontal.start - offset, 0, lineWidth);
  const end = clamp(horizontal.end - offset, start, lineWidth);
  return { start, end };
}

function takePreparedSuffix(
  cells: readonly PreparedTextCell[],
  width: number,
): PreparedTextCell[] {
  const output: PreparedTextCell[] = [];
  let used = 0;
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index];
    if (cell === undefined || used + cell.width > width) break;
    output.unshift(cell);
    used += cell.width;
  }
  return output;
}

function preparedCellWidth(cells: readonly PreparedTextCell[]): number {
  return cells.reduce((total, cell) => total + cell.width, 0);
}

function positionCells(
  lineIndex: number,
  cells: readonly PreparedTextCell[],
  startColumn = 0,
): PreparedTextCell[] {
  let column = startColumn;
  return cells.map((cell) => {
    const positioned = Object.freeze({
      ...cell,
      lineIndex,
      column,
    });
    column += cell.width;
    return positioned;
  });
}

function freezeOverflowLine(
  cells: readonly PreparedTextCell[],
): PreparedOverflowLine {
  return Object.freeze({
    width: cells.reduce((total, cell) => total + cell.width, 0),
    cells: Object.freeze([...cells]),
  });
}

function windowEquals(
  previous: PreparedWindowBounds | null,
  next: PreparedWindowBounds,
): boolean {
  return (
    previous !== null &&
    previous.lineStart === next.lineStart &&
    previous.lineEnd === next.lineEnd &&
    previous.columnStart === next.columnStart &&
    previous.columnEnd === next.columnEnd &&
    previous.frameWidth === next.frameWidth &&
    previous.frameHeight === next.frameHeight &&
    previous.alignX === next.alignX &&
    previous.overflow === next.overflow
  );
}

function canReuseWindow(
  previous: PreparedWindowBounds,
  next: PreparedWindowBounds,
): boolean {
  return (
    previous.frameWidth === next.frameWidth &&
    previous.frameHeight === next.frameHeight &&
    previous.alignX === next.alignX &&
    previous.overflow === next.overflow &&
    previous.lineStart < next.lineEnd &&
    next.lineStart < previous.lineEnd &&
    previous.columnStart < next.columnEnd &&
    next.columnStart < previous.columnEnd
  );
}

function alignOffset(
  available: number,
  content: number,
  align: string,
): number {
  const remainder = Math.max(0, available - content);
  if (align === "center") return Math.floor(remainder / 2);
  if (align === "end") return remainder;
  return 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
