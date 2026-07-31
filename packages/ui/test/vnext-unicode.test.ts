import { describe, expect, it } from "vitest";

import {
  CELL_WIDTH_IMPLEMENTATION,
  TAB_WIDTH,
  UNICODE_VERSION,
  cellizeLine,
  clipCellGraphemes,
  graphemeCellWidth,
  lineCellWidth,
  splitGraphemes,
  textPreferredSize,
} from "../src/internal/unicode.js";

describe("vNext Unicode cellization", () => {
  it("pins internal Unicode data without a runtime package", () => {
    expect(UNICODE_VERSION).toBe("17.0.0");
    expect(CELL_WIDTH_IMPLEMENTATION).toBe("faux-ui-unicode-17");
  });

  it("segments combining, emoji ZWJ, flags, and Indic conjuncts", () => {
    expect(splitGraphemes("Ae\u0301👩‍💻🇺🇸क्‍ष")).toEqual([
      "A",
      "é",
      "👩‍💻",
      "🇺🇸",
      "क्‍ष",
    ]);
  });

  it("assigns narrow, wide, combining, and emoji widths", () => {
    expect(graphemeCellWidth("A")).toBe(1);
    expect(graphemeCellWidth("古")).toBe(2);
    expect(graphemeCellWidth("\u0301")).toBe(0);
    expect(graphemeCellWidth("❤")).toBe(1);
    expect(graphemeCellWidth("❤️")).toBe(2);
    expect(graphemeCellWidth("👩‍💻")).toBe(2);
    expect(graphemeCellWidth("·")).toBe(1);
  });

  it("uses deterministic tab stops and control replacement", () => {
    expect(TAB_WIDTH).toBe(4);
    expect(cellizeLine("A\tB")).toEqual([
      { glyph: "A", width: 1 },
      { glyph: " ", width: 1 },
      { glyph: " ", width: 1 },
      { glyph: " ", width: 1 },
      { glyph: "B", width: 1 },
    ]);
    expect(cellizeLine("A\u0000B")).toEqual([
      { glyph: "A", width: 1 },
      { glyph: "�", width: 1 },
      { glyph: "B", width: 1 },
    ]);
    expect(cellizeLine("\u0301")).toEqual([{ glyph: "◌́", width: 1 }]);
  });

  it("measures explicit lines in cells", () => {
    expect(lineCellWidth("A古é👩‍💻")).toBe(6);
    expect(textPreferredSize("A古\n\n👩‍💻")).toEqual({
      width: 3,
      height: 3,
    });
    expect(textPreferredSize("")).toEqual({ width: 0, height: 1 });
  });

  it("clips without emitting half a wide grapheme", () => {
    const input = cellizeLine("A古BC");
    expect(clipCellGraphemes(input, 2, "clip")).toEqual([
      { glyph: "A", width: 1 },
    ]);
    expect(clipCellGraphemes(input, 4, "ellipsis-end")).toEqual([
      { glyph: "A", width: 1 },
      { glyph: "古", width: 2 },
      { glyph: "…", width: 1 },
    ]);
    expect(clipCellGraphemes(input, 4, "ellipsis-start")).toEqual([
      { glyph: "…", width: 1 },
      { glyph: "B", width: 1 },
      { glyph: "C", width: 1 },
    ]);
    expect(clipCellGraphemes(input, 4, "ellipsis-middle")).toEqual([
      { glyph: "A", width: 1 },
      { glyph: "…", width: 1 },
      { glyph: "C", width: 1 },
    ]);
  });
});
