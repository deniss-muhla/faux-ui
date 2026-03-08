import type { ReactNode } from "react";

import type { BindingToken, UINode } from "@faux-ui/core";
import {
  createReconciler,
  type FauxRoot,
  type StatefulApp,
} from "@faux-ui/reconciler";

import type { FrameBuffer } from "./frame-buffer.js";
import {
  mountTuiRoot,
  type MountedTuiRoot,
  type TuiDispatchEvent,
  type TuiFocusChangeEvent,
  type TuiRuntimeOptions,
} from "./runtime.js";
import {
  mountTerminalTuiHost,
  type MountedTerminalTuiHost,
  type TerminalTuiHostOptions,
} from "./terminal-host.js";

export interface MountedRenderedTuiApp<THandler = unknown> {
  update(
    node?: ReactNode,
    options?: Partial<TerminalTuiHostOptions<THandler>>,
  ): void;
  render(): FrameBuffer;
  rerender(): FrameBuffer;
  unmount(): void;
  isRunning(): boolean;
  getMountedNode(): UINode | null;
  getHost(): MountedTerminalTuiHost<THandler>;
}

export interface TuiAppViewState {
  focusedNodeLabel: string;
}

export interface RenderStatefulTuiAppOptions<
  TState,
  TAction,
  THandler extends () => void = () => void,
> extends Omit<
  TerminalTuiHostOptions<THandler>,
  "resolveAction" | "onDispatch" | "onFocusChange"
> {
  app: StatefulApp<TState, TAction, TuiAppViewState>;
  mapAction(token: BindingToken): TAction | undefined;
  onDispatch?: (event: TuiDispatchEvent<THandler>) => void;
  onFocusChange?: (event: TuiFocusChangeEvent) => void;
}

export interface MountedStatefulTuiApp<
  TState,
  TAction,
  THandler extends () => void = () => void,
> {
  update(
    options?: Partial<
      Omit<
        RenderStatefulTuiAppOptions<TState, TAction, THandler>,
        "app" | "mapAction"
      >
    >,
  ): void;
  render(): FrameBuffer;
  rerender(): FrameBuffer;
  unmount(): void;
  isRunning(): boolean;
  getApp(): StatefulApp<TState, TAction, TuiAppViewState>;
  getHost(): MountedTerminalTuiHost<THandler>;
}

export interface RenderStaticStatefulTuiAppOptions<
  TState,
  TAction,
  THandler extends () => void = () => void,
> extends Omit<
  TuiRuntimeOptions<THandler>,
  "resolveAction" | "onDispatch" | "onFocusChange"
> {
  app: StatefulApp<TState, TAction, TuiAppViewState>;
  mapAction?: (token: BindingToken) => TAction | undefined;
}

export interface MountedStaticStatefulTuiApp<
  TState,
  TAction,
  THandler extends () => void = () => void,
> {
  update(
    options?: Partial<
      Omit<
        RenderStaticStatefulTuiAppOptions<TState, TAction, THandler>,
        "app" | "mapAction"
      >
    >,
  ): void;
  render(): FrameBuffer;
  rerender(): FrameBuffer;
  unmount(): void;
  getApp(): StatefulApp<TState, TAction, TuiAppViewState>;
  getRuntime(): MountedTuiRoot<THandler>;
}

export function renderTui(
  node: ReactNode,
  options?: TerminalTuiHostOptions,
): MountedRenderedTuiApp;
export function renderTui<THandler>(
  node: ReactNode,
  options?: TerminalTuiHostOptions<THandler>,
): MountedRenderedTuiApp<THandler>;
export function renderTui<THandler>(
  node: ReactNode,
  options: TerminalTuiHostOptions<THandler> = {},
): MountedRenderedTuiApp<THandler> {
  const reconciler = createReconciler();
  const root = reconciler.createRoot();
  let currentNode = node;

  root.render(currentNode);
  const host = mountTerminalTuiHost<THandler>(
    requireRenderedRoot(root, "TUI"),
    options,
  );
  host.start();

  return {
    update(nextNode, nextOptions) {
      if (nextNode !== undefined) {
        currentNode = nextNode;
        root.render(currentNode);
      }

      host.update(requireRenderedRoot(root, "TUI"), nextOptions);
    },
    render() {
      return host.render();
    },
    rerender() {
      return host.rerender();
    },
    unmount() {
      host.stop();
      root.unmount();
    },
    isRunning() {
      return host.isRunning();
    },
    getMountedNode() {
      return root.getMountedNode();
    },
    getHost() {
      return host;
    },
  };
}

