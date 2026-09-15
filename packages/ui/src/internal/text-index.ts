import type { Rect, ScrollAxis, Size, TextNode } from "./model.js";
import type { RenderWorkTracker } from "./render-work.js";
import {
  compareTextSources,
  textSourceChange,
  textSourceIdentity,
  textSourceSegments,
  type TextSource,
  type TextSourceExtensionUpdate,
  type TextSourceSegmentUpdate,
  type TextSourceUpdate,
} from "./text-source.js";
import {
  TextWindowCache,
  type PreparedOverflowLine,
  type PreparedTextCell,
  type PreparedTextCounts,
  type PreparedTextWindow,
  type TextPreparationLine,
  type TextPreparationSource,
  type TextSourceRange,
} from "./text-window.js";
import {
  TAB_WIDTH,
  graphemeCellWidth,
  isControlGrapheme,
  splitGraphemes,
  splitGraphemesWithWork,
  type TextOverflow,
} from "./unicode.js";

export type { TextSourceRange } from "./text-window.js";

export interface TextLineIndex {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly sourceRange: TextSourceRange;
  readonly newline: TextSourceRange | null;
  readonly newlineStart: number | null;
  readonly newlineEnd: number | null;
  readonly width: number;
}

export interface TextGraphemeIndex {
  readonly text: string;
  readonly range: TextSourceRange;
  readonly width: number;
}

export interface TextUnicodeBoundaryState {
  readonly pendingRange: TextSourceRange | null;
  readonly pendingText: string;
  readonly trailingRegionalIndicatorCount: number;
}

export interface TextIndexSnapshot {
  readonly nodeId: number;
  readonly source: TextSource | null;
  readonly sourceIdentity: object;
  readonly sourceLength: number;
  readonly lineCount: number;
  readonly lines: readonly TextLineIndex[];
  readonly maxWidth: number;
  readonly currentLineWidth: number;
  readonly unfinishedGrapheme: TextGraphemeIndex | null;
  readonly boundaryState: TextUnicodeBoundaryState;
}

interface IndexedChunk {
  readonly text: string;
  start: number;
  end: number;
  readonly identity: object | null;
  /**
   * Boundary state as if the source ended at this chunk's end. Non-final
   * segment extensions resume here instead of rescanning the segment.
   */
  seam: ChunkSeamState | null;
}

interface IndexedSegment {
  readonly id: string | null;
  identity: object | null;
  chunks: IndexedChunk[];
  start: number;
  end: number;
}

interface MutableLine {
  start: number;
  end: number;
  newlineStart: number | null;
  newlineEnd: number | null;
  width: number;
  checkpoints: MutableHorizontalCheckpoint[];
}

interface MutableHorizontalCheckpoint {
  readonly column: number;
  offset: number;
}

interface PendingGrapheme {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly width: number;
}

interface ChunkSeamState {
  readonly committedWidth: number;
  readonly currentHasCell: boolean;
  readonly committedRegionalIndicatorCount: number;
  readonly pendingText: string | null;
  readonly pendingWidth: number;
}

interface BoundaryState {
  readonly committedWidth: number;
  readonly currentHasCell: boolean;
  readonly committedRegionalIndicatorCount: number;
  readonly pending: PendingGrapheme | null;
}

/**
 * Mount-owned compact index for one text node. It keeps exact line ranges and
 * widths, one unfinished grapheme, and persistent chunk ranges. All range
 * lookup is binary, so work never scans retained prefixes.
 */
export class CompactTextIndex implements TextPreparationSource {
  readonly nodeId: number;
  #source: TextSource | null = null;
  #sourceIdentity: object = createIdentity();
  #stringValue: string | null = null;
  #inputKind: "string" | "source" = "string";
  #segments: IndexedSegment[] = [];
  #segmentIndexes = new Map<string, number>();
  #lines: MutableLine[] = [];
  #length = 0;
  #maxWidth = 0;
  #committedWidth = 0;
  #currentHasCell = false;
  #committedRegionalIndicatorCount = 0;
  #pending: PendingGrapheme | null = null;
  readonly #window: TextWindowCache;

  constructor(node: TextNode, work?: RenderWorkTracker) {
    this.nodeId = node.id;
    this.#window = new TextWindowCache(this);
    this.update(node, work);
  }

  get lineCount(): number {
    return this.#lines.length;
  }

  get contentWidth(): number {
    return this.#maxWidth;
  }

  update(node: TextNode, work?: RenderWorkTracker): void {
    if (node.source === null) {
      this.updateString(node.text, work);
      return;
    }
    this.updateSource(node.source, work);
  }

  dispose(): void {
    this.#source = null;
    this.#sourceIdentity = createIdentity();
    this.#stringValue = null;
    this.#inputKind = "string";
    this.#segments = [];
    this.#segmentIndexes.clear();
    this.resetMetrics();
  }

