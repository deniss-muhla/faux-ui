import { describe, expect, it } from "vitest";

import { lineCellWidth, splitGraphemes, Text } from "@faux-ui/ui";
import { renderStatic } from "@faux-ui/ui/testing";
import { createElement } from "react";

describe("production Unicode helpers", () => {
  it("matches the renderer's grapheme and cell-width behavior", () => {
    const value = "A古é👩‍💻";
    const app = renderStatic(createElement(Text, null, value), {
      width: lineCellWidth(value),
      height: 1,
    });

    try {
      expect(splitGraphemes(value)).toEqual(["A", "古", "é", "👩‍💻"]);
      expect(lineCellWidth(value)).toBe(6);
      expect(app.getText()).toBe(value);
    } finally {
      app.unmount();
    }
  });
});
