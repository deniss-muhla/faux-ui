import { describe, expect, it } from "vitest";
import { isValidElement } from "react";

import {
  Scaffold,
  defaultFoundationTheme,
  mergeFoundationTheme,
} from "../src/index.js";

describe("foundation", () => {
  it("merges nested theme overrides without dropping defaults", () => {
    const theme = mergeFoundationTheme({
      surface: { panel: "selection" },
    });

    expect(theme.surface.panel).toBe("selection");
    expect(theme.surface.canvas).toBe(defaultFoundationTheme.surface.canvas);
    expect(theme.action.focusBackground).toBe(
      defaultFoundationTheme.action.focusBackground,
    );
  });

  it("returns a renderer-neutral scaffold element", () => {
    const node = Scaffold({
      label: "foundation",
      title: "Gallery",
      description: "Stable shell",
      footer: "No DOM-only layout rules.",
      children: null,
    });

    expect(isValidElement(node)).toBe(true);
  });
});