  preferredSize(): Size {
    return { width: this.#maxWidth, height: this.#lines.length };
  }

  line(lineIndex: number): TextPreparationLine | null {
    const line = this.#lines[lineIndex];
    return line === undefined ? null : { width: line.width, end: line.end };
  }

  prepare(
    node: TextNode,
    frame: Rect,
    clip: Rect,
    scroll: ScrollAxis | null,
    work?: RenderWorkTracker,
  ): PreparedTextWindow {
    return this.#window.prepare(node, frame, clip, scroll, work);
  }

  prepareOverflowLine(
    lineIndex: number,
    frameWidth: number,
    overflow: TextOverflow,
    work?: RenderWorkTracker,
  ): PreparedOverflowLine {
    return this.#window.prepareOverflowLine(
      lineIndex,
      frameWidth,
      overflow,
      work,
    );
  }

  clearPrepared(): void {
    this.#window.clear();
  }

  preparedCounts(): PreparedTextCounts {
    return this.#window.counts();
  }

  /**
   * Reads and cellizes the bounded column range of one line, starting from the
   * nearest horizontal checkpoint with one prior checkpoint of context.
   */
  prepareLineRange(
    lineIndex: number,
    columnStart: number,
    columnEnd: number,
    work?: RenderWorkTracker,
  ): readonly PreparedTextCell[] {
    if (columnStart >= columnEnd) return [];
    const line = this.#lines[lineIndex];
    if (line === undefined || line.width === 0) return [];

    const startCheckpoint = checkpointAtOrBeforeWithContext(line, columnStart);
    const endCheckpoint = checkpointAtOrAfter(line, columnEnd);
    const endOffset = endCheckpoint?.offset ?? line.end;
    const cells = this.readPreparedCells(
      lineIndex,
      startCheckpoint.offset,
      endOffset,
      startCheckpoint.column,
      work,
    );

    return cells.filter(
      (cell) =>
        cell.column >= columnStart && cell.column + cell.width <= columnEnd,
    );
  }

  lineText(lineIndex: number): string | null {
    const line = this.#lines[lineIndex];
    return line === undefined
      ? null
      : this.readSourceRange(line.start, line.end);
  }

