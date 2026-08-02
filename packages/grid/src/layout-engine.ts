import type { Track } from "@faux-ui/ui";
import type {
  LayoutEngine,
  LayoutInput,
  Rect,
  Size,
} from "@faux-ui/ui/layout";

import type { GridGaps, PlacedItem } from "./types.js";

interface GridLayoutOptions {
  readonly items: readonly PlacedItem[];
  readonly columns: readonly Track[];
  readonly rows: readonly Track[];
  readonly gap: GridGaps;
}

interface ResolvedAxis {
  readonly sizes: readonly number[];
  readonly starts: readonly number[];
  readonly extent: number;
}

export function createGridLayout(options: GridLayoutOptions): LayoutEngine {
  const preferred = (children: readonly Size[]): Size => {
    assertChildSizes(children, options.items.length);
    const columnSizes = intrinsicTrackSizes(
      options.columns,
      options.items,
      children,
      "x",
      options.gap.x,
    );
    const rowSizes = intrinsicTrackSizes(
      options.rows,
      options.items,
      children,
      "y",
      options.gap.y,
    );
    return {
      width: axisExtent(columnSizes, options.gap.x),
      height: axisExtent(rowSizes, options.gap.y),
    };
  };

  return {
    preferred,
    layout(input: LayoutInput) {
      assertChildSizes(input.children, options.items.length);
      const intrinsicColumns = intrinsicTrackSizes(
        options.columns,
        options.items,
        input.children,
        "x",
        options.gap.x,
      );
      const intrinsicRows = intrinsicTrackSizes(
        options.rows,
        options.items,
        input.children,
        "y",
        options.gap.y,
      );
      const columns = resolveAxis(
        options.columns,
        intrinsicColumns,
        input.size.width,
        options.gap.x,
      );
      const rows = resolveAxis(
        options.rows,
        intrinsicRows,
        input.size.height,
        options.gap.y,
      );
      const frames = options.items.map((item) =>
        gridAreaRect(item, columns, rows, options.gap)
      );
      return {
        children: frames,
        contentSize: {
          width: columns.extent,
          height: rows.extent,
        },
      };
    },
  };
}

function intrinsicTrackSizes(
  tracks: readonly Track[],
  items: readonly PlacedItem[],
  children: readonly Size[],
  axis: "x" | "y",
  gap: number,
): number[] {
  const sizes = tracks.map((track) => typeof track === "number" ? track : 0);
  const ordered = items
    .map((item, index) => ({ item, index }))
    .toSorted((a, b) => axisSpan(a.item, axis) - axisSpan(b.item, axis));

  for (const { item, index } of ordered) {
    const start = axisStart(item, axis);
    const span = axisSpan(item, axis);
    const preferred = children[index]?.[axis === "x" ? "width" : "height"] ?? 0;
    const current = sum(sizes.slice(start, start + span)) + gap * (span - 1);
    const deficit = Math.max(0, preferred - current);
    if (deficit === 0) continue;
    const flexible = Array.from({ length: span }, (_, offset) => start + offset)
      .filter((trackIndex) => typeof tracks[trackIndex] !== "number");
    distribute(deficit, flexible, tracks, sizes);
  }
  return sizes;
}

function distribute(
  amount: number,
  indexes: readonly number[],
  tracks: readonly Track[],
  output: number[],
): void {
  if (indexes.length === 0 || amount === 0) return;
  const weights = indexes.map((index) => fractionWeight(tracks[index]) || 1);
  const total = sum(weights);
  let used = 0;
  for (const [position, index] of indexes.entries()) {
    const share = Math.floor(amount * (weights[position] ?? 1) / total);
    output[index] = (output[index] ?? 0) + share;
    used += share;
  }
  let remainder = amount - used;
  for (const index of indexes) {
    if (remainder === 0) break;
    output[index] = (output[index] ?? 0) + 1;
    remainder -= 1;
  }
}

function resolveAxis(
  tracks: readonly Track[],
  intrinsic: readonly number[],
  available: number,
  gap: number,
): ResolvedAxis {
  const gapCost = gap * Math.max(0, tracks.length - 1);
  const sizes = tracks.map((track, index) => {
    if (typeof track === "number") return track;
    if (track === "auto") return intrinsic[index] ?? 0;
    return 0;
  });
  const remaining = Math.max(0, available - gapCost - sum(sizes));
  const fractions = tracks.flatMap((track, index) =>
    typeof track === "string" && track.endsWith("fr") ? [index] : [],
  );
  const totalFraction = fractions.reduce(
    (total, index) => total + fractionWeight(tracks[index]),
    0,
  );
  if (remaining > 0 && totalFraction > 0) {
    let used = 0;
    for (const index of fractions) {
      const value = Math.floor(
        remaining * fractionWeight(tracks[index]) / totalFraction,
      );
      sizes[index] = value;
      used += value;
    }
    let remainder = remaining - used;
    for (const index of fractions) {
      if (remainder === 0) break;
      sizes[index] = (sizes[index] ?? 0) + 1;
      remainder -= 1;
    }
  }

  const extent = axisExtent(sizes, gap);
  const starts: number[] = [];
  let cursor = 0;
  for (const size of sizes) {
    starts.push(cursor);
    cursor += size + gap;
  }
  return { sizes, starts, extent };
}

function gridAreaRect(
  item: PlacedItem,
  columns: ResolvedAxis,
  rows: ResolvedAxis,
  gap: GridGaps,
): Rect {
  const x = columns.starts[item.placedColumn] ?? 0;
  const y = rows.starts[item.placedRow] ?? 0;
  return {
    x,
    y,
    width:
      sum(columns.sizes.slice(
        item.placedColumn,
        item.placedColumn + item.columnSpan,
      )) + gap.x * (item.columnSpan - 1),
    height:
      sum(rows.sizes.slice(item.placedRow, item.placedRow + item.rowSpan)) +
      gap.y * (item.rowSpan - 1),
  };
}

function axisStart(item: PlacedItem, axis: "x" | "y"): number {
  return axis === "x" ? item.placedColumn : item.placedRow;
}

function axisSpan(item: PlacedItem, axis: "x" | "y"): number {
  return axis === "x" ? item.columnSpan : item.rowSpan;
}

function axisExtent(sizes: readonly number[], gap: number): number {
  return sum(sizes) + gap * Math.max(0, sizes.length - 1);
}

function fractionWeight(track: Track | undefined): number {
  return typeof track === "string" && track.endsWith("fr")
    ? Number.parseFloat(track.slice(0, -2))
    : 0;
}

function assertChildSizes(children: readonly Size[], expected: number): void {
  if (children.length !== expected) {
    throw new Error(
      `Grid layout received ${children.length} children; expected ${expected}.`,
    );
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
