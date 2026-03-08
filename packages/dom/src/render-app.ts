import type { ReactNode } from "react";

import type { BindingToken, UINode } from "@faux-ui/core";
import {
  createReconciler,
  type FauxRoot,
  type StatefulApp,
} from "@faux-ui/reconciler";

import {
  mountDomRoot,
  type DomMountOptions,
  type DomDispatchEvent,
  type DomFocusChangeEvent,
  type MountedDomRoot,
} from "./runtime.js";
import { createBrowserDomTextMeasurer } from "./text-measurer.js";

export interface MountedRenderedDomApp<THandler = unknown> {
  update(
    node?: ReactNode,
    options?: Partial<Omit<DomMountOptions<THandler>, "container">>,
  ): void;
  rerender(): void;
  unmount(): void;
  getMountedNode(): UINode | null;
  getRuntime(): MountedDomRoot<THandler>;
}

export interface DomAppViewState {
  focusedNodeLabel: string;
}

export interface WindowLike {
  addEventListener(type: "resize", listener: () => void): void;
  removeEventListener(type: "resize", listener: () => void): void;
}

export interface RenderStatefulDomAppOptions<
  TState,
  TAction,
  THandler extends () => void = () => void,
> extends Omit<
  DomMountOptions<THandler>,
  | "resolveAction"
  | "onDispatch"
  | "onFocusChange"
  | "measureText"
  | "constraints"
> {
  app: StatefulApp<TState, TAction, DomAppViewState>;
  mapAction(token: BindingToken): TAction | undefined;
  measureText?: DomMountOptions<THandler>["measureText"];
  constraints?: DomMountOptions<THandler>["constraints"];
  readConstraints?: () => NonNullable<DomMountOptions<THandler>["constraints"]>;
  autoResize?: boolean;
  window?: WindowLike;
  onDispatch?: (event: DomDispatchEvent<THandler>) => void;
  onFocusChange?: (event: DomFocusChangeEvent) => void;
}

export interface MountedStatefulDomApp<
  TState,
  TAction,
  THandler extends () => void = () => void,
> {
  update(
    options?: Partial<
      Omit<
        RenderStatefulDomAppOptions<TState, TAction, THandler>,
        "app" | "mapAction"
      >
    >,
  ): void;
  rerender(): void;
  unmount(): void;
  getApp(): StatefulApp<TState, TAction, DomAppViewState>;
  getRuntime(): MountedDomRoot<THandler>;
}

export function renderDom(
  node: ReactNode,
  options: DomMountOptions,
): MountedRenderedDomApp;
export function renderDom<THandler>(
  node: ReactNode,
  options: DomMountOptions<THandler>,
): MountedRenderedDomApp<THandler>;
export function renderDom<THandler>(
  node: ReactNode,
  options: DomMountOptions<THandler>,
): MountedRenderedDomApp<THandler> {
  const reconciler = createReconciler();
  const root = reconciler.createRoot();
  let currentNode = node;

  root.render(currentNode);
  const runtime = mountDomRoot<THandler>(
    requireRenderedRoot(root, "DOM"),
    options,
  );

  return {
    update(nextNode, nextOptions) {
      if (nextNode !== undefined) {
        currentNode = nextNode;
        root.render(currentNode);
      }

      runtime.update(requireRenderedRoot(root, "DOM"), nextOptions);
    },
    rerender() {
      runtime.rerender();
    },
    unmount() {
      runtime.unmount();
      root.unmount();
    },
    getMountedNode() {
      return root.getMountedNode();
    },
    getRuntime() {
      return runtime;
    },
  };
}

export function renderStatefulDomApp<TState, TAction>(
  options: RenderStatefulDomAppOptions<TState, TAction>,
): MountedStatefulDomApp<TState, TAction>;
export function renderStatefulDomApp<
  TState,
  TAction,
  THandler extends () => void,
>(
  options: RenderStatefulDomAppOptions<TState, TAction, THandler>,
): MountedStatefulDomApp<TState, TAction, THandler>;
export function renderStatefulDomApp<
  TState,
  TAction,
  THandler extends () => void,
