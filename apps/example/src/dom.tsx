import React from "react";

import {
  applyDomTheme,
  renderDom,
  type DomElementLike,
} from "@faux-ui/dom";

import {
  ExampleApp,
  createInitialState,
  reduceExampleAction,
  type ExampleAction,
} from "./example-app.js";

import "./styles.css";

const host = requireElement<HTMLDivElement>("#surface");
let state = createInitialState();
let focusedNodeLabel = "none";
let mounted: ReturnType<typeof renderDom> | null = null;

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

mounted = renderDom(renderView(), {
  container: host as unknown as DomElementLike,
  constraints: readConstraints(),
  onFocusChange(event) {
    focusedNodeLabel =
      event.nodeId === null ? "none" : `node ${String(event.nodeId)}`;
    rerender();
  },
});

window.addEventListener("resize", () => {
  rerender();
});

function renderView(): React.ReactNode {
  return (
    <ExampleApp
      state={state}
      target="dom"
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
  mounted?.update(renderView(), {
    constraints: readConstraints(),
  });
}

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
