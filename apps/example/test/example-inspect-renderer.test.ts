import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { renderWithRenderer } from "@faux-ui/app";
import {
  createInspectThemeTarget,
  inspectRenderer,
  inspectRendererCapabilities,
  inspectRendererMetadata,
} from "@faux-ui/render-inspect";

import { ExampleApp } from "../src/example-app.js";

describe("example inspect renderer", () => {
  it("renders the shared example app through the first-party proof renderer", () => {
    const themeTarget = createInspectThemeTarget();
    inspectRenderer.applyTheme?.(themeTarget, {
      accent: "#0055aa",
      selection: "#e2fff5",
    });

    const mounted = renderWithRenderer(createElement(ExampleApp), {
      renderer: inspectRenderer,
      rendererOptions: {
        themeTarget,
      },
    });

    const snapshot = mounted.snapshot();

    expect(snapshot).toContain('text "shared faux-ui studio"');
    expect(snapshot).toContain('text "Renderer contract"');
    expect(snapshot).toContain(
      'text "Platform detection now lives only in renderer definitions."',
    );
    expect(themeTarget.variables.accent).toBe("#0055aa");
    expect(mounted.getCapabilities()).toEqual(inspectRendererCapabilities);
    expect(inspectRendererMetadata.themeTargetExample).toBe(
      "createInspectThemeTarget()",
    );

    mounted.unmount();
  });
});
