import {
  hitTestRenderTree,
  type Point,
  type RenderHit,
  type RenderTree,
  type RenderTreeNode,
} from "./render-tree.js";
import type { BindingToken, BoundActions } from "./ui-node.js";

export type BindingName = keyof BoundActions;

export interface DispatchAction {
  binding: BindingName;
  token: BindingToken;
  nodeId: number;
  currentTarget: RenderTreeNode;
  target: RenderTreeNode;
}

export interface DispatchResult {
  hit: RenderHit | null;
  actions: DispatchAction[];
}

export function collectDispatchActions(
  hit: RenderHit | null,
  binding: BindingName,
): DispatchAction[] {
  if (hit === null) {
    return [];
  }

  const actions: DispatchAction[] = [];
  for (let index = hit.path.length - 1; index >= 0; index -= 1) {
    const currentTarget = hit.path[index];
    if (currentTarget === undefined) {
      continue;
    }

    const token = currentTarget.node.bindings?.[binding];
    if (token === undefined) {
      continue;
    }

    actions.push({
      binding,
      token,
      nodeId: currentTarget.nodeId,
      currentTarget,
      target: hit.node,
    });
  }

  return actions;
}

export function dispatchBindingAtPoint(
  tree: RenderTree,
  point: Point,
  binding: BindingName,
): DispatchResult {
  const hit = hitTestRenderTree(tree, point);

  return {
    hit,
    actions: collectDispatchActions(hit, binding),
  };
}

export function resolveFocusTarget(
  hit: RenderHit | null,
): RenderTreeNode | null {
  if (hit === null) {
    return null;
  }

  for (let index = hit.path.length - 1; index >= 0; index -= 1) {
    const currentTarget = hit.path[index];
    if (
      currentTarget !== undefined &&
      currentTarget.kind === "view" &&
      currentTarget.node.spec.focusable
    ) {
      return currentTarget;
    }
  }

  return null;
}

export function resolveFocusTargetAtPoint(
  tree: RenderTree,
  point: Point,
): RenderTreeNode | null {
  return resolveFocusTarget(hitTestRenderTree(tree, point));
}
