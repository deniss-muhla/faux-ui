import { Box } from "@faux-ui/ui";
import { Layout } from "@faux-ui/ui/layout";
import {
  Children,
  Fragment,
  cloneElement,
  createElement,
  isValidElement,
  type Key,
  type ReactElement,
  type ReactNode,
} from "react";

import { createGridLayout } from "./layout-engine.js";
import { placeItems } from "./placement.js";
import type {
  GridItemProps,
  GridProps,
  ItemSpec,
} from "./types.js";
import {
  MAX_GRID_TRACKS,
  extendTracks,
  normalizeGap,
  normalizeTracks,
  optionalLine,
  positiveInteger,
} from "./validation.js";

export type {
  GridGap,
  GridItemProps,
  GridProps,
} from "./types.js";
export { repeat } from "./validation.js";

/** Deterministic CSS-grid-like cell layout. */
export function Grid({
  columns,
  rows = [],
  gap = 0,
  children,
  ...boxProps
}: GridProps): ReactNode {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("Grid columns must be a non-empty track array.");
  }
  if (!Array.isArray(rows)) {
    throw new Error("Grid rows must be a track array.");
  }
  if (columns.length > MAX_GRID_TRACKS || rows.length > MAX_GRID_TRACKS) {
    throw new Error(
      `Grid cannot define more than ${MAX_GRID_TRACKS} tracks per axis.`,
    );
  }

  const normalizedColumns = normalizeTracks(columns, "Grid columns");
  const normalizedRows = normalizeTracks(rows, "Grid rows");
  const normalizedGap = normalizeGap(gap);
  const childArray = flattenGridChildren(children);
  const specs = childArray.map((child, sourceIndex) =>
    readItem(child, sourceIndex),
  );
  const placement = placeItems(
    specs,
    normalizedColumns.length,
    normalizedRows.length,
  );
  const columnTracks = extendTracks(
    normalizedColumns,
    placement.columnCount,
    "auto",
  );
  const rowTracks = extendTracks(
    normalizedRows,
    placement.rowCount,
    "auto",
  );
  const layout = createGridLayout({
    items: placement.items,
    columns: columnTracks,
    rows: rowTracks,
    gap: normalizedGap,
  });

  return createElement(
    Layout,
    { ...boxProps, layout },
    placement.items.map((item) => item.element),
  );
}

/** Placement/container wrapper consumed as a direct Grid child. */
export function GridItem(_props: GridItemProps): ReactNode {
  throw new Error("GridItem must be rendered as a direct child of Grid.");
}

function readItem(child: ReactNode, sourceIndex: number): ItemSpec {
  if (!isGridItem(child)) {
    if (!isValidElement(child)) {
      throw new Error(
        "Grid children must be semantic React elements; wrap text in <Text>.",
      );
    }
    return {
      sourceIndex,
      row: null,
      column: null,
      rowSpan: 1,
      columnSpan: 1,
      element: cloneElement(child, { key: itemKey(child, sourceIndex) }),
    };
  }

  const {
    row,
    column,
    rowSpan = 1,
    columnSpan = 1,
    children,
    ...boxProps
  } = child.props;
  const normalizedRowSpan = positiveInteger(rowSpan, "GridItem rowSpan");
  const normalizedColumnSpan = positiveInteger(
    columnSpan,
    "GridItem columnSpan",
  );

  return {
    sourceIndex,
    row: optionalLine(row, "GridItem row"),
    column: optionalLine(column, "GridItem column"),
    rowSpan: normalizedRowSpan,
    columnSpan: normalizedColumnSpan,
    element: createElement(
      Box,
      { key: itemKey(child, sourceIndex), ...boxProps },
      children,
    ),
  };
}

function flattenGridChildren(children: ReactNode): ReactNode[] {
  const output: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (
      isValidElement<{ readonly children?: ReactNode }>(child) &&
      child.type === Fragment
    ) {
      output.push(...flattenGridChildren(child.props.children));
    } else if (
      child !== null &&
      child !== undefined &&
      typeof child !== "boolean"
    ) {
      output.push(child);
    }
  });
  return output;
}

function itemKey(child: ReactNode, sourceIndex: number): Key {
  return isValidElement(child) && child.key !== null
    ? child.key
    : `grid-item-${sourceIndex}`;
}

function isGridItem(child: ReactNode): child is ReactElement<GridItemProps> {
  return isValidElement<GridItemProps>(child) && child.type === GridItem;
}

export const VERSION = "0.1.0";
