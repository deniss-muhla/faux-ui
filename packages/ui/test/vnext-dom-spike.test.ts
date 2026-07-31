import { describe, expect, it } from "vitest";

import {
  clientPointToCell,
  fitCells,
} from "../src/internal/dom-scene.js";

describe("vNext DOM sizing spike", () => {
  it("derives explicit integer root bounds from fixed host calibration", () => {
    expect(fitCells(803, 401, { width: 8, height: 16 })).toEqual({
      width: 100,
      height: 25,
    });
  });

  it("maps actual surface pixels to logical cells", () => {
    const rect = { left: 37, top: 29, width: 160, height: 64 };
    const size = { width: 20, height: 4 };

    expect(clientPointToCell(rect, size, 37, 29)).toEqual({ x: 0, y: 0 });
    expect(clientPointToCell(rect, size, 37 + 8 * 7 + 4, 29 + 16 * 2 + 8)).toEqual({
      x: 7,
      y: 2,
    });
    expect(clientPointToCell(rect, size, 197, 30)).toBeNull();
  });
});
