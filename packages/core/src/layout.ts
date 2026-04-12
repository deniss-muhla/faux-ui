import { resolveTracks } from "./resolveTracks.js";
import {
  clearPaintDirty,
  commitLayout,
  type LayoutComputation,
  type Rect,
  type TrackPlacement,
  type TextNode,
  type UINode,
  type ViewNode,
} from "./ui-node.js";
import {
  normalizeResolvedSize,
  clampSize,
  normalizeTrackList,
  readTrackName,
  type Constraints,
  type Size,
  type TrackShorthand,
} from "./types.js";

export function layoutNode(node: UINode, constraints: Constraints): Size {
  const computation = computeLayout(node, constraints);
  return computation.size;
}

export function computeLayout(
  node: UINode,
  constraints: Constraints,
): LayoutComputation {
  if (canReuseLayout(node, constraints)) {
    const contentSize =
      node.layout.contentSize === undefined
        ? undefined
        : cloneSize(node.layout.contentSize);
    const rowSizes =
      node.layout.rowSizes === undefined
        ? undefined
        : [...node.layout.rowSizes];
    const columnSizes =
      node.layout.columnSizes === undefined
        ? undefined
        : [...node.layout.columnSizes];
    const childFrames =
      node.layout.childFrames === undefined
        ? undefined
        : node.layout.childFrames.map(cloneRect);

    return withOptionalLayoutFields({
      constraints,
      size: cloneSize(node.layout.cachedSize!),
      ...(contentSize !== undefined ? { contentSize } : {}),
      ...(rowSizes !== undefined ? { rowSizes } : {}),
      ...(columnSizes !== undefined ? { columnSizes } : {}),
      ...(childFrames !== undefined ? { childFrames } : {}),
    });
  }

  const computation =
    node.kind === "text"
      ? computeTextLayout(node, constraints)
      : computeViewLayout(node, constraints);

  const nextComputation = withOptionalLayoutFields({
    constraints,
    size: computation.size,
    ...(computation.contentSize !== undefined
      ? { contentSize: computation.contentSize }
      : {}),
    ...(computation.rowSizes !== undefined
      ? { rowSizes: computation.rowSizes }
      : {}),
    ...(computation.columnSizes !== undefined
      ? { columnSizes: computation.columnSizes }
      : {}),
    ...(computation.childFrames !== undefined
      ? { childFrames: computation.childFrames }
      : {}),
  });

  commitLayout(node, nextComputation);
  clearPaintDirty(node);
  return computation;
}

function canReuseLayout(node: UINode, constraints: Constraints): boolean {
  return (
    !node.dirtyLayout &&
    node.layout.cachedSize !== undefined &&
    node.layout.cachedSubtreeRevision === node.subtreeRevision &&
    sameConstraints(node.layout.cachedConstraints, constraints)
  );
}

function computeTextLayout(
  node: TextNode,
  constraints: Constraints,
): LayoutComputation {
  const measured = measureTextContent(node.spec.text);

  return withOptionalLayoutFields({
    constraints,
    size: {
      width: clampSize(measured.width, constraints.maxWidth),
      height: clampSize(measured.height, constraints.maxHeight),
    },
    contentSize: {
      width: measured.width,
      height: measured.height,
    },
  });
}

