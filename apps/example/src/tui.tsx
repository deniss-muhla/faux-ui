import process from "node:process";

import React from "react";

import {
  mountTerminalTuiHost,
  mountTuiRoot,
  type MountedTerminalTuiHost,
  type MountedTuiRoot,
  type TuiDispatchEvent,
} from "@faux-ui/tui";
import { createReconciler } from "@faux-ui/reconciler";

import { ExampleApp, createInitialState, reduceExampleAction, type ActionToken, type AppState } from "./example-app.js";

const reconciler = createReconciler();
const fauxRoot = reconciler.createRoot();

let state: AppState = createInitialState();
let terminalHost: MountedTerminalTuiHost<() => void> | null = null;
let staticRuntime: MountedTuiRoot<() => void> | null = null;
let focusedNodeLabel = "none";

const options = parseArgs(process.argv.slice(2));
renderTree();

if (options.static) {
  const mountedNode = requireMountedNode();
  const mountedRuntime = mountTuiRoot<() => void>(mountedNode, {
    constraints: {
      maxWidth: options.width,
      maxHeight: options.height,
    },
    resolveAction(token) {
      if (typeof token !== "string") {
        return undefined;
      }

      return createActionHandler(token as ActionToken);
    },
  });
  staticRuntime = mountedRuntime;
  process.stdout.write(`${mountedRuntime.render().toString()}\n`);
  process.exit(0);
}

const mountedNode = requireMountedNode();
const mountedHost = mountTerminalTuiHost<() => void>(mountedNode, {
  resolveAction(token) {
    if (typeof token !== "string") {
      return undefined;
    }

    return createActionHandler(token as ActionToken);
  },
  onDispatch(event) {
    executeDispatch(event);
  },
  onFocusChange(event) {
    focusedNodeLabel =
      event.nodeId === null ? "none" : `node ${String(event.nodeId)}`;
    renderTree();
  },
});
terminalHost = mountedHost;
mountedHost.start();

function parseArgs(args: string[]): {
  static: boolean;
  width: number;
  height: number;
} {
  let staticMode = false;
  let width = 84;
  let height = 30;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--static") {
      staticMode = true;
      continue;
    }

    if (arg === "--width") {
      width = parseInteger(args[index + 1], arg);
      index += 1;
      continue;
    }

    if (arg === "--height") {
      height = parseInteger(args[index + 1], arg);
      index += 1;
      continue;
    }
  }

  return {
    static: staticMode,
    width,
    height,
  };
}

function parseInteger(value: string | undefined, flag: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer after ${flag}.`);
  }

  return parsed;
}

function executeDispatch(event: TuiDispatchEvent<() => void>): void {
  for (const action of event.execution?.resolvedActions ?? []) {
    action.handler();
  }
}

function createActionHandler(token: ActionToken): () => void {
  return () => {
    state = reduceExampleAction(state, token);
    renderTree();
    focusedNodeLabel = readFocusedNodeLabel();
    renderTree();
  };
}

function renderTree(): void {
  fauxRoot.render(
    <ExampleApp
      state={state}
      target="tui"
      focusedNodeLabel={focusedNodeLabel}
    />,
  );
  const mountedNode = requireMountedNode();

  if (terminalHost !== null) {
    terminalHost.update(mountedNode);
  }

  if (staticRuntime !== null) {
    staticRuntime.update(mountedNode);
  }
}

function requireMountedNode() {
  const mountedNode = fauxRoot.getMountedNode();
  if (mountedNode === null) {
    throw new Error("Expected the TUI example root node to be mounted.");
  }

  return mountedNode;
}

function readFocusedNodeLabel(): string {
  const runtime = terminalHost?.getRuntime() ?? staticRuntime;
  const nodeId = runtime?.getFocusedNodeId() ?? null;
  return nodeId === null ? "none" : `node ${String(nodeId)}`;
}
