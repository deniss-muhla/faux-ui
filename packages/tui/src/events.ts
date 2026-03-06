import {
  buildRenderTree,
  dispatchBindingAtPoint,
  resolveFocusTargetAtPoint,
  type BindingName,
  type DispatchResult,
  type Point,
  type RenderTreeNode,
  type TextLayoutRequest,
  type UINode,
} from "@faux-ui/core";

import { createTuiTextMeasurer } from "./text-measurer.js";
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

export function resolveTuiFocusTarget(
  root: UINode,
  options: TuiInputOptions,
  point: TuiPoint,
): RenderTreeNode | null {
  const tree = buildTuiInputTree(root, options);
  return resolveFocusTargetAtPoint(tree, point);
}

function buildTuiInputTree(root: UINode, options: TuiInputOptions) {
  const measurer = createTuiTextMeasurer();

  return buildRenderTree(
    root,
    options.scrollOffsets === undefined
      ? {
          constraints: options.constraints,
          measureText: (request: TextLayoutRequest) =>
            measurer.measure(request),
        }
      : {
          constraints: options.constraints,
          scrollOffsets: options.scrollOffsets,
          measureText: (request: TextLayoutRequest) =>
            measurer.measure(request),
        },
  );
}
