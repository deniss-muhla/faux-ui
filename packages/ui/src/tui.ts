import {
  env as processEnv,
  stdin as processStdin,
  stdout as processStdout,
} from "node:process";
import type { ReactNode } from "react";

import { sceneToAnsi } from "./internal/ansi.js";
import { SemanticMount } from "./internal/mount.js";
import type { Palette, Size } from "./internal/model.js";
import { mergePalette } from "./internal/palette.js";
import type { CellScene } from "./internal/scene.js";
import {
  consumeTerminalInput,
  type TerminalControl,
} from "./internal/tui-input.js";

const ENTER_ALTERNATE_SCREEN = "\u001b[?1049h";
const LEAVE_ALTERNATE_SCREEN = "\u001b[?1049l";
const HIDE_CURSOR = "\u001b[?25l";
const SHOW_CURSOR = "\u001b[?25h";
const DISABLE_AUTOWRAP = "\u001b[?7l";
const ENABLE_AUTOWRAP = "\u001b[?7h";
const ENABLE_MOUSE = "\u001b[?1000h\u001b[?1002h\u001b[?1006h";
const DISABLE_MOUSE = "\u001b[?1000l\u001b[?1002l\u001b[?1006l";
const CLEAR_SCREEN = "\u001b[2J\u001b[H";

export interface TerminalInput {
  readonly isTTY?: boolean;
  setRawMode?(enabled: boolean): void;
  resume?(): void;
  pause?(): void;
  on(event: "data", listener: (chunk: Uint8Array | string) => void): unknown;
  off?(event: "data", listener: (chunk: Uint8Array | string) => void): unknown;
  removeListener?(
    event: "data",
    listener: (chunk: Uint8Array | string) => void,
  ): unknown;
}

export interface TerminalOutput {
  readonly isTTY?: boolean;
  readonly columns?: number;
  readonly rows?: number;
  write(chunk: string): unknown;
  on?(event: "resize", listener: () => void): unknown;
  off?(event: "resize", listener: () => void): unknown;
  removeListener?(event: "resize", listener: () => void): unknown;
}

export interface TuiRenderOptions {
  readonly input?: TerminalInput;
  readonly output?: TerminalOutput;
  readonly width?: number;
  readonly height?: number;
  readonly alternateScreen?: boolean;
  readonly mouse?: boolean;
  readonly exitOnCtrlC?: boolean;
  readonly palette?: Partial<Palette>;
}

export interface TuiRenderHandle {
  rerender(node: ReactNode): void;
  setSize(size: Size): void;
  getSize(): Size;
  getScene(): CellScene;
  start(): void;
  stop(): void;
  isRunning(): boolean;
  unmount(): void;
}