  snapshot(): TextIndexSnapshot {
    const unfinished = this.#pending;
    const unfinishedGrapheme =
      unfinished === null
        ? null
        : Object.freeze({
            text: unfinished.text,
            range: Object.freeze({
              start: unfinished.start,
              end: unfinished.end,
            }),
            width: unfinished.width,
          });
    const lines = this.#lines.map((line, index) => {
      const sourceRange = Object.freeze({ start: line.start, end: line.end });
      const newline =
        line.newlineStart === null || line.newlineEnd === null
          ? null
          : Object.freeze({
              start: line.newlineStart,
              end: line.newlineEnd,
            });
      return Object.freeze({
        index,
        start: line.start,
        end: line.end,
        sourceRange,
        newline,
        newlineStart: line.newlineStart,
        newlineEnd: line.newlineEnd,
        width: line.width,
      });
    });
    const boundaryState = Object.freeze({
      pendingRange:
        unfinished === null
          ? null
          : Object.freeze({ start: unfinished.start, end: unfinished.end }),
      pendingText: unfinished?.text ?? "",
      trailingRegionalIndicatorCount: this.trailingRegionalIndicatorCount(),
    });
    return Object.freeze({
      nodeId: this.nodeId,
      source: this.#source,
      sourceIdentity: this.#sourceIdentity,
      sourceLength: this.#length,
      lineCount: this.#lines.length,
      lines: Object.freeze(lines),
      maxWidth: this.#maxWidth,
      currentLineWidth: this.#lines.at(-1)?.width ?? 0,
      unfinishedGrapheme,
      boundaryState,
    });
  }

  private readPreparedCells(
    lineIndex: number,
    start: number,
    end: number,
    startColumn: number,
    work?: RenderWorkTracker,
  ): PreparedTextCell[] {
    const input = this.readSourceRange(start, end, work);
    const graphemes = splitGraphemesWithWork(input, work);
    work?.prepareGraphemes(graphemes.length);

    const cells: PreparedTextCell[] = [];
    let cursor = start;
    let column = startColumn;
    let previousCellIndex = -1;

    for (const grapheme of graphemes) {
      const graphemeStart = cursor;
      const graphemeEnd = graphemeStart + grapheme.length;
      cursor = graphemeEnd;

      if (grapheme === "\t") {
        const count = TAB_WIDTH - (column % TAB_WIDTH);
        for (let index = 0; index < count; index += 1) {
          cells.push(
            createPreparedCell(
              lineIndex,
              column,
              " ",
              1,
              graphemeStart,
              graphemeEnd,
              0,
            ),
          );
          previousCellIndex = cells.length - 1;
          column += 1;
        }
        continue;
      }

      if (isControlGrapheme(grapheme)) {
        cells.push(
          createPreparedCell(
            lineIndex,
            column,
            "�",
            1,
            graphemeStart,
            graphemeEnd,
            0,
          ),
        );
        previousCellIndex = cells.length - 1;
        column += 1;
        continue;
      }

      const width = graphemeCellWidth(grapheme);
      if (width === 0) {
        if (previousCellIndex >= 0) {
          const previous = cells[previousCellIndex];
          if (previous !== undefined) {
            cells[previousCellIndex] = Object.freeze({
              ...previous,
              glyph: previous.glyph + grapheme,
              sourceRange: Object.freeze({
                start: previous.sourceRange.start,
                end: graphemeEnd,
              }),
              copiedGlyphPayloadCodeUnits:
                previous.copiedGlyphPayloadCodeUnits + grapheme.length,
            });
          }
        } else {
          cells.push(
            createPreparedCell(
              lineIndex,
              column,
              `◌${grapheme}`,
              1,
              graphemeStart,
              graphemeEnd,
              grapheme.length,
            ),
          );
          previousCellIndex = cells.length - 1;
          column += 1;
        }
        continue;
      }

      cells.push(
        createPreparedCell(
          lineIndex,
          column,
          grapheme,
          width,
          graphemeStart,
          graphemeEnd,
          grapheme.length,
        ),
      );
      previousCellIndex = cells.length - 1;
      column += width;
    }
    return cells;
  }

  private readSourceRange(
    start: number,
    end: number,
    work?: RenderWorkTracker,
  ): string {
    if (end <= start) return "";
    const segments = this.#segments;
    const pieces: string[] = [];
    const firstSegment = segmentIndexContaining(segments, start, work);
    for (let index = firstSegment; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment === undefined) continue;
      if (segment.start >= end) break;
      work?.searchMetadataRecords(1);
      const firstChunk =
        index === firstSegment
          ? chunkIndexContaining(segment.chunks, start, work)
          : 0;
      for (
        let chunkIndex = firstChunk;
        chunkIndex < segment.chunks.length;
        chunkIndex += 1
      ) {
        const chunk = segment.chunks[chunkIndex];
        if (chunk === undefined) continue;
        if (chunk.start >= end) break;
        work?.searchMetadataRecords(1);
        const pieceStart = Math.max(start, chunk.start) - chunk.start;
        const pieceEnd = Math.min(end, chunk.end) - chunk.start;
        if (pieceEnd <= pieceStart) continue;
        pieces.push(
          pieceStart === 0 && pieceEnd === chunk.text.length
            ? chunk.text
            : chunk.text.slice(pieceStart, pieceEnd),
        );
      }
    }
    if (pieces.length === 0) return "";
    if (pieces.length === 1) return pieces[0] ?? "";
    return pieces.join("");
  }

  private updateString(text: string, work?: RenderWorkTracker): void {
    if (this.#inputKind === "string" && this.#stringValue === text) return;
    this.invalidateInput();
    this.#inputKind = "string";
    this.#source = null;
    this.#sourceIdentity = createIdentity();
    this.#stringValue = text;
    this.#segments = [
      {
        id: null,
        identity: null,
        chunks: [
          {
            text,
            start: 0,
            end: text.length,
            identity: null,
            seam: null,
          },
        ],
        start: 0,
        end: text.length,
      },
    ];
    this.rebuildAll(work);
  }

  private updateSource(source: TextSource, work?: RenderWorkTracker): void {
    if (this.#inputKind === "source" && this.#source === source) return;

    if (this.#inputKind === "source" && this.#source !== null) {
      const previous = this.#source;
      const change = textSourceChange(source);
      if (
        change.previousIdentity === this.#sourceIdentity &&
        this.applySourceChange(change, work)
      ) {
        this.adoptSource(source);
        return;
      }
      if (
        this.applySourceUpdate(compareTextSources(previous, source, work), work)
      ) {
        this.adoptSource(source);
        return;
      }
    }

    this.rebuildSource(source, work);
  }

  private adoptSource(source: TextSource): void {
    this.#inputKind = "source";
    this.#source = source;
    this.#sourceIdentity = textSourceIdentity(source);
    this.#stringValue = null;
  }

  private rebuildSource(source: TextSource, work?: RenderWorkTracker): void {
    this.invalidateInput();
    this.#inputKind = "source";
    this.#source = source;
    this.#sourceIdentity = textSourceIdentity(source);
    this.#stringValue = null;
    this.#segments = sourceSegments(source);
    this.rebuildSegmentIndexes();
    this.rebuildAll(work);
  }

  /**
   * Applies a private structural update plan. It returns false before any
   * mutation when the plan does not fit the retained index, in which case the
   * caller rebuilds the complete source. Every plan is derived from persistent
   * source identities, so proven updates never rescan the retained prefix.
   */
  private applySourceUpdate(
    update: TextSourceUpdate,
    work?: RenderWorkTracker,
  ): boolean {
    if (update.kind === "unchanged") return true;
    if (update.kind === "rebuild") return false;
    if (update.kind === "append") {
      return this.appendSegments(update.appended, work);
    }
    if (update.kind === "extend") {
      if (!this.applyExtensions(update.extensions, work)) return false;
      return this.appendSegments(update.appended, work);
    }
    return this.rebuildMixedSuffix(update.changed, update.appended, work);
  }

  private applyExtensions(
    extensions: readonly TextSourceExtensionUpdate[],
    work?: RenderWorkTracker,
  ): boolean {
    const ordered = extensions
      .map((extension) => ({
        extension,
        index: this.#segmentIndexes.get(extension.id),
      }))
      .sort((left, right) => (left.index ?? -1) - (right.index ?? -1));
    if (ordered.some(({ index }) => index === undefined)) return false;
    for (const { extension, index } of ordered) {
      if (index === undefined) return false;
      for (const chunk of extension.chunks) {
        this.extendSegment(
          index,
          chunk.text,
          extension.identity,
          chunk.identity,
          work,
        );
      }
    }
    return true;
  }

  private appendSegments(
    segments: readonly TextSourceSegmentUpdate[],
    work?: RenderWorkTracker,
  ): boolean {
    for (const segment of segments) {
      if (this.#segmentIndexes.has(segment.id)) return false;
    }
    for (const segment of segments) this.appendSegment(segment, work);
    return true;
  }

  /**
   * Preserves the line ranges before the earliest changed or uncertain
   * segment, replaces the remaining segment metadata, and rebuilds only the
   * affected suffix.
   */
  private rebuildMixedSuffix(
    changed: readonly TextSourceSegmentUpdate[],
    appended: readonly TextSourceSegmentUpdate[],
    work?: RenderWorkTracker,
  ): boolean {
    let preserveCount = this.#segments.length;
    const changedById = new Map<string, TextSourceSegmentUpdate>();
    for (const segment of changed) {
      const index = this.#segmentIndexes.get(segment.id);
      if (index === undefined) return false;
      changedById.set(segment.id, segment);
      if (index < preserveCount) preserveCount = index;
    }
    for (const segment of appended) {
      if (this.#segmentIndexes.has(segment.id)) return false;
    }

    const next = this.#segments.slice(0, preserveCount);
    for (let index = preserveCount; index < this.#segments.length; index += 1) {
      const segment = this.#segments[index];
      if (segment === undefined) continue;
      const replacement =
        segment.id === null ? undefined : changedById.get(segment.id);
      next.push(
        replacement === undefined ? segment : createIndexedSegment(replacement),
      );
    }
    for (const segment of appended) {
      next.push(createIndexedSegment(segment));
    }

    this.#segments = next;
    this.rebuildSegmentIndexes();
    this.reindexSegmentsFrom(preserveCount);
    this.rebuildFromOffset(
      this.#segments[preserveCount]?.start ?? this.#length,
      work,
    );
    return true;
  }

  private applySourceChange(
    change: ReturnType<typeof textSourceChange>,
    work?: RenderWorkTracker,
  ): boolean {
    if (change.kind === "append") {
      if (
        change.id === undefined ||
        change.text === undefined ||
        change.segmentIdentity === undefined ||
        change.chunkIdentity === undefined
      ) {
        return false;
      }
      this.appendSegment(
        {
          id: change.id,
          identity: change.segmentIdentity,
          chunks: Object.freeze([
            Object.freeze({
              text: change.text,
              identity: change.chunkIdentity,
            }),
          ]),
        },
        work,
      );
      return true;
    }

    if (change.id === undefined || change.text === undefined) return false;
    const segmentIndex = this.#segmentIndexes.get(change.id);
    if (segmentIndex === undefined) return false;

    if (change.kind === "extend") {
      this.extendSegment(
        segmentIndex,
        change.text,
        change.segmentIdentity,
        change.chunkIdentity,
        work,
      );
      return true;
    }
    if (change.kind === "replace") {
      this.replaceSegment(
        segmentIndex,
        change.text,
        change.segmentIdentity,
        change.chunkIdentity,
        work,
      );
      return true;
    }
    return false;
  }

  private appendSegment(
    segment: TextSourceSegmentUpdate,
    work?: RenderWorkTracker,
  ): void {
    this.#window.clear();
    const start = this.#length;
    const chunks: IndexedChunk[] = [];
    let cursor = start;
    for (const chunk of segment.chunks) {
      chunks.push({
        text: chunk.text,
        start: cursor,
        end: cursor + chunk.text.length,
        identity: chunk.identity,
        seam: null,
      });
      cursor += chunk.text.length;
    }
    this.#segments.push({
      id: segment.id,
      identity: segment.identity,
      chunks,
      start,
      end: cursor,
    });
    this.#segmentIndexes.set(segment.id, this.#segments.length - 1);
    this.#length = cursor;
    for (const chunk of chunks) {
      this.processText(chunk.text, chunk.start, work);
      this.recordSeam(chunk);
    }
    this.updateCurrentLineEnd();
    this.#maxWidth = Math.max(this.#maxWidth, this.currentLineWidth());
  }

  private extendSegment(
    segmentIndex: number,
    delta: string,
    segmentIdentity: object | undefined,
    chunkIdentity: object | undefined,
    work?: RenderWorkTracker,
  ): void {
    const segment = this.#segments[segmentIndex];
    if (segment === undefined) return;
    const changedStart = segment.end;
    const isFinalSegment = segmentIndex === this.#segments.length - 1;

    if (!isFinalSegment) {
      const previousSeam = segment.chunks.at(-1)?.seam ?? null;
      const lineIndex = this.lineIndexAt(changedStart, work);
      const line = this.#lines[lineIndex];
      if (previousSeam !== null && line !== undefined) {
        const suffixText = this.readSourceRange(changedStart, line.end, work);
        this.extendFromSeam(
          segmentIndex,
          segment,
          previousSeam,
          delta,
          segmentIdentity,
          chunkIdentity,
          line,
          lineIndex,
          suffixText,
          work,
        );
        return;
      }
    }

    this.#window.clear();
    segment.chunks.push({
      text: delta,
      start: changedStart,
      end: changedStart + delta.length,
      identity: chunkIdentity ?? createIdentity(),
      seam: null,
    });
    segment.end += delta.length;
    segment.identity = segmentIdentity ?? createIdentity();

    if (isFinalSegment && changedStart === this.#length) {
      this.#length += delta.length;
      this.processText(delta, changedStart, work);
      const chunk = segment.chunks.at(-1);
      if (chunk !== undefined) this.recordSeam(chunk);
      this.updateCurrentLineEnd();
      this.#maxWidth = Math.max(this.#maxWidth, this.currentLineWidth());
      return;
    }

    this.reindexSegmentsFrom(segmentIndex);
    this.rebuildFromOffset(segment.start, work);
  }

  /**
   * Extension of a non-final segment. The index resumes from the extended
   * chunk's retained seam state, reprocesses only the delta and the remainder
   * of the affected line, and shifts following line metadata instead of
   * rescanning the segment prefix.
   */
  private extendFromSeam(
    segmentIndex: number,
    segment: IndexedSegment,
    seam: ChunkSeamState,
    delta: string,
    segmentIdentity: object | undefined,
    chunkIdentity: object | undefined,
    line: MutableLine,
    lineIndex: number,
    suffixText: string,
    work?: RenderWorkTracker,
  ): void {
    const seamOffset = segment.end;
    const oldNewlineStart = line.newlineStart;
    const oldNewlineEnd = line.newlineEnd;
    const tailLines = this.#lines.slice(lineIndex + 1);
    const sourceEnd = this.captureBoundaryState();

    const chunk: IndexedChunk = {
      text: delta,
      start: seamOffset,
      end: seamOffset + delta.length,
      identity: chunkIdentity ?? createIdentity(),
      seam: null,
    };
    segment.chunks.push(chunk);
    segment.end += delta.length;
    segment.identity = segmentIdentity ?? createIdentity();
    this.reindexSegmentsFrom(segmentIndex);
    this.#window.clear();

    this.#lines.length = lineIndex + 1;
    line.checkpoints = line.checkpoints.filter(
      (checkpoint) => checkpoint.offset <= seamOffset,
    );
    line.width = seam.committedWidth + seam.pendingWidth;
    line.newlineStart = null;
    line.newlineEnd = null;
    this.restoreSeam(seam, seamOffset);

    this.processText(delta, seamOffset, work);
    this.recordSeam(chunk);
    if (suffixText.length > 0) {
      this.processText(suffixText, seamOffset + delta.length, work);
    }

    const lastLine = this.currentLine();
    if (oldNewlineStart !== null && oldNewlineEnd !== null) {
      const shiftedNewlineStart = oldNewlineStart + delta.length;
      lastLine.end = shiftedNewlineStart;
      lastLine.newlineStart = shiftedNewlineStart;
      lastLine.newlineEnd = oldNewlineEnd + delta.length;
      this.#maxWidth = Math.max(this.#maxWidth, lastLine.width);
      this.invalidateAffectedLineSeams(
        segmentIndex,
        seamOffset + delta.length,
        shiftedNewlineStart,
      );
      for (const tail of tailLines) {
        shiftLine(tail, delta.length);
        this.#lines.push(tail);
      }
      this.restoreBoundaryState(sourceEnd, delta.length);
      // A delta with newlines splits the affected line, so the previous
      // maximum can belong to a line that no longer exists. Recompute from
      // compact line widths only; no source grapheme is rescanned.
      if (delta.includes("\n")) this.recomputeMaxWidth();
      return;
    }

    this.updateCurrentLineEnd();
    this.#maxWidth = Math.max(this.#maxWidth, this.currentLineWidth());
    // The whole remaining single line was reprocessed as new text, so every
    // later chunk seam in it is stale.
    this.invalidateAffectedLineSeams(
      segmentIndex,
      seamOffset + delta.length,
      this.#length,
    );
    if (delta.includes("\n")) this.recomputeMaxWidth();
  }

  /**
   * Seam records inside the rewritten part of the affected line are stale:
   * their line-relative committed width and pending cluster can change when
   * text is inserted before them. Later lines are unaffected.
   */
  private invalidateAffectedLineSeams(
    segmentIndex: number,
    afterOffset: number,
    lineEnd: number,
  ): void {
    for (
      let index = segmentIndex + 1;
      index < this.#segments.length;
      index += 1
    ) {
      const segment = this.#segments[index];
      if (segment === undefined) continue;
      if (segment.start > lineEnd) break;
      for (const chunk of segment.chunks) {
        if (chunk.end > lineEnd) break;
        if (chunk.end >= afterOffset) chunk.seam = null;
      }
    }
  }

  private replaceSegment(
    segmentIndex: number,
    text: string,
    segmentIdentity: object | undefined,
    chunkIdentity: object | undefined,
    work?: RenderWorkTracker,
  ): void {
    const segment = this.#segments[segmentIndex];
    if (segment === undefined) return;
    const changedStart = segment.start;
    segment.chunks = [
      {
        text,
        start: changedStart,
        end: changedStart + text.length,
        identity: chunkIdentity ?? createIdentity(),
        seam: null,
      },
    ];
    segment.end = changedStart + text.length;
    segment.identity = segmentIdentity ?? createIdentity();
    this.reindexSegmentsFrom(segmentIndex);
    this.rebuildFromOffset(changedStart, work);
  }

  private invalidateInput(): void {
    this.#source = null;
    this.#sourceIdentity = createIdentity();
    this.#stringValue = null;
    this.#segments = [];
    this.#segmentIndexes.clear();
    this.resetMetrics();
  }

  private resetMetrics(): void {
    this.#window.clear();
    this.#lines = [];
    this.#length = 0;
    this.#maxWidth = 0;
    this.#committedWidth = 0;
    this.#currentHasCell = false;
    this.#committedRegionalIndicatorCount = 0;
    this.#pending = null;
  }

  private reindexSegmentsFrom(startIndex: number): void {
    let cursor =
      startIndex === 0 ? 0 : (this.#segments[startIndex - 1]?.end ?? 0);
    for (let index = startIndex; index < this.#segments.length; index += 1) {
      const segment = this.#segments[index];
      if (segment === undefined) continue;
      segment.start = cursor;
      for (const chunk of segment.chunks) {
        chunk.start = cursor;
        cursor += chunk.text.length;
        chunk.end = cursor;
      }
      segment.end = cursor;
      this.#segmentIndexes.set(segment.id ?? "", index);
    }
    this.#length = cursor;
  }

  private rebuildSegmentIndexes(): void {
    this.#segmentIndexes.clear();
    for (let index = 0; index < this.#segments.length; index += 1) {
      const id = this.#segments[index]?.id;
      if (id !== null && id !== undefined) this.#segmentIndexes.set(id, index);
    }
  }

  private rebuildAll(work?: RenderWorkTracker): void {
    this.resetMetrics();
    this.#length = this.#segments.at(-1)?.end ?? 0;
    this.#lines = [createLine(0)];
    work?.indexLines(1);
    this.resetBoundaryState();
    for (const segment of this.#segments) {
      for (const chunk of segment.chunks) {
        this.processText(chunk.text, chunk.start, work);
        this.recordSeam(chunk);
      }
    }
    this.updateCurrentLineEnd();
    this.recomputeMaxWidth();
  }

  private rebuildFromOffset(
    changedOffset: number,
    work?: RenderWorkTracker,
  ): void {
    this.#window.clear();
    const lineIndex = this.lineIndexAt(changedOffset, work);
    const lineStart = this.#lines[lineIndex]?.start ?? 0;
    this.#lines = this.#lines.slice(0, lineIndex);
    this.#lines.push(createLine(lineStart));
    work?.indexLines(1);
    this.resetBoundaryState();

    const firstSegment = segmentIndexContaining(
      this.#segments,
      lineStart,
      work,
    );
    for (let index = firstSegment; index < this.#segments.length; index += 1) {
      const segment = this.#segments[index];
      if (segment === undefined) continue;
      const firstChunk =
        index === firstSegment
          ? chunkIndexContaining(segment.chunks, lineStart, work)
          : 0;
      for (
        let chunkIndex = firstChunk;
        chunkIndex < segment.chunks.length;
        chunkIndex += 1
      ) {
        const chunk = segment.chunks[chunkIndex];
        if (chunk === undefined) continue;
        const localStart = Math.max(0, lineStart - chunk.start);
        this.processText(
          chunk.text.slice(localStart),
          chunk.start + localStart,
          work,
        );
        this.recordSeam(chunk);
      }
    }
    this.updateCurrentLineEnd();
    this.recomputeMaxWidth();
  }

  private lineIndexAt(offset: number, work?: RenderWorkTracker): number {
    const lines = this.#lines;
    let low = 0;
    let high = lines.length - 1;
    let result = 0;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      work?.searchMetadataRecords(1);
      const line = lines[middle];
      if (line === undefined || line.start > offset) {
        high = middle - 1;
      } else {
        result = middle;
        low = middle + 1;
      }
    }
    return result;
  }

  private processText(
    text: string,
    start: number,
    work?: RenderWorkTracker,
  ): void {
    let cursor = 0;
    while (cursor <= text.length) {
      const newline = text.indexOf("\n", cursor);
      const end = newline < 0 ? text.length : newline;
      if (end > cursor) {
        this.processGraphemeText(text.slice(cursor, end), start + cursor, work);
      }
      if (newline < 0) break;

      this.flushPending();
      const line = this.currentLine();
      line.end = start + newline;
      line.newlineStart = start + newline;
      line.newlineEnd = start + newline + 1;
      this.#maxWidth = Math.max(this.#maxWidth, line.width);
      this.#lines.push(createLine(start + newline + 1));
      work?.indexLines(1);
      this.resetBoundaryState();
      cursor = newline + 1;
    }
  }

  private processGraphemeText(
    text: string,
    start: number,
    work?: RenderWorkTracker,
  ): void {
    const pending = this.#pending;
    const combined = pending === null ? text : pending.text + text;
    const combinedStart = pending?.start ?? start;
    this.#pending = null;
    this.currentLine().width = this.#committedWidth;
    if (combined.length === 0) return;

    work?.inspectSourceCodeUnits(combined.length);
    const graphemes = splitGraphemes(combined);
    work?.prepareGraphemes(graphemes.length);
    let cursor = combinedStart;
    for (let index = 0; index < graphemes.length - 1; index += 1) {
      const grapheme = graphemes[index] ?? "";
      const end = cursor + grapheme.length;
      this.commitGrapheme(grapheme, cursor);
      cursor = end;
    }

    const last = graphemes.at(-1);
    if (last === undefined) return;
    const end = cursor + last.length;
    this.#pending = {
      text: last,
      start: cursor,
      end,
      width: graphemeWidth(last, this.#committedWidth, this.#currentHasCell),
    };
    this.currentLine().width = this.#committedWidth + this.#pending.width;
  }

  private recordSeam(chunk: IndexedChunk): void {
    chunk.seam = {
      committedWidth: this.#committedWidth,
      currentHasCell: this.#currentHasCell,
      committedRegionalIndicatorCount: this.#committedRegionalIndicatorCount,
      pendingText: this.#pending?.text ?? null,
      pendingWidth: this.#pending?.width ?? 0,
    };
  }

  private restoreSeam(seam: ChunkSeamState, seamOffset: number): void {
    this.#committedWidth = seam.committedWidth;
    this.#currentHasCell = seam.currentHasCell;
    this.#committedRegionalIndicatorCount =
      seam.committedRegionalIndicatorCount;
    this.#pending =
      seam.pendingText === null
        ? null
        : {
            text: seam.pendingText,
            start: seamOffset - seam.pendingText.length,
            end: seamOffset,
            width: seam.pendingWidth,
          };
  }

  private captureBoundaryState(): BoundaryState {
    return {
      committedWidth: this.#committedWidth,
      currentHasCell: this.#currentHasCell,
      committedRegionalIndicatorCount: this.#committedRegionalIndicatorCount,
      pending: this.#pending,
    };
  }

  private restoreBoundaryState(state: BoundaryState, shift: number): void {
    this.#committedWidth = state.committedWidth;
    this.#currentHasCell = state.currentHasCell;
    this.#committedRegionalIndicatorCount =
      state.committedRegionalIndicatorCount;
    this.#pending =
      state.pending === null
        ? null
        : {
            text: state.pending.text,
            start: state.pending.start + shift,
            end: state.pending.end + shift,
            width: state.pending.width,
          };
  }

  private commitGrapheme(text: string, start: number): void {
    const width = graphemeWidth(
      text,
      this.#committedWidth,
      this.#currentHasCell,
    );
    if (width > 0) this.recordCheckpoint(start);
    this.#committedWidth += width;
    if (width > 0) this.#currentHasCell = true;
    this.#committedRegionalIndicatorCount = isRegionalIndicatorGrapheme(text)
      ? this.#committedRegionalIndicatorCount + regionalIndicatorCount(text)
      : 0;
    this.currentLine().width = this.#committedWidth;
    this.#pending = null;
  }

  private flushPending(): void {
    const pending = this.#pending;
    if (pending === null) return;
    if (pending.width > 0) this.recordCheckpoint(pending.start);
    this.#committedWidth += pending.width;
    if (pending.width > 0) this.#currentHasCell = true;
    this.#committedRegionalIndicatorCount = isRegionalIndicatorGrapheme(
      pending.text,
    )
      ? this.#committedRegionalIndicatorCount +
        regionalIndicatorCount(pending.text)
      : 0;
    this.currentLine().width = this.#committedWidth;
    this.#pending = null;
  }

  private recordCheckpoint(offset: number): void {
    const line = this.currentLine();
    const last = line.checkpoints.at(-1);
    if (
      last !== undefined &&
      this.#committedWidth - last.column < HORIZONTAL_CHECKPOINT_INTERVAL
    ) {
      return;
    }
    line.checkpoints.push({ column: this.#committedWidth, offset });
  }

  private resetBoundaryState(): void {
    this.#committedWidth = 0;
    this.#currentHasCell = false;
    this.#committedRegionalIndicatorCount = 0;
    this.#pending = null;
  }

  private updateCurrentLineEnd(): void {
    const line = this.currentLine();
    line.end = this.#length;
    line.width = this.currentLineWidth();
  }

  private recomputeMaxWidth(): void {
    this.#maxWidth = this.#lines.reduce(
      (maximum, line) => Math.max(maximum, line.width),
      0,
    );
  }

  private currentLine(): MutableLine {
    const line = this.#lines.at(-1);
    if (line === undefined) throw new Error("Text index has no current line.");
    return line;
  }

  private currentLineWidth(): number {
    return this.currentLine().width;
  }

  private trailingRegionalIndicatorCount(): number {
    const pending = this.#pending;
    if (pending === null || !isRegionalIndicatorGrapheme(pending.text)) {
      return 0;
    }
    return (
      this.#committedRegionalIndicatorCount +
      regionalIndicatorCount(pending.text)
    );
  }
}

