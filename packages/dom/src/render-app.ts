import type { ReactNode } from "react";

import type { UINode } from "@faux-ui/core";
import { createReconciler, type FauxRoot } from "@faux-ui/reconciler";

import {
  mountDomRoot,
  type DomMountOptions,
  type MountedDomRoot,
} from "./runtime.js";

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

function requireRenderedRoot(root: FauxRoot, target: string): UINode {
  const mountedNode = root.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected a single mounted ${target} root node.`);
  }

  return mountedNode;
}
