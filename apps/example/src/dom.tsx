import React from "react";

import {
  createDomTextMeasurer,
  mountDomRoot,
  type DomDispatchEvent,
  type DomElementLike,
  type DomMountOptions,
  type MountedDomRoot,
} from "@faux-ui/dom";
import { createReconciler } from "@faux-ui/reconciler";
import { createTuiTextMeasurer } from "@faux-ui/tui";

import { ExampleApp, createInitialState, reduceExampleAction, type ActionToken, type AppState } from "./example-app.js";

import "./styles.css";

const sharedTextMeasurer = createTuiTextMeasurer();

const domTextMeasurer = createDomTextMeasurer({
  measureText(request) {
    return sharedTextMeasurer.measure(request);
  },
});

const host = requireElement<HTMLDivElement>("#surface");

const reconciler = createReconciler();
const fauxRoot = reconciler.createRoot();

let state: AppState = createInitialState();
let mounted: MountedDomRoot<() => void> | null = null;
let focusedNodeLabel = "none";
let focusRenderQueued = false;

applyTheme(host);
renderApp();
window.addEventListener("resize", () => {
  if (mounted !== null) {
    mounted.update(undefined, { constraints: readConstraints() });
  }
});

function renderApp(): void {
  fauxRoot.render(
    <ExampleApp
      state={state}
      target="dom"
      focusedNodeLabel={focusedNodeLabel}
    />,
  );
  const mountedNode = fauxRoot.getMountedNode();
  if (mountedNode === null) {
    throw new Error("Expected the DOM example root node to be mounted.");
  }

  if (mounted === null) {
    const mountOptions: DomMountOptions<() => void> = {
      container: host as unknown as DomElementLike,
      constraints: readConstraints(),
      measureText: domTextMeasurer.measure,
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
        syncFocusedNodeLabel(
          event.nodeId === null ? "none" : `node ${String(event.nodeId)}`,
        );
      },
    };

    mounted = mountDomRoot<() => void>(mountedNode, mountOptions);
    return;
  }

  mounted.update(mountedNode, { constraints: readConstraints() });
}

function executeDispatch(event: DomDispatchEvent<() => void>): void {
  for (const action of event.execution?.resolvedActions ?? []) {
    action.handler();
  }
}

function createActionHandler(token: ActionToken): () => void {
  return () => {
    state = reduceExampleAction(state, token);
    renderApp();
    syncFocusedNodeLabel(readFocusedNodeLabel());
  };
}

function syncFocusedNodeLabel(nextLabel: string): void {
  if (focusedNodeLabel === nextLabel) {
    return;
  }

  focusedNodeLabel = nextLabel;
  if (focusRenderQueued) {
    return;
  }

  focusRenderQueued = true;
  queueMicrotask(() => {
    focusRenderQueued = false;
    renderApp();
  });
}

function readFocusedNodeLabel(): string {
  const nodeId = mounted?.getFocusedNodeId() ?? null;
  return nodeId === null ? "none" : `node ${String(nodeId)}`;
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

function applyTheme(element: HTMLElement): void {
  element.style.setProperty("--faux-ui-color-fg", "#182026");
  element.style.setProperty("--faux-ui-color-muted", "#5d6b79");
  element.style.setProperty("--faux-ui-color-accent", "#114b5f");
  element.style.setProperty("--faux-ui-color-success", "#146c43");
  element.style.setProperty("--faux-ui-color-warning", "#9a5b13");
  element.style.setProperty("--faux-ui-color-danger", "#b42318");
  element.style.setProperty("--faux-ui-color-bg", "#fffaf1");
  element.style.setProperty("--faux-ui-color-bgAlt", "#ecdfc8");
  element.style.setProperty("--faux-ui-color-border", "#d9c8a9");
  element.style.setProperty("--faux-ui-color-focus", "#c8f0ff");
  element.style.setProperty("--faux-ui-color-selection", "#d8efe0");
  element.style.setProperty("--faux-ui-color-inverse", "#fffdf8");
}
