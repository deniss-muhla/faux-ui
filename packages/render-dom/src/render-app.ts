import type { ReactNode } from "react";

import {
  defaultSemanticColors,
  type BoundedConstraints,
  type UINode,
} from "@faux-ui/core";
import { createReconciler, type FauxRoot } from "@faux-ui/reconciler";

import {
  mountDomRoot,
  type DomDocumentLike,
  type DomElementLike,
  type DomMountOptions,
  type MountedDomRoot,
} from "./runtime.js";

export type DomAppOptions<THandler = unknown> = Partial<
  Omit<DomMountOptions<THandler>, "container" | "constraints">
> & {
  container?: DomElementLike;
  constraints?: BoundedConstraints;
};

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

export function render<THandler = unknown>(
  node: ReactNode,
  options?: DomAppOptions<THandler>,
): MountedRenderedDomApp<THandler> {
  const resolved = options ?? {};
  const container = resolved.container ?? resolveDomDocument().body;
  applyDefaultTheme(container);

  let constraints = resolved.constraints ?? measureCellConstraints(container);
  let resizeCleanup: (() => void) | null = null;

  const reconciler = createReconciler();
  let runtimeRef: MountedDomRoot<THandler> | null = null;
  const root = reconciler.createRoot({
    onCommit() {
      if (runtimeRef !== null && root.getMountedNode() !== null) {
        runtimeRef.update(root.getMountedNode()!);
      }
    },
  });

  root.render(node);
  const runtime = mountDomRoot<THandler>(
    requireRenderedRoot(root, "DOM"),
    buildMountOptions(),
  );
  runtimeRef = runtime;

  if (resolved.constraints === undefined) {
    resizeCleanup = observeResize(container, () => {
      constraints = measureCellConstraints(container);
      runtime.update(requireRenderedRoot(root, "DOM"), { constraints });
    });
  }

  return {
    update(nextNode, nextOptions) {
      if (nextNode !== undefined) {
        root.render(nextNode);
      }

      if (nextOptions !== undefined) {
        runtime.update(requireRenderedRoot(root, "DOM"), nextOptions);
      }
    },
    rerender() {
      runtime.rerender();
    },
    unmount() {
      resizeCleanup?.();
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

  function buildMountOptions(): DomMountOptions<THandler> {
    const { container: _c, constraints: _k, ...rest } = resolved;
    return {
      ...rest,
      container,
      constraints,
    };
  }
}

function requireRenderedRoot(root: FauxRoot, target: string): UINode {
  const mountedNode = root.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected a single mounted ${target} root node.`);
  }

  return mountedNode;
}

function resolveDomDocument(): DomDocumentLike & { body: DomElementLike } {
  const g = globalThis as Record<string, unknown>;
  const doc = g["document"] as
    | (DomDocumentLike & { body?: DomElementLike })
    | undefined;
  if (doc === undefined || doc.body === undefined) {
    throw new Error(
      "render() requires a browser environment or an explicit container.",
    );
  }

  return doc as DomDocumentLike & { body: DomElementLike };
}

function applyDefaultTheme(container: DomElementLike): void {
  for (const [token, value] of Object.entries(defaultSemanticColors)) {
    container.style.setProperty(`--faux-ui-color-${token}`, value);
  }
}

function measureCellConstraints(container: DomElementLike): BoundedConstraints {
  const rect = resolveMeasurementRect(container);
  const doc = container.ownerDocument ?? resolveDomDocument();
  const probe = doc.createElement("span");
  probe.style.setProperty("position", "absolute");
  probe.style.setProperty("visibility", "hidden");
  probe.style.setProperty("white-space", "pre");
  probe.style.setProperty("font-family", "inherit");
  probe.style.setProperty("line-height", "inherit");
  probe.textContent = "0";
  container.appendChild(probe);

  const probeRect = probe.getBoundingClientRect();
  const cellWidth = Math.max(1, probeRect.width);
  const cellHeight = Math.max(1, probeRect.height);
  // Remove probe by replacing children isn't safe; cast to call remove if available
  (probe as unknown as { remove?(): void }).remove?.();

  return {
    maxWidth: Math.max(1, Math.floor(rect.width / cellWidth)),
    maxHeight: Math.max(1, Math.floor(rect.height / cellHeight)),
  };
}

function resolveMeasurementRect(container: DomElementLike): {
  width: number;
  height: number;
} {
  const rect = container.getBoundingClientRect();
  const doc = resolveDomDocument();
  const g = globalThis as Record<string, unknown>;
  const innerWidth = g["innerWidth"];
  const innerHeight = g["innerHeight"];

  if (
    doc.body === container &&
    typeof innerWidth === "number" &&
    typeof innerHeight === "number"
  ) {
    return {
      width: Math.max(rect.width, innerWidth),
      height: Math.max(rect.height, innerHeight),
    };
  }

  return {
    width: rect.width,
    height: rect.height,
  };
}

interface ResizeObserverLike {
  observe(target: unknown): void;
  disconnect(): void;
}

function observeResize(
  container: DomElementLike,
  callback: () => void,
): () => void {
  const g = globalThis as Record<string, unknown>;
  const ObserverCtor = g["ResizeObserver"] as
    | (new (cb: () => void) => ResizeObserverLike)
    | undefined;

  if (ObserverCtor === undefined) {
    return () => {};
  }

  const observer = new ObserverCtor(() => {
    callback();
  });
  observer.observe(container);
  return () => observer.disconnect();
}