function sourceSegments(source: TextSource): IndexedSegment[] {
  let cursor = 0;
  return textSourceSegments(source).map((segment) => {
    const chunks = segment.chunks.map((chunk) => {
      const start = cursor;
      cursor += chunk.text.length;
      return {
        text: chunk.text,
        start,
        end: cursor,
        identity: chunk.identity,
        seam: null,
      };
    });
    return {
      id: segment.id,
      identity: segment.identity,
      chunks,
      start: chunks[0]?.start ?? cursor,
      end: cursor,
    };
  });
}

const HORIZONTAL_CHECKPOINT_INTERVAL = 256;

/**
 * Builds index metadata for one changed or appended segment. Chunk starts and
 * ends are placeholders because reindexing rewrites them from the retained
 * prefix.
 */
function createIndexedSegment(update: TextSourceSegmentUpdate): IndexedSegment {
  const chunks: IndexedChunk[] = update.chunks.map((chunk) => ({
    text: chunk.text,
    start: 0,
    end: chunk.text.length,
    identity: chunk.identity,
    seam: null,
  }));
  return {
    id: update.id,
    identity: update.identity,
    chunks,
    start: 0,
    end: 0,
  };
}

function createLine(start: number): MutableLine {
  return {
    start,
    end: start,
    newlineStart: null,
    newlineEnd: null,
    width: 0,
    checkpoints: [{ column: 0, offset: start }],
  };
}

