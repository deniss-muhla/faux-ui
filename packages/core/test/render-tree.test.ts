import { describe, expect, it } from "vitest";

import {
  appendChild,
  buildRenderTree,
  createTextNode,
  createViewNode,
  hitTestRenderTree,
} from "../src/index.js";

const ROOT_CONSTRAINTS = { maxWidth: 8, maxHeight: 4 };

describe("render tree", () => {
  it("builds absolute frames from layout output", () => {
    const root = createViewNode({ spec: { columns: [3, 3] } });
    const left = createTextNode({
      spec: { text: "A", wrap: false, style: null },
    });
    const right = createTextNode({
      spec: { text: "B", wrap: false, style: null },
    });
    appendChild(root, left);
    appendChild(root, right);

    const tree = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });

    expect(tree.size).toEqual({ width: 8, height: 4 });
    expect(tree.root.children.map((child) => child.frame)).toEqual([
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 3, y: 0, width: 1, height: 1 },
    ]);
  });

  it("drops fully clipped children after scroll is applied", () => {
    const root = createViewNode({
      spec: { rows: ["auto", "auto"], scroll: "y" },
    });
    const first = createTextNode({
      spec: { text: "one", wrap: false, style: null },
    });
    const second = createTextNode({
      spec: { text: "two", wrap: false, style: null },
    });
    appendChild(root, first);
    appendChild(root, second);

    const tree = buildRenderTree(root, {
      constraints: { maxWidth: 8, maxHeight: 1 },
      scrollOffsets: new Map([[root.id, { x: 0, y: 1 }]]),
    });

    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0]?.nodeId).toBe(second.id);
    expect(tree.root.children[0]?.frame).toEqual({
      x: 0,
      y: 0,
      width: 3,
      height: 1,
    });
  });

  it("hit tests the deepest visible node", () => {
    const root = createViewNode({ spec: { columns: [3, 3] } });
    const left = createTextNode({
      spec: { text: "A", wrap: false, style: null },
    });
    const right = createTextNode({
      spec: { text: "B", wrap: false, style: null },
    });
    appendChild(root, left);
    appendChild(root, right);

    const tree = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });
    const hit = hitTestRenderTree(tree, { x: 3, y: 0 });

    expect(hit?.node.nodeId).toBe(right.id);
    expect(hit?.path.map((entry) => entry.nodeId)).toEqual([root.id, right.id]);
    expect(hit?.localPoint).toEqual({ x: 0, y: 0 });
  });

  it("falls back to the containing view for empty space", () => {
    const root = createViewNode({ spec: { columns: [3, 3] } });
    appendChild(
      root,
      createTextNode({ spec: { text: "A", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "B", wrap: false, style: null } }),
    );

    const tree = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });
    const hit = hitTestRenderTree(tree, { x: 2, y: 0 });

    expect(hit?.node.nodeId).toBe(root.id);
    expect(hit?.path.map((entry) => entry.nodeId)).toEqual([root.id]);
  });

  it("reuses the cached render tree until paint or scroll inputs change", () => {
    const root = createViewNode();
    const child = createTextNode({
      spec: { text: "A", wrap: false, style: null },
    });
    appendChild(root, child);

    const first = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });
    const second = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });

    expect(second).toBe(first);

    const third = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
      scrollOffsets: new Map([[root.id, { x: 1, y: 0 }]]),
    });

    expect(third).not.toBe(second);
  });
});