function computeViewLayout(
  node: ViewNode,
  constraints: Constraints,
): LayoutComputation {
  const { rows, columns } = normalizeViewTracks(
    node.spec.rows,
    node.spec.columns,
  );
  const placements = buildPlacements(node, rows, columns);

  const widthForTracks =
    node.spec.scroll === "x" || node.spec.scroll === "both"
      ? undefined
      : constraints.maxWidth;
  const heightForTracks =
    node.spec.scroll === "y" || node.spec.scroll === "both"
      ? undefined
      : constraints.maxHeight;

  const columnSizes = resolveTracks(
    normalizeTrackList(columns),
    widthForTracks,
    (columnIndex) => {
      let maxWidth = 0;
      for (const childIndex of placements.byColumn[columnIndex] ?? []) {
        const child = node.children[childIndex];
        if (child === undefined) {
          continue;
        }

        const childSize = layoutNode(child, {});
        maxWidth = Math.max(maxWidth, childSize.width);
      }
      return maxWidth;
    },
  );

  const rowSizes = resolveTracks(
    normalizeTrackList(rows),
    heightForTracks,
    (rowIndex) => {
      let maxHeight = 0;
      for (const childIndex of placements.byRow[rowIndex] ?? []) {
        const child = node.children[childIndex];
        if (child === undefined) {
          continue;
        }

        const childSize = layoutNode(child, {});
        maxHeight = Math.max(maxHeight, childSize.height);
      }
      return maxHeight;
    },
  );

  const childFrames: Rect[] = [];
  let bubbledContentWidth = columnSizes.reduce((sum, size) => sum + size, 0);
  let bubbledContentHeight = rowSizes.reduce((sum, size) => sum + size, 0);
  let offsetY = 0;
  for (let rowIndex = 0; rowIndex < rowSizes.length; rowIndex += 1) {
    const rowHeight = rowSizes[rowIndex] ?? 0;
    let offsetX = 0;
    for (
      let columnIndex = 0;
      columnIndex < columnSizes.length;
      columnIndex += 1
    ) {
      const columnWidth = columnSizes[columnIndex] ?? 0;
      const childIndex = placements.cells[rowIndex]?.[columnIndex];
      if (childIndex !== undefined) {
        const child = node.children[childIndex];
        if (child !== undefined) {
          const childComputation = computeLayout(child, {
            maxWidth: columnWidth,
            maxHeight: rowHeight,
          });
          const childSize = childComputation.size;
          const childContentSize = childComputation.contentSize ?? childSize;

          childFrames[childIndex] = {
            x: offsetX,
            y: offsetY,
            width: Math.min(childSize.width, columnWidth),
            height: Math.min(childSize.height, rowHeight),
          };

          bubbledContentWidth = Math.max(
            bubbledContentWidth,
            offsetX + childContentSize.width,
          );
          bubbledContentHeight = Math.max(
            bubbledContentHeight,
            offsetY + childContentSize.height,
          );
        }
      }
      offsetX += columnWidth;
    }
    offsetY += rowHeight;
  }

  const contentSize = {
    width: bubbledContentWidth,
    height: bubbledContentHeight,
  };

  return withOptionalLayoutFields({
    constraints,
    size: {
      width: clampSize(contentSize.width, constraints.maxWidth),
      height: clampSize(contentSize.height, constraints.maxHeight),
    },
    contentSize,
    rowSizes,
    columnSizes,
    childFrames,
  });
}

function normalizeViewTracks(
  rows: TrackShorthand[] | null,
  columns: TrackShorthand[] | null,
): { rows: TrackShorthand[]; columns: TrackShorthand[] } {
  if (rows === null && columns === null) {
    return { rows: ["1fr"], columns: ["1fr"] };
  }

  if (rows !== null && columns === null) {
    return { rows: [...rows], columns: ["1fr"] };
  }

  if (rows === null && columns !== null) {
    return { rows: ["1fr"], columns: [...columns] };
  }

  return { rows: [...rows!], columns: [...columns!] };
}

function withOptionalLayoutFields(computation: {
  constraints: Constraints;
  size: Size;
  contentSize?: Size;
  rowSizes?: number[];
  columnSizes?: number[];
  childFrames?: Rect[];
}): LayoutComputation {
  return {
    constraints: computation.constraints,
    size: computation.size,
    ...(computation.contentSize !== undefined
      ? { contentSize: computation.contentSize }
      : {}),
    ...(computation.rowSizes !== undefined
      ? { rowSizes: computation.rowSizes }
      : {}),
    ...(computation.columnSizes !== undefined
      ? { columnSizes: computation.columnSizes }
      : {}),
    ...(computation.childFrames !== undefined
      ? { childFrames: computation.childFrames }
      : {}),
  };
}

function buildPlacements(
  node: ViewNode,
  rows: TrackShorthand[],
  columns: TrackShorthand[],
) {
  const capacity = rows.length * columns.length;
  if (node.children.length > capacity) {
    throw new Error(
      `View ${node.id} has ${node.children.length} children but only ${capacity} cells.`,
    );
  }

  const cells: Array<Array<number | undefined>> = rows.map(() =>
    columns.map(() => undefined),
  );
  const byRow: number[][] = rows.map(() => []);
  const byColumn: number[][] = columns.map(() => []);

  const rowNames = buildTrackNameMap(rows, "row");
  const columnNames = buildTrackNameMap(columns, "column");
  const autoChildren: number[] = [];

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (child === undefined) {
      continue;
    }

    const placement = readChildPlacement(child);
    if (placement.row === null && placement.column === null) {
      autoChildren.push(index);
      continue;
    }

    placeChild(
      node.id,
      index,
      placement.row,
      placement.column,
      cells,
      byRow,
      byColumn,
      rowNames,
      columnNames,
    );
  }

  for (const childIndex of autoChildren) {
    placeAutoChild(node.id, childIndex, cells, byRow, byColumn);
  }

  return { cells, byRow, byColumn };
}

function buildTrackNameMap(
  tracks: TrackShorthand[],
  axis: "row" | "column",
): Map<string, number> {
  const names = new Map<string, number>();

  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    if (track === undefined) {
      continue;
    }

    const name = readTrackName(track);
    if (name === null) {
      continue;
    }

    if (names.has(name)) {
      throw new Error(`Duplicate ${axis} track name: ${name}`);
    }

    names.set(name, index);
  }

  return names;
}

