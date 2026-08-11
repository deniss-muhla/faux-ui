import {
  EMOJI_PRESENTATION_RANGES,
  EXTENDED_PICTOGRAPHIC_RANGES,
  GRAPHEME_RANGES,
  INDIC_CONJUNCT_RANGES,
  UNICODE_VERSION,
  WIDE_RANGES,
} from "./unicode-data.js";

export { UNICODE_VERSION };

export const CELL_WIDTH_IMPLEMENTATION = "faux-ui-unicode-17";
export const TAB_WIDTH = 4;

export type TextOverflow =
  | "clip"
  | "ellipsis-start"
  | "ellipsis-middle"
  | "ellipsis-end";

export interface CellGrapheme {
  readonly glyph: string;
  readonly width: 1 | 2;
}

const enum GraphemeCategory {
  Other = 0,
  CR = 1,
  LF = 2,
  Control = 3,
  Extend = 4,
  ZWJ = 5,
  RegionalIndicator = 6,
  Prepend = 7,
  SpacingMark = 8,
  L = 9,
  V = 10,
  T = 11,
  LV = 12,
  LVT = 13,
}

const enum IndicCategory {
  None = 0,
  Consonant = 1,
  Extend = 2,
  Linker = 3,
}

interface CodePointInfo {
  readonly value: number;
  readonly text: string;
  readonly grapheme: GraphemeCategory;
  readonly indic: IndicCategory;
  readonly extendedPictographic: boolean;
}

export function splitGraphemes(input: string): string[] {
  if (input.length === 0) return [];

  const points = Array.from(input, readCodePoint);
  const result: string[] = [];
  let current = points[0]?.text ?? "";

  for (let index = 1; index < points.length; index += 1) {
    if (hasGraphemeBreak(points, index)) {
      result.push(current);
      current = "";
    }
    current += points[index]?.text ?? "";
  }

  result.push(current);
  return result;
}

export function graphemeCellWidth(grapheme: string): 0 | 1 | 2 {
  if (grapheme.length === 0) return 0;

  const points = Array.from(grapheme, readCodePoint);
  if (points.some((point) => isControl(point.grapheme))) return 0;

  const forceText = points.some((point) => point.value === 0xfe0e);
  const forceEmoji = points.some((point) => point.value === 0xfe0f);
  const regionalIndicators = points.filter(
    (point) => point.grapheme === GraphemeCategory.RegionalIndicator,
  ).length;
  const emojiSequence =
    forceEmoji ||
    regionalIndicators >= 2 ||
    points.some((point) => point.value === 0x20e3) ||
    (points.some((point) => point.grapheme === GraphemeCategory.ZWJ) &&
      points.some((point) => point.extendedPictographic));

  if (
    !forceText &&
    (emojiSequence ||
      points.some((point) => inRanges(point.value, EMOJI_PRESENTATION_RANGES)))
  ) {
    return 2;
  }

  let width: 0 | 1 | 2 = 0;
  for (const point of points) {
    if (
      point.grapheme === GraphemeCategory.Extend ||
      point.grapheme === GraphemeCategory.ZWJ ||
      point.grapheme === GraphemeCategory.SpacingMark
    ) {
      continue;
    }

    const pointWidth: 1 | 2 = inRanges(point.value, WIDE_RANGES) ? 2 : 1;
    width = Math.max(width, pointWidth) as 1 | 2;
  }

  return width;
}