export function renderStatefulTuiApp<TState, TAction>(
  options: RenderStatefulTuiAppOptions<TState, TAction>,
): MountedStatefulTuiApp<TState, TAction>;
export function renderStatefulTuiApp<
  TState,
  TAction,
  THandler extends () => void,
>(
  options: RenderStatefulTuiAppOptions<TState, TAction, THandler>,
): MountedStatefulTuiApp<TState, TAction, THandler>;
export function renderStatefulTuiApp<
  TState,
  TAction,
  THandler extends () => void,
>(
  options: RenderStatefulTuiAppOptions<TState, TAction, THandler>,
): MountedStatefulTuiApp<TState, TAction, THandler> {
  let currentOptions = { ...options };
  const host = mountTerminalTuiHost<THandler>(
    requireAppRoot(options.app, "TUI"),
    {
      ...options,
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
    },
  );
  host.start();

  const unsubscribe = options.app.subscribe((nextRoot) => {
    if (nextRoot === null) {
      return;
    }

    host.update(nextRoot, currentOptions);
  });

  return {
    update(nextOptions) {
      currentOptions = {
        ...currentOptions,
        ...nextOptions,
      };
      host.update(undefined, currentOptions);
    },
    render() {
      return host.render();
    },
    rerender() {
      return host.rerender();
    },
    unmount() {
      unsubscribe();
      host.stop();
      options.app.unmount();
    },
    isRunning() {
      return host.isRunning();
    },
    getApp() {
      return options.app;
    },
    getHost() {
      return host;
    },
  };

  function syncFocusedNodeLabel(nextLabel: string): void {
    options.app.updateViewState((current) => {
      return current.focusedNodeLabel === nextLabel
        ? current
        : {
            ...current,
            focusedNodeLabel: nextLabel,
          };
    });
  }

  function readFocusedNodeLabel(): string {
    const nodeId = host.getRuntime().getFocusedNodeId() ?? null;
    return nodeId === null ? "none" : `node ${String(nodeId)}`;
  }
}

export function renderStaticStatefulTuiApp<TState, TAction>(
  options: RenderStaticStatefulTuiAppOptions<TState, TAction>,
): MountedStaticStatefulTuiApp<TState, TAction>;
export function renderStaticStatefulTuiApp<
  TState,
  TAction,
  THandler extends () => void,
>(
  options: RenderStaticStatefulTuiAppOptions<TState, TAction, THandler>,
): MountedStaticStatefulTuiApp<TState, TAction, THandler>;
export function renderStaticStatefulTuiApp<
  TState,
  TAction,
  THandler extends () => void,
>(
  options: RenderStaticStatefulTuiAppOptions<TState, TAction, THandler>,
): MountedStaticStatefulTuiApp<TState, TAction, THandler> {
  let currentOptions = { ...options };
  const runtime = mountTuiRoot<THandler>(
    requireAppRoot(options.app, "static TUI"),
    {
      ...options,
      resolveAction(token) {
        const action = currentOptions.mapAction?.(token);
        return action === undefined
          ? undefined
          : (options.app.createActionHandler(action) as THandler);
      },
    },
  );

  const unsubscribe = options.app.subscribe((nextRoot) => {
    if (nextRoot === null) {
      return;
    }

    runtime.update(nextRoot, currentOptions);
  });

  return {
    update(nextOptions) {
      currentOptions = {
        ...currentOptions,
        ...nextOptions,
      };
      runtime.update(undefined, currentOptions);
    },
    render() {
      return runtime.render();
    },
    rerender() {
      return runtime.rerender();
    },
    unmount() {
      unsubscribe();
      options.app.unmount();
    },
    getApp() {
      return options.app;
    },
    getRuntime() {
      return runtime;
    },
  };
}

function requireRenderedRoot(root: FauxRoot, target: string): UINode {
  const mountedNode = root.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected a single mounted ${target} root node.`);
  }

  return mountedNode;
}

function requireAppRoot<TState, TAction>(
  app: StatefulApp<TState, TAction, TuiAppViewState>,
  target: string,
): UINode {
  const mountedNode = app.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected the ${target} app root node to be mounted.`);
  }

  return mountedNode;
}
