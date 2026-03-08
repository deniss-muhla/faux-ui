import React from "react";

import {
  applyDomTheme,
  renderStatefulDomApp,
  type DomElementLike,
} from "@faux-ui/dom";
import { createStatefulApp } from "@faux-ui/reconciler";

import { ExampleApp, createInitialState, reduceExampleAction, type ActionToken } from "./example-app.js";

import "./styles.css";

const host = requireElement<HTMLDivElement>("#surface");

const app = createStatefulApp({
  initialState: createInitialState(),
  initialViewState: { focusedNodeLabel: "none" },
  reduce: reduceExampleAction,
  render({ state, viewState }) {
    return (
      <ExampleApp
        state={state}
        target="dom"
        focusedNodeLabel={viewState.focusedNodeLabel}
      />
    );
  },
});

applyDomTheme(host as unknown as DomElementLike, {
  fg: "#182026",
  muted: "#5d6b79",
  accent: "#114b5f",
  success: "#146c43",
  warning: "#9a5b13",
  danger: "#b42318",
  bg: "#fffaf1",
  bgAlt: "#ecdfc8",
  border: "#d9c8a9",
  focus: "#c8f0ff",
  selection: "#d8efe0",
  inverse: "#fffdf8",
});

renderStatefulDomApp({
  app,
  container: host as unknown as DomElementLike,
  readConstraints,
  autoResize: true,
  mapAction(token) {
    return typeof token === "string" ? (token as ActionToken) : undefined;
  },
});

function readConstraints(): { maxWidth: number; maxHeight: number } {
  return {
    maxWidth: Math.max(760, Math.floor(host.clientWidth - 36)),
    maxHeight: Math.max(520, Math.floor(host.clientHeight - 36)),
  };
}

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (element === null) {
    throw new Error(`Expected element ${selector} to exist.`);
  }

  return element;
}
