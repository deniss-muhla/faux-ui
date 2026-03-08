import process from "node:process";

import React from "react";

import {
  renderStatefulTuiApp,
  renderStaticStatefulTuiApp,
} from "@faux-ui/tui";
import { createStatefulApp } from "@faux-ui/reconciler";

import { ExampleApp, createInitialState, reduceExampleAction, type ActionToken } from "./example-app.js";

const app = createStatefulApp({
  initialState: createInitialState(),
  initialViewState: { focusedNodeLabel: "none" },
  reduce: reduceExampleAction,
  render({ state, viewState }) {
    return (
      <ExampleApp
        state={state}
        target="tui"
        focusedNodeLabel={viewState.focusedNodeLabel}
      />
    );
  },
});

const options = parseArgs(process.argv.slice(2));

if (options.static) {
  const runtime = renderStaticStatefulTuiApp({
    app,
    constraints: {
      maxWidth: options.width,
      maxHeight: options.height,
    },
    mapAction(token) {
      return typeof token === "string" ? (token as ActionToken) : undefined;
    },
  });
  process.stdout.write(`${runtime.render().toString()}\n`);
  process.exit(0);
}

renderStatefulTuiApp({
  app,
  mapAction(token) {
    return typeof token === "string" ? (token as ActionToken) : undefined;
  },
});

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
