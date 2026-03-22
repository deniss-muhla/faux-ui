import { describe, expect, it, vi } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
  layoutNode,
  updateTextNode,
} from "../src/index.js";

const ROOT_CONSTRAINTS = { maxWidth: 8, maxHeight: 4 };

describe("layout computation", () => {
  it("lays out text by character-cell extent and clamps the frame", () => {
    const node = createTextNode({
      spec: { text: "hello", wrap: false, style: null },
    });
    const size = layoutNode(node, { maxWidth: 4 });

    expect(size).toEqual({ width: 4, height: 1 });
    expect(node.layout.contentSize).toEqual({ width: 5, height: 1 });
  });

  it("lays out a default single-cell view and caches the result", () => {
    const root = createViewNode();
    const child = createTextNode({
      spec: { text: "title", wrap: false, style: null },
    });
    appendChild(root, child);

    const first = layoutNode(root, ROOT_CONSTRAINTS);
    const second = layoutNode(root, ROOT_CONSTRAINTS);

    expect(first).toEqual({ width: 8, height: 4 });
    expect(second).toEqual(first);
    expect(root.layout.layoutVersion).toBe(1);
  });

  it("invalidates cached parent layout when a child text node changes", () => {
    const root = createViewNode();
    const child = createTextNode({
      spec: { text: "a", wrap: false, style: null },
    });
    appendChild(root, child);

    layoutNode(root, ROOT_CONSTRAINTS);
    updateTextNode(child, { text: "abcd" });
    const size = layoutNode(root, ROOT_CONSTRAINTS);

    expect(size).toEqual({ width: 8, height: 4 });
    expect(root.layout.layoutVersion).toBe(2);
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

    const size = layoutNode(root, { maxWidth: 8, maxHeight: 1 });

    expect(size).toEqual({ width: 8, height: 1 });
    expect(root.layout.contentSize).toEqual({ width: 8, height: 2 });
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

    expect(() => layoutNode(root, ROOT_CONSTRAINTS)).toThrow(/only 1 cells/);
  });
});
