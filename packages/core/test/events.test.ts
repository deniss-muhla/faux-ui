import { describe, expect, it } from "vitest";

import {
  appendChild,
  buildRenderTree,
  collectDispatchActions,
  createTextNode,
  createViewNode,
  dispatchBindingAtPoint,
  resolveDispatchResult,
  hitTestRenderTree,
  resolveFocusTarget,
  resolveFocusTargetAtPoint,
} from "../src/index.js";

const ROOT_CONSTRAINTS = { maxWidth: 8, maxHeight: 4 };

describe("render-tree events", () => {
  it("collects bubbling actions from the hit path", () => {
    const root = createViewNode({ bindings: { click: "root-click" } });
    const focusable = createViewNode({
      bindings: { click: "child-click" },
      spec: { focusable: true },
    });
    const leaf = createTextNode({
      bindings: { click: "leaf-click" },
      spec: { text: "A", wrap: false, style: null },
    });
    appendChild(focusable, leaf);
    appendChild(root, focusable);

    const tree = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });
    const hit = hitTestRenderTree(tree, { x: 0, y: 0 });
    const actions = collectDispatchActions(hit, "click");

    expect(actions.map((action) => action.token)).toEqual([
      "leaf-click",
      "child-click",
      "root-click",
    ]);
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
      constraints: ROOT_CONSTRAINTS,
    });
    const hit = hitTestRenderTree(tree, { x: 0, y: 0 });

    expect(resolveFocusTarget(hit)?.nodeId).toBe(child.id);
    expect(resolveFocusTargetAtPoint(tree, { x: 0, y: 0 })?.nodeId).toBe(
      child.id,
    );
  });

  it("dispatches from a point in one step", () => {
    const root = createViewNode({ bindings: { click: "root" } });
    const leaf = createTextNode({
      bindings: { click: "leaf" },
      spec: { text: "A", wrap: false, style: null },
    });
    appendChild(root, leaf);

    const tree = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });
    const result = dispatchBindingAtPoint(tree, { x: 0, y: 0 }, "click");

    expect(result.hit?.node.nodeId).toBe(leaf.id);
    expect(result.actions.map((action) => action.token)).toEqual([
      "leaf",
      "root",
    ]);
  });

  it("resolves dispatch results into application handlers", () => {
    const root = createViewNode({ bindings: { click: "root" } });
    const leaf = createTextNode({
      bindings: { click: "leaf" },
      spec: { text: "A", wrap: false, style: null },
    });
    appendChild(root, leaf);

    const tree = buildRenderTree(root, {
      constraints: ROOT_CONSTRAINTS,
    });
    const result = dispatchBindingAtPoint(tree, { x: 0, y: 0 }, "click");
    const execution = resolveDispatchResult("click", result, (token) => {
      if (token === "leaf") {
        return "open-leaf";
      }

      return undefined;
    });

    expect(execution.binding).toBe("click");
    expect(execution.target?.nodeId).toBe(leaf.id);
    expect(execution.resolvedActions).toEqual([
      expect.objectContaining({
        token: "leaf",
        handler: "open-leaf",
      }),
    ]);
  });
});
