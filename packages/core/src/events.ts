import {
  hitTestRenderTree,
  type Point,
  type RenderHit,
  type RenderTree,
  type RenderTreeNode,
} from "./render-tree.js";
import type { ScrollOffset } from "./render-tree.js";
import type { BoundAction, BoundActions } from "./ui-node.js";

export type BindingName = keyof BoundActions;
export type PointerButton = "primary" | "middle" | "secondary";

export interface PointerModifiers {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface PointerDispatchMeta {
  point: Point;
  button: PointerButton | null;
  modifiers: PointerModifiers;
}

export interface EventTargetHandle {
  id: number;
  kind: "view" | "text";
}

export interface DispatchEventBase {
  currentTarget: EventTargetHandle;
  target: EventTargetHandle;
  nativeEvent: unknown;
}

export interface FocusEvent extends DispatchEventBase {}

export interface KeyEvent extends DispatchEventBase {
  key: string;
}

export interface ActivationEvent extends DispatchEventBase {
  key?: string;
  point?: Point;
  button: PointerButton | null;
  modifiers: PointerModifiers;
}

export interface PointerEvent extends DispatchEventBase {
  point?: Point;
  button: PointerButton | null;
  modifiers: PointerModifiers;
}

export interface ScrollEvent extends PointerEvent {
  delta: ScrollOffset;
}

export type DispatchHandlerResolver<THandler> = (
  action: BoundAction,
  dispatchAction: DispatchAction,
  result: DispatchResult,
) => THandler | undefined;

export interface DispatchAction {
  binding: BindingName;
  action: BoundAction;
  nodeId: number;
  currentTarget: RenderTreeNode;
  target: RenderTreeNode;
}

export interface DispatchResult {
  hit: RenderHit | null;
  actions: DispatchAction[];
}

export interface ResolvedDispatchAction<THandler> extends DispatchAction {
  handler: THandler;
}

export interface DispatchExecution<THandler> extends DispatchResult {
  binding: BindingName;
  target: RenderTreeNode | null;
  resolvedActions: ResolvedDispatchAction<THandler>[];
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

    const action = currentTarget.node.bindings?.[binding];
    if (action === undefined) {
      continue;
    }

    actions.push({
      binding,
      action,
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

export function resolveDispatchResult<THandler>(
  binding: BindingName,
  result: DispatchResult,
  resolveHandler: DispatchHandlerResolver<THandler>,
): DispatchExecution<THandler> {
  const resolvedActions: ResolvedDispatchAction<THandler>[] = [];

  for (const action of result.actions) {
    const handler = resolveHandler(action.action, action, result);
    if (handler === undefined) {
      continue;
    }

    resolvedActions.push({
      ...action,
      handler,
    });
  }

  return {
    ...result,
    binding,
    target: result.hit?.node ?? null,
    resolvedActions,
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