function readChildPlacement(child: UINode): {
  row: TrackPlacement | null;
  column: TrackPlacement | null;
} {
  return {
    row: child.spec.row,
    column: child.spec.column,
  };
}

function placeChild(
  nodeId: number,
  childIndex: number,
  rowPlacement: TrackPlacement | null,
  columnPlacement: TrackPlacement | null,
  cells: Array<Array<number | undefined>>,
  byRow: number[][],
  byColumn: number[][],
  rowNames: Map<string, number>,
  columnNames: Map<string, number>,
): void {
  const rowIndex = resolvePlacement(
    nodeId,
    rowPlacement,
    rowNames,
    cells.length,
    "row",
  );
  const columnIndex = resolvePlacement(
    nodeId,
    columnPlacement,
    columnNames,
    cells[0]?.length ?? 0,
    "column",
  );

  if (rowIndex !== null && columnIndex !== null) {
    occupyCell(nodeId, childIndex, rowIndex, columnIndex, cells, byRow, byColumn);
    return;
  }

  if (rowIndex !== null) {
    for (let nextColumn = 0; nextColumn < (cells[rowIndex]?.length ?? 0); nextColumn += 1) {
      if (cells[rowIndex]?.[nextColumn] === undefined) {
        occupyCell(
          nodeId,
          childIndex,
          rowIndex,
          nextColumn,
          cells,
          byRow,
          byColumn,
        );
        return;
      }
    }

    throw new Error(
      `View ${nodeId} could not place child ${childIndex} in row ${String(rowPlacement)}.`,
    );
  }

  if (columnIndex !== null) {
    for (let nextRow = 0; nextRow < cells.length; nextRow += 1) {
      if (cells[nextRow]?.[columnIndex] === undefined) {
        occupyCell(
          nodeId,
          childIndex,
          nextRow,
          columnIndex,
          cells,
          byRow,
          byColumn,
        );
        return;
      }
    }

    throw new Error(
      `View ${nodeId} could not place child ${childIndex} in column ${String(columnPlacement)}.`,
    );
  }
}

function placeAutoChild(
  nodeId: number,
  childIndex: number,
  cells: Array<Array<number | undefined>>,
  byRow: number[][],
  byColumn: number[][],
): void {
  for (let rowIndex = 0; rowIndex < cells.length; rowIndex += 1) {
    for (
      let columnIndex = 0;
      columnIndex < (cells[rowIndex]?.length ?? 0);
      columnIndex += 1
    ) {
      if (cells[rowIndex]?.[columnIndex] === undefined) {
        occupyCell(
          nodeId,
          childIndex,
          rowIndex,
          columnIndex,
          cells,
          byRow,
          byColumn,
        );
        return;
      }
    }
  }

  throw new Error(`View ${nodeId} has no remaining free cells.`);
}

function occupyCell(
  nodeId: number,
  childIndex: number,
  rowIndex: number,
  columnIndex: number,
  cells: Array<Array<number | undefined>>,
  byRow: number[][],
  byColumn: number[][],
): void {
  if (cells[rowIndex]?.[columnIndex] !== undefined) {
    throw new Error(
      `View ${nodeId} has multiple children targeting row ${rowIndex} column ${columnIndex}.`,
    );
  }

  cells[rowIndex]![columnIndex] = childIndex;
  byRow[rowIndex]!.push(childIndex);
  byColumn[columnIndex]!.push(childIndex);
}

function resolvePlacement(
  nodeId: number,
  placement: TrackPlacement | null,
  names: Map<string, number>,
  length: number,
  axis: "row" | "column",
): number | null {
  if (placement === null) {
    return null;
  }

  if (typeof placement === "number") {
    if (placement >= 0 && placement < length) {
      return placement;
    }

    throw new Error(
      `View ${nodeId} ${axis} placement ${placement} is outside the available tracks.`,
    );
  }

  const namedIndex = names.get(placement);
  if (namedIndex !== undefined) {
    return namedIndex;
  }

  throw new Error(`View ${nodeId} references unknown ${axis} track: ${placement}`);
}

function sameConstraints(
  left: Constraints | undefined,
  right: Constraints,
): boolean {
  return (
    left?.maxWidth === right.maxWidth && left?.maxHeight === right.maxHeight
  );
}

function cloneRect(rect: Rect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function cloneSize(size: Size): Size {
  return {
    width: size.width,
    height: size.height,
  };
}

function measureTextContent(text: string): Size {
  const lines = text.split("\n");
  let width = 0;

  for (const line of lines) {
    width = Math.max(width, line.length);
  }

  return {
    width: normalizeResolvedSize(width),
    height: normalizeResolvedSize(lines.length),
  };
}
