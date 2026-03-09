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
import type { RenderOptions } from "./render.js";

export type TuiInputOptions = RenderOptions;
export type TuiPoint = Point;

export function dispatchTuiBinding(
  root: UINode,
  options: TuiInputOptions,
  point: TuiPoint,
  binding: BindingName,
): DispatchResult {
  const tree = buildTuiInputTree(root, options);
  return dispatchBindingAtPoint(tree, point, binding);
}

export function resolveTuiBinding<THandler>(
  root: UINode,
  options: TuiInputOptions,
  point: TuiPoint,
  binding: BindingName,
  resolveHandler: DispatchHandlerResolver<THandler>,
): DispatchExecution<THandler> {
  return resolveDispatchResult(
    binding,
    dispatchTuiBinding(root, options, point, binding),
    resolveHandler,
  );
}

export function resolveTuiFocusTarget(
  root: UINode,
  options: TuiInputOptions,
  point: TuiPoint,
): RenderTreeNode | null {
  const tree = buildTuiInputTree(root, options);
  return resolveFocusTargetAtPoint(tree, point);
}

function buildTuiInputTree(root: UINode, options: TuiInputOptions) {
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
