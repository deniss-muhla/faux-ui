import type {
  Rect,
  ScrollAxis,
  SemanticNode,
  Size,
  TextNode,
} from "./model.js";
import type { RenderWorkTracker } from "./render-work.js";
import { CompactTextIndex } from "./text-index.js";
import type { TextIndexSnapshot } from "./text-index.js";
import type {
  PreparedOverflowLine,
  PreparedTextCounts,
  PreparedTextWindow,
} from "./text-window.js";
import type { TextOverflow } from "./unicode.js";

export type {
  TextGraphemeIndex,
  TextIndexSnapshot,
  TextLineIndex,
  TextSourceRange,
  TextUnicodeBoundaryState,
} from "./text-index.js";
export type {
  PreparedOverflowLine,
  PreparedTextCell,
  PreparedTextCounts,
  PreparedTextLine,
  PreparedTextWindow,
} from "./text-window.js";

/**
 * Mount-owned store for renderer-neutral text indexes. It owns entry
 * lifecycle for one mount and delegates compact indexing and bounded window
 * preparation to focused modules.
 */
export class TextStore {
  readonly #entries = new Map<number, CompactTextIndex>();
  #disposed = false;

  sync(root: SemanticNode, work?: RenderWorkTracker): void {
    if (this.#disposed) return;
    const activeIds = new Set<number>();
    visitTextNodes(root, (node) => {
      activeIds.add(node.id);
      const entry = this.#entries.get(node.id);
      if (entry === undefined) {
        this.#entries.set(node.id, new CompactTextIndex(node, work));
      } else {
        entry.update(node, work);
      }
    });
    work?.trackTextEntries(activeIds);

    for (const [id, entry] of this.#entries) {
      if (activeIds.has(id)) continue;
      entry.dispose();
      this.#entries.delete(id);
      work?.releaseTextEntry(id);
    }
  }

  preferredSize(nodeId: number): Size | null {
    return this.#entries.get(nodeId)?.preferredSize() ?? null;
  }

  prepare(
    node: TextNode,
    frame: Rect,
    clip: Rect,
    scroll: ScrollAxis | null,
    work?: RenderWorkTracker,
  ): PreparedTextWindow {
    return (
      this.#entries.get(node.id)?.prepare(node, frame, clip, scroll, work) ?? {
        lineStart: 0,
        lineEnd: 0,
        columnStart: 0,
        columnEnd: 0,
        baseY: frame.y,
        lines: [],
      }
    );
  }

  prepareOverflowLine(
    nodeId: number,
    lineIndex: number,
    frameWidth: number,
    overflow: TextOverflow,
    work?: RenderWorkTracker,
  ): PreparedOverflowLine {
    return (
      this.#entries
        .get(nodeId)
        ?.prepareOverflowLine(lineIndex, frameWidth, overflow, work) ?? {
        width: 0,
        cells: [],
      }
    );
  }

  clearPrepared(nodeId: number): void {
    this.#entries.get(nodeId)?.clearPrepared();
  }

  preparedCounts(): PreparedTextCounts {
    let cellSlots = 0;
    let copiedGlyphPayloadCodeUnits = 0;
    for (const entry of this.#entries.values()) {
      const counts = entry.preparedCounts();
      cellSlots += counts.cellSlots;
      copiedGlyphPayloadCodeUnits += counts.copiedGlyphPayloadCodeUnits;
    }
    return { cellSlots, copiedGlyphPayloadCodeUnits };
  }

  lineText(nodeId: number, lineIndex: number): string | null {
    return this.#entries.get(nodeId)?.lineText(lineIndex) ?? null;
  }

  inspect(nodeId: number): TextIndexSnapshot | null {
    return this.#entries.get(nodeId)?.snapshot() ?? null;
  }

  snapshots(): readonly TextIndexSnapshot[] {
    return Object.freeze(
      [...this.#entries.values()]
        .sort((left, right) => left.nodeId - right.nodeId)
        .map((entry) => entry.snapshot()),
    );
  }

  clear(work?: RenderWorkTracker): void {
    for (const [id, entry] of this.#entries) {
      entry.dispose();
      work?.releaseTextEntry(id);
    }
    this.#entries.clear();
  }

  dispose(work?: RenderWorkTracker): void {
    if (this.#disposed) return;
    this.clear(work);
    this.#disposed = true;
  }
}

function visitTextNodes(
  root: SemanticNode,
  visit: (node: TextNode) => void,
): void {
  if (root.kind === "text") {
    visit(root);
    return;
  }
  for (const child of root.children) visitTextNodes(child, visit);
}