export function render(
  node: ReactNode,
  options: TuiRenderOptions = {},
): TuiRenderHandle {
  if ((options.width === undefined) !== (options.height === undefined)) {
    throw new Error("TUI width and height must be provided together.");
  }

  const input = options.input ?? (processStdin as TerminalInput);
  const output = options.output ?? (processStdout as TerminalOutput);
  const explicitSize = options.width !== undefined;
  const alternateScreen = options.alternateScreen ?? output.isTTY !== false;
  const mouse = options.mouse ?? supportsMouse(output);
  const mount = new SemanticMount({
    size: resolveTerminalSize(options, output),
    onFrame: (frame) => {
      if (!running) return;
      const palette = mergePalette({ ...frame.palette, ...options.palette });
      writeFrame(output, frame.scene, palette);
    },
  });
  const decoder = new TextDecoder();
  let pendingInput = "";
  let running = false;
  let unmounted = false;

  const handleData = (chunk: Uint8Array | string): void => {
    pendingInput +=
      typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    const parsed = consumeTerminalInput(pendingInput);
    pendingInput = parsed.rest;
    try {
      for (const control of parsed.controls) {
        applyControl(control);
        if (unmounted) break;
      }
    } catch (error) {
      handle.unmount();
      throw error;
    }
  };
  const handleResize = (): void => {
    if (!explicitSize) mount.setSize(resolveTerminalSize(options, output));
  };

  const handle: TuiRenderHandle = {
    rerender(next): void {
      assertMounted();
      mount.rerender(next);
    },
    setSize(size): void {
      assertMounted();
      mount.setSize(size);
    },
    getSize(): Size {
      return mount.size();
    },
    getScene(): CellScene {
      return mount.frame().scene;
    },
    start(): void {
      assertMounted();
      if (running) return;
      running = true;
      input.setRawMode?.(true);
      input.resume?.();
      input.on("data", handleData);
      output.on?.("resize", handleResize);
      if (alternateScreen) output.write(ENTER_ALTERNATE_SCREEN);
      output.write(HIDE_CURSOR);
      output.write(DISABLE_AUTOWRAP);
      if (mouse) output.write(ENABLE_MOUSE);
      const frame = mount.frame();
      const palette = mergePalette({ ...frame.palette, ...options.palette });
      writeFrame(output, frame.scene, palette);
    },
    stop(): void {
      if (!running) return;
      running = false;
      unlisten(input, "data", handleData);
      unlisten(output, "resize", handleResize);
      input.setRawMode?.(false);
      input.pause?.();
      if (mouse) output.write(DISABLE_MOUSE);
      output.write(ENABLE_AUTOWRAP);
      output.write(SHOW_CURSOR);
      if (alternateScreen) output.write(LEAVE_ALTERNATE_SCREEN);
    },
    isRunning(): boolean {
      return running;
    },
    unmount(): void {
      if (unmounted) return;
      handle.stop();
      unmounted = true;
      mount.unmount();
    },
  };

  function applyControl(control: TerminalControl): void {
    if (control.type === "quit") {
      if (options.exitOnCtrlC !== false) handle.unmount();
      else mount.keyDown({ key: "c", ctrl: true });
      return;
    }
    if (control.type === "keyDown") {
      mount.keyDown(control.input);
      return;
    }
    if (control.type === "pointerDown") {
      mount.pointerDown(control.input);
      return;
    }
    if (control.type === "pointerMove") {
      mount.pointerMove(control.input);
      return;
    }
    if (control.type === "pointerUp") {
      mount.pointerUp(control.input);
      return;
    }
    mount.scroll(control.input);
  }

  function assertMounted(): void {
    if (unmounted) throw new Error("This faux-ui TUI has been unmounted.");
  }

  try {
    mount.render(node);
    handle.start();
  } catch (error) {
    handle.stop();
    mount.unmount();
    unmounted = true;
    throw error;
  }

  return handle;
}

function writeFrame(
  output: TerminalOutput,
  scene: CellScene,
  palette: Palette,
): void {
  output.write(`${CLEAR_SCREEN}${sceneToAnsi(scene, palette)}`);
}

function resolveTerminalSize(
  options: Pick<TuiRenderOptions, "width" | "height">,
  output: Pick<TerminalOutput, "columns" | "rows">,
): Size {
  return {
    width:
      options.width ?? normalizeTerminalDimension(output.columns, 80),
    height:
      options.height ?? normalizeTerminalDimension(output.rows, 24),
  };
}

function normalizeTerminalDimension(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function supportsMouse(output: TerminalOutput): boolean {
  const term = processEnv.TERM?.toLowerCase();
  return output.isTTY === true && term !== undefined && term !== "dumb";
}

function unlisten<
  TTarget,
  TEvent extends "data" | "resize",
  TListener extends (...args: never[]) => void,
>(
  target: TTarget & {
    off?(event: TEvent, listener: TListener): unknown;
    removeListener?(event: TEvent, listener: TListener): unknown;
  },
  event: TEvent,
  listener: TListener,
): void {
  if (target.off !== undefined) target.off(event, listener);
  else target.removeListener?.(event, listener);
}