function segmentIndexContaining(
  segments: readonly IndexedSegment[],
  offset: number,
  work?: RenderWorkTracker,
): number {
  let low = 0;
  let high = segments.length - 1;
  let result = segments.length;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    work?.searchMetadataRecords(1);
    const segment = segments[middle];
    if (segment === undefined || segment.end <= offset) {
      low = middle + 1;
    } else {
      result = middle;
      high = middle - 1;
    }
  }
  return result;
}

function chunkIndexContaining(
  chunks: readonly IndexedChunk[],
  offset: number,
  work?: RenderWorkTracker,
): number {
  let low = 0;
  let high = chunks.length - 1;
  let result = chunks.length;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    work?.searchMetadataRecords(1);
    const chunk = chunks[middle];
    if (chunk === undefined || chunk.end <= offset) {
      low = middle + 1;
    } else {
      result = middle;
      high = middle - 1;
    }
  }
  return result;
}

function createPreparedCell(
  lineIndex: number,
  column: number,
  glyph: string,
  width: 1 | 2,
  start: number,
  end: number,
  copiedGlyphPayloadCodeUnits: number,
): PreparedTextCell {
  return Object.freeze({
    lineIndex,
    column,
    glyph,
    width,
    sourceRange: Object.freeze({ start, end }),
    copiedGlyphPayloadCodeUnits,
  });
}