export function cellizeLine(input: string, startColumn = 0): CellGrapheme[] {
  const output: Array<{ glyph: string; width: 1 | 2 }> = [];
  let column = normalizeColumn(startColumn);

  for (const grapheme of splitGraphemes(input)) {
    if (grapheme === "\t") {
      const count = TAB_WIDTH - (column % TAB_WIDTH);
      for (let index = 0; index < count; index += 1) {
        output.push({ glyph: " ", width: 1 });
      }
      column += count;
      continue;
    }

    const points = Array.from(grapheme, readCodePoint);
    if (points.some((point) => isControl(point.grapheme))) {
      output.push({ glyph: "�", width: 1 });
      column += 1;
      continue;
    }

    const width = graphemeCellWidth(grapheme);
    if (width === 0) {
      const previous = output.at(-1);
      if (previous === undefined) {
        output.push({ glyph: `◌${grapheme}`, width: 1 });
        column += 1;
      } else {
        previous.glyph += grapheme;
      }
      continue;
    }

    output.push({ glyph: grapheme, width });
    column += width;
  }

  return output;
}

export function lineCellWidth(input: string, startColumn = 0): number {
  return cellizeLine(input, startColumn).reduce(
    (total, grapheme) => total + grapheme.width,
    0,
  );
}

export function clipCellGraphemes(
  graphemes: readonly CellGrapheme[],
  width: number,
  overflow: TextOverflow = "clip",
): CellGrapheme[] {
  const available = normalizeColumn(width);
  const total = graphemes.reduce((sum, grapheme) => sum + grapheme.width, 0);
  if (total <= available) return [...graphemes];
  if (available === 0) return [];

  if (overflow === "clip") {
    return takePrefix(graphemes, available);
  }

  const ellipsis: CellGrapheme = { glyph: "…", width: 1 };
  const contentWidth = available - 1;
  if (contentWidth === 0) return [ellipsis];

  if (overflow === "ellipsis-start") {
    return [ellipsis, ...takeSuffix(graphemes, contentWidth)];
  }

  if (overflow === "ellipsis-middle") {
    const leftWidth = Math.ceil(contentWidth / 2);
    const rightWidth = contentWidth - leftWidth;
    return [
      ...takePrefix(graphemes, leftWidth),
      ellipsis,
      ...takeSuffix(graphemes, rightWidth),
    ];
  }

  return [...takePrefix(graphemes, contentWidth), ellipsis];
}

export function textPreferredSize(text: string): {
  readonly width: number;
  readonly height: number;
} {
  const lines = text.split("\n");
  return {
    width: lines.reduce(
      (maximum, line) => Math.max(maximum, lineCellWidth(line)),
      0,
    ),
    height: lines.length,
  };
}

function readCodePoint(text: string): CodePointInfo {
  const value = text.codePointAt(0) ?? 0;
  return {
    value,
    text,
    grapheme: lookupCategory(
      value,
      GRAPHEME_RANGES,
    ) as GraphemeCategory,
    indic: lookupCategory(value, INDIC_CONJUNCT_RANGES) as IndicCategory,
    extendedPictographic: inRanges(value, EXTENDED_PICTOGRAPHIC_RANGES),
  };
}

