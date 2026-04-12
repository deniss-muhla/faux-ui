import { createElement, isValidElement } from "react";
import { describe, expect, it } from "vitest";

import type { RendererDefinition } from "../../renderer/src/index.js";
import { UiRuntimeProvider } from "../../ui/src/index.js";
import { render, renderWithRenderer } from "../src/index.js";

interface StubMountedRenderer {
  node: unknown;
  options: { label?: string } | undefined;
  unmount(): void;
}

describe("@faux-ui/app", () => {
  it("accepts injected renderer objects through render()", () => {
    const renderer = createStubRenderer();

    const mounted = render(createElement("div", null, "hello"), {
      renderer,
      rendererOptions: { label: "inspect" },
    });

    expect(mounted.options).toEqual({ label: "inspect" });
    expect(isValidElement(mounted.node)).toBe(true);
    expect(
      isValidElement(mounted.node) ? mounted.node.type : null,
    ).toBe(UiRuntimeProvider);
  });

  it("wraps renderWithRenderer() output with UiRuntimeProvider", () => {
    const renderer = createStubRenderer();

    const mounted = renderWithRenderer(createElement("div", null, "hello"), {
      renderer,
      rendererOptions: { label: "inspect" },
    });

    expect(mounted.options).toEqual({ label: "inspect" });
    expect(isValidElement(mounted.node)).toBe(true);
    expect(
      isValidElement(mounted.node) ? mounted.node.type : null,
    ).toBe(UiRuntimeProvider);
  });
});

function createStubRenderer(): RendererDefinition<
  { label?: string },
  StubMountedRenderer
> {
  return {
    name: "stub",
    detect() {
      return false;
    },
    render(node, options) {
      return {
        node,
        options,
        unmount() {},
      };
    },
  };
}
