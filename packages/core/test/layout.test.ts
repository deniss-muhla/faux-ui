import { describe, expect, it, vi } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
  type TextLayoutRequest,
  layoutNode,
  updateTextNode,
} from "../src/index.js";

describe("layout computation", () => {
  it("lays out text via the delegated measurer", () => {
    const node = createTextNode({
      spec: { text: "hello", wrap: false, style: null },
    });
    const size = layoutNode(
      node,
      { maxWidth: 4 },
      {
        measureText: ({ text, maxWidth }: TextLayoutRequest) => ({
          width: maxWidth ?? text.length,
          height: 1,
        }),
      },
    );

    expect(size).toEqual({ width: 4, height: 1 });
    expect(node.layout.contentSize).toEqual({ width: 4, height: 1 });
  });

  it("lays out a default single-cell view and caches the result", () => {
    const root = createViewNode();
    const child = createTextNode({
      spec: { text: "title", wrap: false, style: null },
    });
    appendChild(root, child);

    const measureText = vi.fn(({ text }: TextLayoutRequest) => ({
      width: text.length,
      height: 1,
    }));

    const first = layoutNode(root, {}, { measureText });
    const second = layoutNode(root, {}, { measureText });

    expect(first).toEqual({ width: 5, height: 1 });
    expect(second).toEqual(first);
    expect(measureText).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached parent layout when a child text node changes", () => {
    const root = createViewNode();
    const child = createTextNode({
      spec: { text: "a", wrap: false, style: null },
    });
    appendChild(root, child);

    const measureText = vi.fn(({ text }: TextLayoutRequest) => ({
      width: text.length,
      height: 1,
    }));

    layoutNode(root, {}, { measureText });
    updateTextNode(child, { text: "abcd" });
    const size = layoutNode(root, {}, { measureText });

    expect(size).toEqual({ width: 4, height: 1 });
    expect(measureText).toHaveBeenCalledTimes(4);
  });

  it("keeps full content size for scroll views while clamping viewport size", () => {
    const root = createViewNode({
      spec: { rows: ["auto", "auto"], scroll: "y" },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "one", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "two", wrap: false, style: null } }),
    );

    const size = layoutNode(
      root,
      { maxHeight: 1 },
      {
        measureText: ({ text }: TextLayoutRequest) => ({
          width: text.length,
          height: 1,
        }),
      },
    );

    expect(size).toEqual({ width: 3, height: 1 });
    expect(root.layout.contentSize).toEqual({ width: 3, height: 2 });
  });

  it("throws for child overflow beyond available cells", () => {
    const root = createViewNode({
      spec: { rows: ["auto"], columns: ["auto"] },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "a", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "b", wrap: false, style: null } }),
    );

    expect(() =>
      layoutNode(
        root,
        {},
        {
          measureText: ({ text }: TextLayoutRequest) => ({
            width: text.length,
            height: 1,
          }),
        },
      ),
    ).toThrow(/only 1 cells/);
  });
});
