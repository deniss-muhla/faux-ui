import { describe, expect, it } from "vitest";
import { isValidElement } from "react";

import { Tile } from "../src/index.js";

describe("surface", () => {
  it("creates a tile element with optional slots", () => {
    const node = Tile({
      label: "surface",
      title: "Tile",
      description: "Card-like presentation",
      footer: "Shared surface package",
    });

    expect(isValidElement(node)).toBe(true);
    expect(node?.props.rows).toEqual([1, 1, 1, 1]);
  });

  it("becomes focusable when interactive", () => {
    const node = Tile({
      title: "Selectable tile",
      onPress: () => {},
      variant: "selected",
    });

    expect(node?.props.focusable).toBe(true);
    expect(typeof node?.props.onClick).toBe("function");
  });
});
