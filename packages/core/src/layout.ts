import { resolveTracks } from "./resolveTracks.js";
import {
  clearPaintDirty,
  commitLayout,
  type LayoutComputation,
  type Rect,
  type TextNode,
  type UINode,
  type ViewNode,
} from "./ui-node.js";
import {
  clampSize,
  normalizeTrackList,
  type Constraints,
  type Size,
  type TrackShorthand,
} from "./types.js";

export interface TextLayoutRequest {
  text: string;
  wrap: boolean;
  maxWidth: number | undefined;
}

export interface LayoutContext {
  measureText(request: TextLayoutRequest): Size;
}

export function layoutNode(
  node: UINode,
  constraints: Constraints,
  context: LayoutContext,
): Size {
  const computation = computeLayout(node, constraints, context);
  return computation.size;
}

export function computeLayout(
  node: UINode,
  constraints: Constraints,
  context: LayoutContext,
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
      ? computeTextLayout(node, constraints, context)
      : computeViewLayout(node, constraints, context);

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
  context: LayoutContext,
): LayoutComputation {
  const measured = context.measureText({
    text: node.spec.text,
    wrap: node.spec.wrap,
    maxWidth: constraints.maxWidth,
  });

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
  context: LayoutContext,
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

        const childSize = layoutNode(child, {}, context);
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

        const childSize = layoutNode(child, {}, context);
        maxHeight = Math.max(maxHeight, childSize.height);
      }
      return maxHeight;
    },
  );

  const childFrames: Rect[] = [];
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
          const childSize = layoutNode(
            child,
            {
              maxWidth: columnWidth,
              maxHeight: rowHeight,
            },
            context,
          );

          childFrames[childIndex] = {
            x: offsetX,
            y: offsetY,
            width: Math.min(childSize.width, columnWidth),
            height: Math.min(childSize.height, rowHeight),
          };
        }
      }
      offsetX += columnWidth;
    }
    offsetY += rowHeight;
  }

  const contentSize = {
    width: columnSizes.reduce((sum, size) => sum + size, 0),
    height: rowSizes.reduce((sum, size) => sum + size, 0),
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

  for (let index = 0; index < node.children.length; index += 1) {
    const rowIndex = Math.floor(index / columns.length);
    const columnIndex = index % columns.length;
    cells[rowIndex]![columnIndex] = index;
    byRow[rowIndex]!.push(index);
    byColumn[columnIndex]!.push(index);
  }

  return { cells, byRow, byColumn };
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
