import type { ReactNode } from "react";

import {
  render as renderBrowser,
  type DomAppOptions,
  type MountedRenderedDomApp,
} from "@faux-ui/render-dom";
import {
  render as renderTerminal,
  type MountedRenderedTuiApp,
  type TerminalTuiHostOptions,
} from "@faux-ui/render-tui";

export type RenderOptions<THandler = unknown> = DomAppOptions<THandler> &
  TerminalTuiHostOptions<THandler>;

export type MountedRenderedApp<THandler = unknown> =
  | MountedRenderedDomApp<THandler>
  | MountedRenderedTuiApp<THandler>;

export function render<THandler = unknown>(
  node: ReactNode,
  options?: RenderOptions<THandler>,
): MountedRenderedApp<THandler> {
  return isBrowserEnvironment()
    ? renderBrowser(node, options)
    : renderTerminal(node, options);
}

export { View, Text, VIEW_TYPE, TEXT_TYPE } from "@faux-ui/reconciler";
export type { ViewProps, TextProps } from "@faux-ui/reconciler";

function isBrowserEnvironment(): boolean {
  return typeof globalThis === "object" && "document" in globalThis;
}
