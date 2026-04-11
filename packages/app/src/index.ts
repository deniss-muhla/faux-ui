import type { ReactNode } from "react";

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
  const requestedRenderer = (options as { renderer?: unknown } | undefined)
    ?.renderer;

  if (
    requestedRenderer !== undefined &&
    typeof requestedRenderer === "object"
  ) {
    const injected = options as unknown as InjectedRendererOptions<
      RendererDefinition<any, any, any>
    >;
    return injected.renderer.render(
      node,
      injected.rendererOptions,
    ) as MountedRenderedApp<THandler>;
  }

  const { renderer, ...rendererOptions } = options ?? {};

  const selected = selectRenderer(builtInRenderers, renderer);

  if (selected.name === domRenderer.name) {
    return renderBrowser(node, rendererOptions as DomAppOptions<THandler>);
  }

  return renderTerminal(
    node,
    rendererOptions as TerminalTuiHostOptions<THandler>,
  );
}

export function renderWithRenderer<
  TRenderer extends RendererDefinition<any, any, any>,
>(
  node: ReactNode,
  options: InjectedRendererOptions<TRenderer>,
): RendererMountedOf<TRenderer> {
  return options.renderer.render(node, options.rendererOptions);
}

export { View, Text, VIEW_TYPE, TEXT_TYPE } from "@faux-ui/reconciler";
export type { ViewProps, TextProps } from "@faux-ui/reconciler";
