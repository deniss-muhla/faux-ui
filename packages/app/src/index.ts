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
): MountedRenderedApp<THandler> {
  const bridge = createUiRuntimeBridge();
  const wrappedNode = createElement(UiRuntimeProvider, { bridge }, node);
  const requestedRenderer = (options as { renderer?: unknown } | undefined)
    ?.renderer;

  if (
    requestedRenderer !== undefined &&
    typeof requestedRenderer === "object"
  ) {
    const injected = options as unknown as InjectedRendererOptions<
      RendererDefinition<any, any, any>
    >;
    if (injected.renderer.name === domRenderer.name) {
      const mounted = renderBrowser(wrappedNode, {
        ...(injected.rendererOptions as DomAppOptions<THandler>),
        onStateChange: () => bridge.notify(),
      });
      bridge.attach(createRuntimeAdapter(mounted));
      bridge.notify();
      return mounted;
    }

    if (injected.renderer.name === tuiRenderer.name) {
      const mounted = renderTerminal(wrappedNode, {
        ...(injected.rendererOptions as TerminalTuiHostOptions<THandler>),
        onStateChange: () => bridge.notify(),
      });
      bridge.attach(createRuntimeAdapter(mounted));
      bridge.notify();
      return mounted;
    }

    return injected.renderer.render(
      wrappedNode,
      injected.rendererOptions,
    ) as MountedRenderedApp<THandler>;
  }

  const { renderer, ...rendererOptions } = options ?? {};

  const selected = selectRenderer(builtInRenderers, renderer);

  if (selected.name === domRenderer.name) {
    const mounted = renderBrowser(wrappedNode, {
      ...(rendererOptions as DomAppOptions<THandler>),
      onStateChange: () => bridge.notify(),
    });
    bridge.attach(createRuntimeAdapter(mounted));
    bridge.notify();
    return mounted;
  }

  const mounted = renderTerminal(wrappedNode, {
    ...(rendererOptions as TerminalTuiHostOptions<THandler>),
    onStateChange: () => bridge.notify(),
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
  return options.renderer.render(node, options.rendererOptions);
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

export { View, Text, VIEW_TYPE, TEXT_TYPE } from "@faux-ui/reconciler";
export type { ViewProps, TextProps } from "@faux-ui/reconciler";