function hasGraphemeBreak(
  points: readonly CodePointInfo[],
  index: number,
): boolean {
  const previous = points[index - 1];
  const next = points[index];
  if (previous === undefined || next === undefined) return true;

  // GB3
  if (
    previous.grapheme === GraphemeCategory.CR &&
    next.grapheme === GraphemeCategory.LF
  ) {
    return false;
  }

  // GB4 / GB5
  if (isControl(previous.grapheme) || isControl(next.grapheme)) return true;

  // GB6
  if (
    previous.grapheme === GraphemeCategory.L &&
    (next.grapheme === GraphemeCategory.L ||
      next.grapheme === GraphemeCategory.V ||
      next.grapheme === GraphemeCategory.LV ||
      next.grapheme === GraphemeCategory.LVT)
  ) {
    return false;
  }

  // GB7
  if (
    (previous.grapheme === GraphemeCategory.LV ||
      previous.grapheme === GraphemeCategory.V) &&
    (next.grapheme === GraphemeCategory.V ||
      next.grapheme === GraphemeCategory.T)
  ) {
    return false;
  }

  // GB8
  if (
    (previous.grapheme === GraphemeCategory.LVT ||
      previous.grapheme === GraphemeCategory.T) &&
    next.grapheme === GraphemeCategory.T
  ) {
    return false;
  }

  // GB9 / GB9a / GB9b
  if (
    next.grapheme === GraphemeCategory.Extend ||
    next.grapheme === GraphemeCategory.ZWJ ||
    next.grapheme === GraphemeCategory.SpacingMark ||
    previous.grapheme === GraphemeCategory.Prepend
  ) {
    return false;
  }

  // GB9c
  if (next.indic === IndicCategory.Consonant) {
    let cursor = index - 1;
    let foundLinker = false;
    while (cursor >= 0) {
      const category = points[cursor]?.indic ?? IndicCategory.None;
      if (category === IndicCategory.Linker) {
        foundLinker = true;
        cursor -= 1;
        continue;
      }
      if (category === IndicCategory.Extend) {
        cursor -= 1;
        continue;
      }
      break;
    }
    if (
      foundLinker &&
      (points[cursor]?.indic ?? IndicCategory.None) ===
        IndicCategory.Consonant
    ) {
      return false;
    }
  }

  // GB11
  if (
    previous.grapheme === GraphemeCategory.ZWJ &&
    next.extendedPictographic
  ) {
    let cursor = index - 2;
    while (
      cursor >= 0 &&
      points[cursor]?.grapheme === GraphemeCategory.Extend
    ) {
      cursor -= 1;
    }
    if (points[cursor]?.extendedPictographic === true) return false;
  }

  // GB12 / GB13
  if (
    previous.grapheme === GraphemeCategory.RegionalIndicator &&
    next.grapheme === GraphemeCategory.RegionalIndicator
  ) {
    let precedingRegionalIndicators = 0;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (
        points[cursor]?.grapheme !== GraphemeCategory.RegionalIndicator
      ) {
        break;
      }
      precedingRegionalIndicators += 1;
    }
    return precedingRegionalIndicators % 2 === 0;
  }

  return true;
}

function isControl(category: GraphemeCategory): boolean {
  return (
    category === GraphemeCategory.CR ||
    category === GraphemeCategory.LF ||
    category === GraphemeCategory.Control
  );
}

function lookupCategory(
  codePoint: number,
  ranges: readonly number[],
): number {
  let low = 0;
  let high = ranges.length / 3 - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const offset = middle * 3;
    const start = ranges[offset] ?? 0;
    const end = ranges[offset + 1] ?? 0;
    if (codePoint < start) {
      high = middle - 1;
    } else if (codePoint > end) {
      low = middle + 1;
    } else {
      return ranges[offset + 2] ?? 0;
    }
  }
  return 0;
}

function inRanges(codePoint: number, ranges: readonly number[]): boolean {
  let low = 0;
  let high = ranges.length / 2 - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const offset = middle * 2;
    const start = ranges[offset] ?? 0;
    const end = ranges[offset + 1] ?? 0;
    if (codePoint < start) {
      high = middle - 1;
    } else if (codePoint > end) {
      low = middle + 1;
    } else {
      return true;
    }
  }
  return false;
}

function takePrefix(
  graphemes: readonly CellGrapheme[],
  available: number,
): CellGrapheme[] {
  const output: CellGrapheme[] = [];
  let used = 0;
  for (const grapheme of graphemes) {
    if (used + grapheme.width > available) break;
    output.push(grapheme);
    used += grapheme.width;
  }
  return output;
}

function takeSuffix(
  graphemes: readonly CellGrapheme[],
  available: number,
): CellGrapheme[] {
  const output: CellGrapheme[] = [];
  let used = 0;
  for (let index = graphemes.length - 1; index >= 0; index -= 1) {
    const grapheme = graphemes[index];
    if (grapheme === undefined || used + grapheme.width > available) break;
    output.unshift(grapheme);
    used += grapheme.width;
  }
  return output;
}

function normalizeColumn(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
