import type { ReactNode } from "react";

import type { UINode } from "@faux-ui/core";
import { mountRendererApp, type RendererDefinition } from "@faux-ui/renderer";

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

export const tuiRenderer: RendererDefinition<
  TerminalTuiHostOptions,
  MountedRenderedTuiApp
> = {
  name: "tui",
  detect: isTuiEnvironment,
  render(node, options) {
    return render(node, options);
  },
};

export function render(
  node: ReactNode,
  options?: TerminalTuiHostOptions,
): MountedRenderedTuiApp;
export function render<THandler>(
  node: ReactNode,
  options?: TerminalTuiHostOptions<THandler>,
): MountedRenderedTuiApp<THandler>;
export function render<THandler>(
  node: ReactNode,
  options: TerminalTuiHostOptions<THandler> = {},
): MountedRenderedTuiApp<THandler> {
  const mounted = mountRendererApp<
    TerminalTuiHostOptions<THandler>,
    Partial<TerminalTuiHostOptions<THandler>>,
    MountedTerminalTuiHost<THandler>,
    FrameBuffer
  >(node, options, {
    targetName: "TUI",
    mount(root, initialOptions) {
      const host = mountTerminalTuiHost<THandler>(root, initialOptions);
      host.start();
      return host;
    },
    update(handle, root, nextOptions) {
      handle.update(root, nextOptions);
    },
    rerender(handle) {
      return handle.rerender();
    },
    unmount(handle) {
      handle.stop();
    },
    shouldUpdateOnCommit(handle) {
      return handle.isRunning();
    },
  });
  const host = mounted.getImplementationHandle();

  return {
    ...mounted,
    render() {
      return host.render();
    },
    isRunning() {
      return host.isRunning();
    },
    getHost() {
      return host;
    },
  };
}

function isTuiEnvironment(): boolean {
  return typeof globalThis !== "object" || !("document" in globalThis);
}
