import {
  buildRenderTree,
  dispatchBindingAtPoint,
  resolveDispatchResult,
  type DispatchHandlerResolver,
  resolveFocusTargetAtPoint,
  type BindingName,
  type DispatchExecution,
  type DispatchResult,
  type Point,
  type RenderTreeNode,
  type UINode,
} from "@faux-ui/core";

import type { DomRenderOptions } from "./model.js";

export type DomInputOptions = DomRenderOptions;
export type DomPoint = Point;

export function dispatchDomBinding(
  root: UINode,
  options: DomInputOptions,
  point: DomPoint,
  binding: BindingName,
): DispatchResult {
  const tree = buildDomInputTree(root, options);
  return dispatchBindingAtPoint(tree, point, binding);
}

export function resolveDomBinding<THandler>(
  root: UINode,
  options: DomInputOptions,
  point: DomPoint,
  binding: BindingName,
  resolveHandler: DispatchHandlerResolver<THandler>,
): DispatchExecution<THandler> {
  return resolveDispatchResult(
    binding,
    dispatchDomBinding(root, options, point, binding),
    resolveHandler,
  );
}

export function resolveDomFocusTarget(
  root: UINode,
  options: DomInputOptions,
  point: DomPoint,
): RenderTreeNode | null {
  const tree = buildDomInputTree(root, options);
  return resolveFocusTargetAtPoint(tree, point);
}

function buildDomInputTree(root: UINode, options: DomInputOptions) {
  return buildRenderTree(
    root,
    options.scrollOffsets === undefined
      ? {
          constraints: options.constraints,
        }
      : {
          constraints: options.constraints,
          scrollOffsets: options.scrollOffsets,
        },
  );
}
