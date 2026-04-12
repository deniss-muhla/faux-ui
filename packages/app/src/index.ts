import { createElement, type ReactNode } from "react";
import type { ScrollOffset } from "@faux-ui/core";

import {
  selectRenderer,
  type RendererDefinition,
  type RendererMountedOf,
  type RendererOptionsOf,
} from "@faux-ui/renderer";
import {
  domRenderer,
  render as renderBrowser,
  type DomAppOptions,
  type MountedRenderedDomApp,
} from "@faux-ui/render-dom";
import {
  render as renderTerminal,
  tuiRenderer,
  type MountedRenderedTuiApp,
  type TerminalTuiHostOptions,
} from "@faux-ui/render-tui";
import {
  UiRuntimeProvider,
  createUiRuntimeBridge,
  type UiRuntimeAdapter,
  type UiRuntimeBridge,
} from "@faux-ui/ui";

export type RenderOptions<THandler = unknown> = DomAppOptions<THandler> &
  TerminalTuiHostOptions<THandler>;

export type MountedRenderedApp<THandler = unknown> =
  | MountedRenderedDomApp<THandler>
  | MountedRenderedTuiApp<THandler>;

const builtInRenderers = [domRenderer, tuiRenderer] as const;

export type BuiltInRendererName = (typeof builtInRenderers)[number]["name"];

export type BuiltInRenderOptions<THandler = unknown> = DomAppOptions<THandler> &
  TerminalTuiHostOptions<THandler> & {
    renderer?: BuiltInRendererName;
  };

export interface InjectedRendererOptions<
  TRenderer extends RendererDefinition<any, any, any>,
> {
  renderer: TRenderer;
  rendererOptions?: RendererOptionsOf<TRenderer>;
}

export function render<THandler = unknown>(
  node: ReactNode,
  options?: BuiltInRenderOptions<THandler>,
): MountedRenderedApp<THandler>;
export function render<TRenderer extends RendererDefinition<any, any, any>>(
  node: ReactNode,
  options: InjectedRendererOptions<TRenderer>,
): RendererMountedOf<TRenderer>;
export function render(
  node: ReactNode,
  options?:
    | BuiltInRenderOptions
    | InjectedRendererOptions<RendererDefinition<any, any, any>>,
): MountedRenderedApp | RendererMountedOf<RendererDefinition<any, any, any>> {
  const bridge = createUiRuntimeBridge();
  const wrappedNode = wrapWithUiRuntimeProvider(node, bridge);

  if (isInjectedRendererOptions(options)) {
    return renderInjectedRenderer(wrappedNode, bridge, options);
  }

  const { renderer, ...rendererOptions } = options ?? {};
  const selected = selectRenderer(builtInRenderers, renderer);

  if (selected.name === domRenderer.name) {
    const domOptions = rendererOptions as DomAppOptions;
    const mounted = renderBrowser(wrappedNode, {
      ...domOptions,
      onStateChange: composeStateChangeHandler(domOptions.onStateChange, bridge),
    });
    bridge.attach(createRuntimeAdapter(mounted));
    bridge.notify();
    return mounted;
  }

  const tuiOptions = rendererOptions as TerminalTuiHostOptions;
  const mounted = renderTerminal(wrappedNode, {
    ...tuiOptions,
    onStateChange: composeStateChangeHandler(tuiOptions.onStateChange, bridge),
  });
  bridge.attach(createRuntimeAdapter(mounted));
  bridge.notify();
  return mounted;
}

export function renderWithRenderer<
  TRenderer extends RendererDefinition<any, any, any>,
>(
  node: ReactNode,
  options: InjectedRendererOptions<TRenderer>,
): RendererMountedOf<TRenderer> {
  const bridge = createUiRuntimeBridge();
  return renderInjectedRenderer(
    wrapWithUiRuntimeProvider(node, bridge),
    bridge,
    options,
  );
}

function renderInjectedRenderer<
  TRenderer extends RendererDefinition<any, any, any>,
>(
  wrappedNode: ReactNode,
  bridge: UiRuntimeBridge,
  options: InjectedRendererOptions<TRenderer>,
): RendererMountedOf<TRenderer> {
  if (options.renderer.name === domRenderer.name) {
    const domOptions = (options.rendererOptions ?? {}) as DomAppOptions;
    const mounted = renderBrowser(wrappedNode, {
      ...domOptions,
      onStateChange: composeStateChangeHandler(domOptions.onStateChange, bridge),
    });
    bridge.attach(createRuntimeAdapter(mounted));
    bridge.notify();
    return mounted as RendererMountedOf<TRenderer>;
  }

  if (options.renderer.name === tuiRenderer.name) {
    const tuiOptions = (options.rendererOptions ?? {}) as TerminalTuiHostOptions;
    const mounted = renderTerminal(wrappedNode, {
      ...tuiOptions,
      onStateChange: composeStateChangeHandler(tuiOptions.onStateChange, bridge),
    });
    bridge.attach(createRuntimeAdapter(mounted));
    bridge.notify();
    return mounted as RendererMountedOf<TRenderer>;
  }

  return options.renderer.render(wrappedNode, options.rendererOptions);
}

function createRuntimeAdapter<THandler>(
  mounted: MountedRenderedApp<THandler>,
): UiRuntimeAdapter {
  if ("getRuntime" in mounted) {
    const runtime = mounted.getRuntime();
    return {
      getMountedNode() {
        return mounted.getMountedNode();
      },
      getScrollOffset(nodeId: number) {
        return runtime.getScrollOffset(nodeId);
      },
      setScrollOffset(nodeId: number, offset: ScrollOffset) {
        runtime.setScrollOffset(nodeId, offset);
      },
    };
  }

  const runtime = mounted.getHost().getRuntime();
  return {
    getMountedNode() {
      return mounted.getMountedNode();
    },
    getScrollOffset(nodeId: number) {
      return runtime.getScrollOffset(nodeId);
    },
    setScrollOffset(nodeId: number, offset: ScrollOffset) {
      runtime.setScrollOffset(nodeId, offset);
    },
  };
}

function isInjectedRendererOptions(
  options:
    | BuiltInRenderOptions
    | InjectedRendererOptions<RendererDefinition<any, any, any>>
    | undefined,
): options is InjectedRendererOptions<RendererDefinition<any, any, any>> {
  return (
    options !== undefined &&
    typeof options.renderer === "object" &&
    options.renderer !== null
  );
}

function wrapWithUiRuntimeProvider(
  node: ReactNode,
  bridge: UiRuntimeBridge,
): ReactNode {
  return createElement(UiRuntimeProvider, { bridge }, node);
}

function composeStateChangeHandler(
  onStateChange: (() => void) | undefined,
  bridge: UiRuntimeBridge,
): () => void {
  return () => {
    bridge.notify();
    onStateChange?.();
  };
}

export { View, Text, VIEW_TYPE, TEXT_TYPE } from "@faux-ui/reconciler";
export type { ViewProps, TextProps } from "@faux-ui/reconciler";
