import { appendChild, createTextNode, createViewNode } from "@faux-ui/core";
import { describe, expect, it } from "vitest";

import {
  canvasRendererMetadata,
  createCanvasThemeTarget,
  describeCanvasTree,
} from "../src/canvas-renderer.js";

describe("canvas example renderer", () => {
  it("describes a faux-ui tree as deterministic canvas lines", () => {
    const root = createViewNode({
      spec: {
        rows: [1, 1],
        focusable: true,
        style: { background: "bgAlt" },
      },
    });

    appendChild(
      root,
      createTextNode({
        spec: {
          text: "Canvas example",
          style: { color: "accent" },
        },
      }),
    );

    expect(describeCanvasTree(root)).toMatchInlineSnapshot(`
      "view [interactive] rows=[1,1]
        text \"Canvas example\""
    `);
  });

  it("stores semantic tokens in the local theme target helper", () => {
    const themeTarget = createCanvasThemeTarget({ accent: "#0055aa" });
    themeTarget.setThemeVariable("--faux-ui-color-selection", "#e2fff5");

    expect(themeTarget.variables).toEqual({
      accent: "#0055aa",
      selection: "#e2fff5",
    });
    expect(canvasRendererMetadata.capabilities.supportsThemeTarget).toBe(true);
  });
});
