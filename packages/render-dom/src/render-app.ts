import type { ReactNode } from "react";

import {
  defaultSemanticColors,
  type BoundedConstraints,
  type UINode,
} from "@faux-ui/core";
import {
  mountRendererApp,
  type RendererDefinition,
  type RendererThemeValues,
} from "@faux-ui/renderer";

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

interface DomRendererHandle<THandler = unknown> {
  runtime: MountedDomRoot<THandler>;
  cleanupResize(): void;
}

export const domRenderer: RendererDefinition<
  DomAppOptions,
  MountedRenderedDomApp,
  DomElementLike
> = {
  name: "dom",
  detect: isDomEnvironment,
  render(node, options) {
    return render(node, options);
  },
  applyTheme(target, theme) {
    applyThemeValues(target, theme);
  },
};

export function render<THandler = unknown>(
  node: ReactNode,
  options?: DomAppOptions<THandler>,
): MountedRenderedDomApp<THandler> {
  const resolved = options ?? {};
  const mounted = mountRendererApp<
    DomAppOptions<THandler>,
    Partial<Omit<DomMountOptions<THandler>, "container">>,
    DomRendererHandle<THandler>,
    void
  >(node, resolved, {
    targetName: "DOM",
    mount(root, initialOptions) {
      const container = initialOptions.container ?? resolveDomDocument().body;
      applyThemeValues(container, defaultSemanticColors);

      let constraints =
        initialOptions.constraints ?? measureCellConstraints(container);
      const runtime = mountDomRoot<THandler>(root, {
        ...stripDomAppOptions(initialOptions),
        container,
        constraints,
      });

      const cleanupResize =
        initialOptions.constraints === undefined
          ? observeResize(container, () => {
              constraints = measureCellConstraints(container);
              runtime.update(root, { constraints });
              initialOptions.onStateChange?.();
            })
          : () => {};

      return {
        runtime,
        cleanupResize,
      };
    },
    update(handle, root, nextOptions) {
      handle.runtime.update(root, nextOptions);
    },
    rerender(handle) {
      handle.runtime.rerender();
    },
    unmount(handle) {
      handle.cleanupResize();
      handle.runtime.unmount();
    },
  });

  return {
    ...mounted,
    getRuntime() {
      return mounted.getImplementationHandle().runtime;
    },
  };
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

function isDomEnvironment(): boolean {
  return typeof globalThis === "object" && "document" in globalThis;
}

function applyThemeValues(
  container: DomElementLike,
  theme: RendererThemeValues,
): void {
  for (const [token, value] of Object.entries(theme)) {
    if (value === undefined) {
      continue;
    }

    container.style.setProperty(`--faux-ui-color-${token}`, value);
  }
}

function stripDomAppOptions<THandler>(
  options: DomAppOptions<THandler>,
): Omit<DomMountOptions<THandler>, "container" | "constraints"> {
  const { container: _container, constraints: _constraints, ...rest } = options;
  return rest;
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
