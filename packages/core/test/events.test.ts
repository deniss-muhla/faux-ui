import { describe, expect, it } from "vitest";

import {
  appendChild,
  buildRenderTree,
  collectDispatchActions,
  createTextNode,
  createViewNode,
  dispatchBindingAtPoint,
  hitTestRenderTree,
  resolveFocusTarget,
  resolveFocusTargetAtPoint,
  type TextLayoutRequest,
} from "../src/index.js";

describe("render-tree events", () => {
  it("collects bubbling actions from the hit path", () => {
    const root = createViewNode({ bindings: { click: 30 } });
    const focusable = createViewNode({
      bindings: { click: 20 },
      spec: { focusable: true },
    });
    const leaf = createTextNode({
      bindings: { click: 10 },
      spec: { text: "A", wrap: false, style: null },
    });
    appendChild(focusable, leaf);
    appendChild(root, focusable);

    const tree = buildRenderTree(root, {
      constraints: {},
      measureText: ({ text }: TextLayoutRequest) => ({
        width: text.length,
        height: 1,
      }),
    });
    const hit = hitTestRenderTree(tree, { x: 0, y: 0 });
    const actions = collectDispatchActions(hit, "click");

    expect(actions.map((action) => action.token)).toEqual([10, 20, 30]);
    expect(actions.map((action) => action.nodeId)).toEqual([
      leaf.id,
      focusable.id,
      root.id,
    ]);
  });

  it("resolves the nearest focusable view on the hit path", () => {
    const root = createViewNode({ spec: { focusable: true } });
    const child = createViewNode({ spec: { focusable: true } });
    const leaf = createTextNode({
      spec: { text: "A", wrap: false, style: null },
    });
    appendChild(child, leaf);
    appendChild(root, child);

    const tree = buildRenderTree(root, {
      constraints: {},
      measureText: ({ text }: TextLayoutRequest) => ({
        width: text.length,
        height: 1,
      }),
    });
    const hit = hitTestRenderTree(tree, { x: 0, y: 0 });

    expect(resolveFocusTarget(hit)?.nodeId).toBe(child.id);
    expect(resolveFocusTargetAtPoint(tree, { x: 0, y: 0 })?.nodeId).toBe(
      child.id,
    );
  });

  it("dispatches from a point in one step", () => {
    const root = createViewNode({ bindings: { click: 2 } });
    const leaf = createTextNode({
      bindings: { click: 1 },
      spec: { text: "A", wrap: false, style: null },
    });
    appendChild(root, leaf);

    const tree = buildRenderTree(root, {
      constraints: {},
      measureText: ({ text }: TextLayoutRequest) => ({
        width: text.length,
        height: 1,
      }),
    });
    const result = dispatchBindingAtPoint(tree, { x: 0, y: 0 }, "click");

    expect(result.hit?.node.nodeId).toBe(leaf.id);
    expect(result.actions.map((action) => action.token)).toEqual([1, 2]);
  });
});
