import type { ReactNode } from "react";

import type { UINode } from "@faux-ui/core";
import { createReconciler, type FauxRoot } from "@faux-ui/reconciler";

import type { FrameBuffer } from "./frame-buffer.js";
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

function requireRenderedRoot(root: FauxRoot, target: string): UINode {
  const mountedNode = root.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected a single mounted ${target} root node.`);
  }

  return mountedNode;
}
