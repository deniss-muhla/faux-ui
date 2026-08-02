import type {
  ItemSpec,
  PlacedItem,
  PlacementResult,
} from "./types.js";

export function placeItems(
  specs: readonly ItemSpec[],
  explicitColumns: number,
  explicitRows: number,
): PlacementResult {
  const byIndex = new Map<number, PlacedItem>();
  const occupied = new Set<string>();
  let columnCount = explicitColumns;
  let rowCount = explicitRows;

  for (const spec of specs) {
    if (spec.row === null || spec.column === null) continue;
    const placed = withPlacement(spec, spec.row, spec.column);
    byIndex.set(spec.sourceIndex, placed);
    columnCount = Math.max(columnCount, placed.placedColumn + placed.columnSpan);
    rowCount = Math.max(rowCount, placed.placedRow + placed.rowSpan);
    occupy(occupied, placed);
  }

  let cursorRow = 0;
  let cursorColumn = 0;

  for (const spec of specs) {
    if (byIndex.has(spec.sourceIndex)) continue;
    let row = spec.row;
    let column = spec.column;

    if (row !== null) {
      column = findColumn(occupied, row, column ?? 0, spec);
    } else if (column !== null) {
      row = findRow(occupied, column, row ?? 0, spec);
    } else {
      if (spec.columnSpan > columnCount) columnCount = spec.columnSpan;
      ({ row, column } = findRowFlow(
        occupied,
        { row: cursorRow, column: cursorColumn },
        spec,
        columnCount,
      ));
    }

    const placed = withPlacement(spec, row ?? 0, column ?? 0);
    byIndex.set(spec.sourceIndex, placed);
    columnCount = Math.max(columnCount, placed.placedColumn + placed.columnSpan);
    rowCount = Math.max(rowCount, placed.placedRow + placed.rowSpan);
    occupy(occupied, placed);

    cursorRow = placed.placedRow;
    cursorColumn = placed.placedColumn + placed.columnSpan;
    if (cursorColumn >= columnCount) {
      cursorColumn = 0;
      cursorRow += 1;
    }
  }

  return {
    items: specs.map((spec) => {
      const placed = byIndex.get(spec.sourceIndex);
      if (placed === undefined) {
        throw new Error(`Grid failed to place child ${spec.sourceIndex}.`);
      }
      return placed;
    }),
    rowCount,
    columnCount,
  };
}

function findRowFlow(
  occupied: ReadonlySet<string>,
  start: { readonly row: number; readonly column: number },
  spec: ItemSpec,
  columnCount: number,
): { readonly row: number; readonly column: number } {
  let row = start.row;
  let column = start.column;
  for (;;) {
    if (column + spec.columnSpan > columnCount) {
      row += 1;
      column = 0;
      continue;
    }
    if (fits(occupied, row, column, spec.rowSpan, spec.columnSpan)) {
      return { row, column };
    }
    column += 1;
  }
}

function findColumn(
  occupied: ReadonlySet<string>,
  row: number,
  startColumn: number,
  spec: ItemSpec,
): number {
  let column = startColumn;
  while (!fits(occupied, row, column, spec.rowSpan, spec.columnSpan)) {
    column += 1;
  }
  return column;
}

function findRow(
  occupied: ReadonlySet<string>,
  column: number,
  startRow: number,
  spec: ItemSpec,
): number {
  let row = startRow;
  while (!fits(occupied, row, column, spec.rowSpan, spec.columnSpan)) {
    row += 1;
  }
  return row;
}

function fits(
  occupied: ReadonlySet<string>,
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number,
): boolean {
  for (let y = row; y < row + rowSpan; y += 1) {
    for (let x = column; x < column + columnSpan; x += 1) {
      if (occupied.has(cellKey(y, x))) return false;
    }
  }
  return true;
}

function occupy(occupied: Set<string>, item: PlacedItem): void {
  for (let row = item.placedRow; row < item.placedRow + item.rowSpan; row += 1) {
    for (
      let column = item.placedColumn;
      column < item.placedColumn + item.columnSpan;
      column += 1
    ) {
      occupied.add(cellKey(row, column));
    }
  }
}

function withPlacement(
  spec: ItemSpec,
  row: number,
  column: number,
): PlacedItem {
  return { ...spec, placedRow: row, placedColumn: column };
}

function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}
