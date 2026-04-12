import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  createInspectThemeTarget,
  inspectRenderer,
  inspectRendererCapabilities,
  inspectRendererMetadata,
  render,
} from "../src/index.js";

describe("inspect renderer", () => {
  it("captures a stable tree snapshot", () => {
    const mounted = render(
      createElement(
        "view" as any,
        { rows: [1, 1], style: { background: "bgAlt" } },
        createElement(
          "text" as any,
          { style: { color: "accent" } },
          "Hello inspect renderer",
        ),
      ),
    );

    expect(mounted.snapshot()).toMatchInlineSnapshot(`
      "view rows=[1,1] style={background:bgAlt}
        text \"Hello inspect renderer\" style={color:accent}"
    `);
    mounted.unmount();
  });

  it("applies theme tokens to the theme target helper", () => {
    const target = createInspectThemeTarget();

    inspectRenderer.applyTheme?.(target, {
      accent: "#0055aa",
      focus: "#d0f0ff",
    });

    expect(target.variables).toEqual({
      accent: "#0055aa",
      focus: "#d0f0ff",
    });
  });

  it("exports capability and metadata examples", () => {
    expect(inspectRendererCapabilities.supportsThemeTarget).toBe(true);
    expect(inspectRendererMetadata.capabilities).toEqual(
      inspectRendererCapabilities,
    );
    expect(inspectRendererMetadata.themeTargetExample).toBe(
      "createInspectThemeTarget()",
    );
  });
});
