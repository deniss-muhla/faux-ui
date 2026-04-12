import type { SemanticColor, UINode } from "@faux-ui/core";
import { createReconciler, type FauxRoot } from "@faux-ui/reconciler";
import type { ReactNode } from "react";

export type RendererThemeValues = Partial<Record<SemanticColor, string>>;

export interface MountedRendererApp<
  TUpdateOptions = unknown,
  THandle = unknown,
  TRerender = unknown,
> {
  update(node?: ReactNode, options?: TUpdateOptions): void;
  rerender(): TRerender;
  unmount(): void;
  getMountedNode(): UINode | null;
  getImplementationHandle(): THandle;
}

export interface RendererDefinition<
  TOptions = unknown,
  TMounted = MountedRendererApp,
  TThemeTarget = unknown,
> {
  name: string;
  detect(): boolean;
  render(node: ReactNode, options?: TOptions): TMounted;
  applyTheme?: (target: TThemeTarget, theme: RendererThemeValues) => void;
}

export interface RendererAppAdapter<
  TInitialOptions,
  TUpdateOptions,
  THandle,
  TRerender,
> {
  targetName: string;
  mount(root: UINode, options: TInitialOptions): THandle;
  update(handle: THandle, root: UINode, options?: TUpdateOptions): void;
  rerender(handle: THandle): TRerender;
  unmount(handle: THandle): void;
  shouldUpdateOnCommit?(handle: THandle): boolean;
}

type AnyRenderer = RendererDefinition<any, any, any>;

export type RendererOptionsOf<TRenderer extends AnyRenderer> =
  TRenderer extends RendererDefinition<infer TOptions, any, any>
    ? TOptions
    : never;

export type RendererMountedOf<TRenderer extends AnyRenderer> =
  TRenderer extends RendererDefinition<any, infer TMounted, any>
    ? TMounted
    : never;

export type RendererNameOf<TRenderer extends AnyRenderer> = TRenderer["name"];

export function selectRenderer<TRenderer extends AnyRenderer>(
  renderers: readonly TRenderer[],
  requested?: TRenderer | RendererNameOf<TRenderer>,
): TRenderer {
  if (requested !== undefined && typeof requested === "object") {
    return requested;
  }

  if (typeof requested === "string") {
    const namedRenderer = renderers.find(
      (renderer) => renderer.name === requested,
    );
    if (namedRenderer !== undefined) {
      return namedRenderer;
    }

    throw new Error(`Unknown renderer: ${requested}`);
  }

  const detectedRenderer = renderers.find((renderer) => renderer.detect());
  if (detectedRenderer !== undefined) {
    return detectedRenderer;
  }

  throw new Error("No registered renderer reported a supported environment.");
}

export function mountRendererApp<
  TInitialOptions,
  TUpdateOptions,
  THandle,
  TRerender,
>(
  node: ReactNode,
  options: TInitialOptions,
  adapter: RendererAppAdapter<
    TInitialOptions,
    TUpdateOptions,
    THandle,
    TRerender
  >,
): MountedRendererApp<TUpdateOptions, THandle, TRerender> {
  let handle: THandle | null = null;

  const root = createReconciler().createRoot({
    onCommit() {
      if (handle === null || root.getMountedNode() === null) {
        return;
      }

      if (adapter.shouldUpdateOnCommit?.(handle) === false) {
        return;
      }

      adapter.update(handle, requireRenderedRoot(root, adapter.targetName));
    },
  });

  root.render(node);
  handle = adapter.mount(
    requireRenderedRoot(root, adapter.targetName),
    options,
  );

  return {
    update(nextNode, nextOptions) {
      if (nextNode !== undefined) {
        root.render(nextNode);
      }

      if (nextOptions !== undefined) {
        adapter.update(
          ensureHandle(handle, adapter.targetName),
          requireRenderedRoot(root, adapter.targetName),
          nextOptions,
        );
      }
    },
    rerender() {
      return adapter.rerender(ensureHandle(handle, adapter.targetName));
    },
    unmount() {
      adapter.unmount(ensureHandle(handle, adapter.targetName));
      root.unmount();
      handle = null;
    },
    getMountedNode() {
      return root.getMountedNode();
    },
    getImplementationHandle() {
      return ensureHandle(handle, adapter.targetName);
    },
  };
}

function requireRenderedRoot(root: FauxRoot, targetName: string): UINode {
  const mountedNode = root.getMountedNode();
  if (mountedNode === null) {
    throw new Error(`Expected a single mounted ${targetName} root node.`);
  }

  return mountedNode;
}

function ensureHandle<THandle>(
  handle: THandle | null,
  targetName: string,
): THandle {
  if (handle === null) {
    throw new Error(`${targetName} renderer is not mounted.`);
  }

  return handle;
}