function shiftLine(line: MutableLine, shift: number): void {
  line.start += shift;
  line.end += shift;
  if (line.newlineStart !== null) line.newlineStart += shift;
  if (line.newlineEnd !== null) line.newlineEnd += shift;
  for (const checkpoint of line.checkpoints) checkpoint.offset += shift;
}

function checkpointAtOrBeforeWithContext(
  line: MutableLine,
  column: number,
): MutableHorizontalCheckpoint {
  const entry = checkpointAtOrBeforeEntry(line, column);
  return line.checkpoints[Math.max(0, entry.index - 1)] ?? entry.checkpoint;
}

function checkpointAtOrBeforeEntry(
  line: MutableLine,
  column: number,
): {
  readonly index: number;
  readonly checkpoint: MutableHorizontalCheckpoint;
} {
  let low = 0;
  let high = line.checkpoints.length - 1;
  let index = 0;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const checkpoint = line.checkpoints[middle];
    if (checkpoint === undefined || checkpoint.column > column) {
      high = middle - 1;
    } else {
      index = middle;
      low = middle + 1;
    }
  }
  return {
    index,
    checkpoint: line.checkpoints[index] ?? { column: 0, offset: line.start },
  };
}

function checkpointAtOrAfter(
  line: MutableLine,
  column: number,
): MutableHorizontalCheckpoint | null {
  let low = 0;
  let high = line.checkpoints.length - 1;
  let result: MutableHorizontalCheckpoint | null = null;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const checkpoint = line.checkpoints[middle];
    if (checkpoint === undefined) {
      high = middle - 1;
    } else if (checkpoint.column < column) {
      low = middle + 1;
    } else {
      result = checkpoint;
      high = middle - 1;
    }
  }
  return result;
}

function graphemeWidth(text: string, column: number, hasCell: boolean): number {
  if (text === "\t") return 4 - (column % 4);
  if (isControlGrapheme(text)) return 1;
  const width = graphemeCellWidth(text);
  if (width === 0) return hasCell ? 0 : 1;
  return width;
}

function isRegionalIndicatorGrapheme(text: string): boolean {
  const points = Array.from(text, (value) => value.codePointAt(0) ?? 0);
  return (
    points.length > 0 &&
    points.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff)
  );
}

function regionalIndicatorCount(text: string): number {
  return Array.from(text, (value) => value.codePointAt(0) ?? 0).filter(
    (point) => point >= 0x1f1e6 && point <= 0x1f1ff,
  ).length;
}

function createIdentity(): object {
  return Object.freeze({});
}
