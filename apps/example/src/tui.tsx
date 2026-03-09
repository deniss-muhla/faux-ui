import process from "node:process";

import React from "react";

import {
  renderToFrameBuffer,
  renderTui,
} from "@faux-ui/tui";
import { createReconciler } from "@faux-ui/reconciler";

import {
  ExampleApp,
  createInitialState,
  reduceExampleAction,
  type ExampleAction,
} from "./example-app.js";

let state = createInitialState();
let focusedNodeLabel = "none";
let mounted: ReturnType<typeof renderTui> | null = null;

const options = parseArgs(process.argv.slice(2));

if (options.static) {
  const reconciler = createReconciler();
  const root = reconciler.createRoot();
  root.render(renderView());
  const mountedNode = root.getMountedNode();
  if (mountedNode === null) {
    throw new Error("Expected a mounted TUI example root node.");
  }

  process.stdout.write(
    `${renderToFrameBuffer(mountedNode, {
      constraints: {
        maxWidth: options.width,
        maxHeight: options.height,
      },
    }).toString()}\n`,
  );
  root.unmount();
  process.exit(0);
}

mounted = renderTui(renderView(), {
  onFocusChange(event) {
    focusedNodeLabel =
      event.nodeId === null ? "none" : `node ${String(event.nodeId)}`;
    rerender();
  },
});

function renderView(): React.ReactNode {
  return (
    <ExampleApp
      state={state}
      target="tui"
      focusedNodeLabel={focusedNodeLabel}
      onAction={handleAction}
    />
  );
}

function handleAction(action: ExampleAction): void {
  const nextState = reduceExampleAction(state, action);
  if (Object.is(nextState, state)) {
    return;
  }

  state = nextState;
  rerender();
}

function rerender(): void {
  mounted?.update(renderView());
}

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
