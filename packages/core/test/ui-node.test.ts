import { describe, expect, it } from "vitest";

import {
  appendChild,
  clearPaintDirty,
  clearPaintDirtySubtree,
  commitLayout,
  createTextNode,
  createViewNode,
  replaceChildren,
  setNodeBindings,
  updateTextNode,
  updateViewNode,
} from "../src/index.js";

describe("UINode core", () => {
  it("creates nodes with stable mutable layout state", () => {
    const node = createViewNode({ spec: { rows: ["auto"], focusable: true } });

    expect(node.kind).toBe("view");
    expect(node.id).toBeGreaterThan(0);
    expect(node.spec.rows).toEqual(["auto"]);
    expect(node.spec.columns).toBeNull();
    expect(node.dirtyLayout).toBe(true);
    expect(node.dirtyIntrinsic).toBe(true);
    expect(node.dirtyPaint).toBe(true);
  });

  it("attaches and replaces children deterministically", () => {
    const parent = createViewNode();
    const first = createTextNode({
      spec: { text: "first", wrap: false, style: null },
    });
    const second = createTextNode({
      spec: { text: "second", wrap: false, style: null },
    });

    appendChild(parent, first);
    replaceChildren(parent, [second]);

    expect(parent.children).toEqual([second]);
    expect(first.parent).toBeNull();
    expect(second.parent).toBe(parent);
  });

  it("marks layout and paint when view tracks change", () => {
    const parent = createViewNode();
    const child = createViewNode();
    appendChild(parent, child);
    commitLayout(child, { size: { width: 10, height: 2 } });
    clearPaintDirty(child);

    const changed = updateViewNode(child, { columns: ["1fr", "2fr"] });

    expect(changed).toBe(true);
    expect(child.spec.columns).toEqual(["1fr", "2fr"]);
    expect(child.dirtyLayout).toBe(true);
    expect(child.dirtyPaint).toBe(true);
    expect(parent.subtreeRevision).toBeGreaterThan(0);
  });

  it("marks intrinsic, layout, and paint when text inputs change", () => {
    const node = createTextNode({
      spec: { text: "hello", wrap: false, style: null },
    });
    commitLayout(node, { size: { width: 5, height: 1 } });
    clearPaintDirty(node);

    const changed = updateTextNode(node, { text: "hello world", wrap: true });

    expect(changed).toBe(true);
    expect(node.dirtyIntrinsic).toBe(true);
    expect(node.dirtyLayout).toBe(true);
    expect(node.dirtyPaint).toBe(true);
    expect(node.revision).toBe(1);
  });

  it("marks paint only for style and bindings changes", () => {
    const node = createViewNode();
    commitLayout(node, { size: { width: 4, height: 4 } });
    clearPaintDirty(node);

    const styleChanged = updateViewNode(node, { style: { color: "accent" } });
    const bindingsChanged = setNodeBindings(node, { click: 7 });

    expect(styleChanged).toBe(true);
    expect(bindingsChanged).toBe(true);
    expect(node.dirtyLayout).toBe(false);
    expect(node.dirtyIntrinsic).toBe(false);
    expect(node.dirtyPaint).toBe(true);
    expect(node.bindings).toEqual({ click: 7 });
  });

  it("propagates paint dirtiness to ancestors and can clear a subtree", () => {
    const parent = createViewNode();
    const child = createTextNode({
      spec: { text: "child", wrap: false, style: null },
    });
    appendChild(parent, child);
    clearPaintDirty(parent);
    clearPaintDirty(child);

    updateTextNode(child, { style: { color: "accent" } });

    expect(child.dirtyPaint).toBe(true);
    expect(parent.dirtyPaint).toBe(true);

    clearPaintDirtySubtree(parent);

    expect(child.dirtyPaint).toBe(false);
    expect(parent.dirtyPaint).toBe(false);
  });
});