>(
  options: RenderStatefulDomAppOptions<TState, TAction, THandler>,
): MountedStatefulDomApp<TState, TAction, THandler> {
  let currentOptions = { ...options };
  let focusRenderQueued = false;
  let pendingFocusedNodeLabel = options.app.getViewState().focusedNodeLabel;
  const measureText =
    options.measureText ?? createBrowserDomTextMeasurer().measure;

  const runtime = mountDomRoot<THandler>(requireAppRoot(options.app, "DOM"), {
    ...options,
    constraints: resolveConstraints(options),
    measureText,
    resolveAction(token) {
      const action = currentOptions.mapAction(token);
      return action === undefined
        ? undefined
        : (options.app.createActionHandler(action) as THandler);
    },
    onDispatch(event) {
      for (const action of event.execution?.resolvedActions ?? []) {
        action.handler();
      }

      syncFocusedNodeLabel(readFocusedNodeLabel());
      currentOptions.onDispatch?.(event);
    },
    onFocusChange(event) {
      syncFocusedNodeLabel(
        event.nodeId === null ? "none" : `node ${String(event.nodeId)}`,
      );
      currentOptions.onFocusChange?.(event);
    },
  });

  const unsubscribe = options.app.subscribe((nextRoot) => {
    if (nextRoot === null) {
      return;
    }

    runtime.update(nextRoot, {
      constraints: resolveConstraints(currentOptions),
    });
  });

  const windowLike = currentOptions.window ?? readGlobalWindow();
  const resizeListener = () => {
    runtime.update(undefined, {
      constraints: resolveConstraints(currentOptions),
    });
  };
  const useAutoResize = currentOptions.autoResize === true;
  if (useAutoResize && windowLike !== null) {
    windowLike.addEventListener("resize", resizeListener);
  }

  return {
    update(nextOptions) {
      currentOptions = {
        ...currentOptions,
        ...nextOptions,
      };
      runtime.update(undefined, {
        constraints: resolveConstraints(currentOptions),
      });
    },
    rerender() {
      runtime.rerender();
    },
    unmount() {
      if (useAutoResize && windowLike !== null) {
        windowLike.removeEventListener("resize", resizeListener);
      }
      unsubscribe();
      runtime.unmount();
      options.app.unmount();
    },
    getApp() {
      return options.app;
    },
    getRuntime() {
      return runtime;
    },
  };

  function syncFocusedNodeLabel(nextLabel: string): void {
    if (pendingFocusedNodeLabel === nextLabel) {
      return;
    }

    pendingFocusedNodeLabel = nextLabel;
    if (focusRenderQueued) {
      return;
    }

    focusRenderQueued = true;
    queueMicrotask(() => {
      focusRenderQueued = false;
      options.app.updateViewState((current) => {
        return current.focusedNodeLabel === pendingFocusedNodeLabel
          ? current
          : {
              ...current,
              focusedNodeLabel: pendingFocusedNodeLabel,
            };
      });
    });
  }

  function readFocusedNodeLabel(): string {
    const nodeId = runtime.getFocusedNodeId() ?? null;
    return nodeId === null ? "none" : `node ${String(nodeId)}`;
  }
}

function requireRenderedRoot(root: FauxRoot, target: string): UINode {
  const mountedNode = root.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected a single mounted ${target} root node.`);
  }

  return mountedNode;
}

function requireAppRoot<TState, TAction>(
  app: StatefulApp<TState, TAction, DomAppViewState>,
  target: string,
): UINode {
  const mountedNode = app.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected the ${target} app root node to be mounted.`);
  }

  return mountedNode;
}

function resolveConstraints<TState, TAction, THandler extends () => void>(
  options: RenderStatefulDomAppOptions<TState, TAction, THandler>,
): NonNullable<DomMountOptions<THandler>["constraints"]> {
  return options.readConstraints?.() ?? options.constraints ?? {};
}

function readGlobalWindow(): WindowLike | null {
  const windowLike = (globalThis as { window?: WindowLike }).window;
  return windowLike ?? null;
}
