import process from "node:process";

import type { Constraints, ScrollOffset, UINode } from "@faux-ui/core";

import type { FrameBuffer } from "./frame-buffer.js";
import {
  mountTuiRoot,
  type MountedTuiRoot,
  type TuiRuntimeOptions,
} from "./runtime.js";

const ESC = "\u001b";
const ENTER_ALTERNATE_SCREEN = "\u001b[?1049h";
const LEAVE_ALTERNATE_SCREEN = "\u001b[?1049l";
const HIDE_CURSOR = "\u001b[?25l";
const SHOW_CURSOR = "\u001b[?25h";
const ENABLE_MOUSE = "\u001b[?1000h\u001b[?1002h\u001b[?1006h";
const DISABLE_MOUSE = "\u001b[?1000l\u001b[?1002l\u001b[?1006l";
const CLEAR_SCREEN = "\u001b[2J\u001b[H";

export interface TerminalInputStream {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => void;
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  off?(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  removeListener?(
    event: "data",
    listener: (chunk: Buffer | string) => void,
  ): unknown;
  resume?(): void;
  pause?(): void;
}

export interface TerminalOutputStream {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write(chunk: string): unknown;
  on(event: "resize", listener: () => void): unknown;
  off?(event: "resize", listener: () => void): unknown;
  removeListener?(event: "resize", listener: () => void): unknown;
}

export interface TerminalHostIO {
  stdin: TerminalInputStream;
  stdout: TerminalOutputStream;
}

export interface TerminalTuiHostConfig<THandler = unknown>
  extends Omit<TuiRuntimeOptions<THandler>, "constraints"> {
  constraints?: Constraints;
  exitOnCtrlC?: boolean;
  enableMouse?: boolean;
}

export interface TerminalTuiHostOptions<THandler = unknown>
  extends TerminalTuiHostConfig<THandler> {
  io?: Partial<TerminalHostIO>;
}

export type TerminalControl =
  | { type: "focusNext" }
  | { type: "focusPrevious" }
  | { type: "keyDown"; key: string }
  | { type: "pointerDown"; point: { x: number; y: number } }
  | { type: "pointerMove"; point: { x: number; y: number } }
  | { type: "pointerUp"; point: { x: number; y: number } }
  | { type: "quit" }
  | {
      type: "scroll";
      point: { x: number; y: number };
      delta: ScrollOffset;
    };

export interface TerminalInputParseResult {
  controls: TerminalControl[];
  rest: string;
}

export interface MountedTerminalTuiHost<THandler = unknown> {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  update(root?: UINode, options?: Partial<TerminalTuiHostConfig<THandler>>): void;
  render(): FrameBuffer;
  rerender(): FrameBuffer;
  getRuntime(): MountedTuiRoot<THandler>;
}

export function mountTerminalTuiHost(
  root: UINode,
  options?: TerminalTuiHostOptions,
): MountedTerminalTuiHost;
export function mountTerminalTuiHost<THandler>(
  root: UINode,
  options?: TerminalTuiHostOptions<THandler>,
): MountedTerminalTuiHost<THandler>;
export function mountTerminalTuiHost<THandler>(
  root: UINode,
  options: TerminalTuiHostOptions<THandler> = {},
): MountedTerminalTuiHost<THandler> {
  const io = resolveHostIO(options.io);
  let currentRoot = root;
  let currentOptions = cloneHostConfig(options);
  let running = false;
  let pendingInput = "";
  let lastPointerDown: { x: number; y: number } | null = null;

  const runtime = mountTuiRoot(
    currentRoot,
    buildRuntimeOptions(currentOptions, io.stdout),
  );

  const handleData = (chunk: Buffer | string) => {
    pendingInput += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const parsed = consumeTerminalInput(pendingInput);
    pendingInput = parsed.rest;

    let shouldRerender = false;
    for (const control of parsed.controls) {
      shouldRerender = applyControl(control) || shouldRerender;
    }

    if (shouldRerender) {
      rerenderInternal();
    }
  };

  const handleResize = () => {
    runtime.update(undefined, buildRuntimeOptions(currentOptions, io.stdout));
    rerenderInternal();
  };

  return {
    start() {
      if (running) {
        return;
      }

      running = true;
      io.stdin.setRawMode?.(true);
      io.stdin.resume?.();
      listen(io.stdin, "data", handleData);
      listen(io.stdout, "resize", handleResize);

      io.stdout.write(ENTER_ALTERNATE_SCREEN);
      io.stdout.write(HIDE_CURSOR);
      if (currentOptions.enableMouse !== false) {
        io.stdout.write(ENABLE_MOUSE);
      }

      rerenderInternal();
    },
    stop() {
      if (!running) {
        return;
      }

      running = false;
      unlisten(io.stdin, "data", handleData);
      unlisten(io.stdout, "resize", handleResize);
      io.stdin.setRawMode?.(false);
      io.stdin.pause?.();
      if (currentOptions.enableMouse !== false) {
        io.stdout.write(DISABLE_MOUSE);
      }
      io.stdout.write(SHOW_CURSOR);
      io.stdout.write(LEAVE_ALTERNATE_SCREEN);
    },
    isRunning() {
      return running;
    },
    update(nextRoot, nextOptions) {
      if (nextRoot !== undefined) {
        currentRoot = nextRoot;
      }

      if (nextOptions !== undefined) {
        currentOptions = mergeHostConfig(currentOptions, nextOptions);
      }

      runtime.update(currentRoot, buildRuntimeOptions(currentOptions, io.stdout));
      if (running) {
        rerenderInternal();
      }
    },
    render() {
      runtime.update(currentRoot, buildRuntimeOptions(currentOptions, io.stdout));
      return runtime.render();
    },
    rerender() {
      runtime.update(currentRoot, buildRuntimeOptions(currentOptions, io.stdout));
      return runtime.rerender();
    },
    getRuntime() {
      return runtime;
    },
  };

  function applyControl(control: TerminalControl): boolean {
    switch (control.type) {
      case "quit":
        if (currentOptions.exitOnCtrlC !== false) {
          lastPointerDown = null;
          stopInternal();
          return false;
        }

        runtime.dispatchKeyDown("Ctrl+C", "\u0003");
        return true;
      case "focusNext":
        runtime.focusNext("\t");
        return true;
      case "focusPrevious":
        runtime.focusPrevious("\u001b[Z");
        return true;
      case "keyDown":
        runtime.dispatchKeyDown(control.key, control.key);
        return true;
      case "pointerDown":
        lastPointerDown = control.point;
        runtime.dispatchEvent({ type: "pointerDown", point: control.point });
        return true;
      case "pointerMove":
        runtime.dispatchEvent({ type: "pointerMove", point: control.point });
        return true;
      case "pointerUp":
        runtime.dispatchEvent({ type: "pointerUp", point: control.point });
        if (
          lastPointerDown !== null &&
          lastPointerDown.x === control.point.x &&
          lastPointerDown.y === control.point.y
        ) {
          runtime.dispatchEvent({ type: "click", point: control.point });
        }
        lastPointerDown = null;
        return true;
      case "scroll":
        runtime.dispatchEvent({
          type: "scroll",
          point: control.point,
          delta: control.delta,
        });
        return true;
    }
  }

  function stopInternal(): void {
    if (!running) {
      return;
    }

    running = false;
    unlisten(io.stdin, "data", handleData);
    unlisten(io.stdout, "resize", handleResize);
    io.stdin.setRawMode?.(false);
    io.stdin.pause?.();
    if (currentOptions.enableMouse !== false) {
      io.stdout.write(DISABLE_MOUSE);
    }
    io.stdout.write(SHOW_CURSOR);
    io.stdout.write(LEAVE_ALTERNATE_SCREEN);
  }

  function rerenderInternal(): FrameBuffer {
    runtime.update(currentRoot, buildRuntimeOptions(currentOptions, io.stdout));
    const buffer = runtime.rerender();
    io.stdout.write(CLEAR_SCREEN);
    io.stdout.write(buffer.toString());
    io.stdout.write("\u001b[J");
    return buffer;
  }
}

export function consumeTerminalInput(input: string): TerminalInputParseResult {
  const controls: TerminalControl[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (char !== ESC) {
      const control = parsePlainCharacter(char);
      if (control !== null) {
        controls.push(control);
      }
      index += 1;
      continue;
    }

    if (index + 1 >= input.length) {
      break;
    }

    if (input[index + 1] !== "[") {
      controls.push({ type: "keyDown", key: "Escape" });
      index += 1;
      continue;
    }

    if (index + 2 >= input.length) {
      break;
    }

    const marker = input[index + 2];
    if (marker === "A") {
      controls.push({ type: "keyDown", key: "ArrowUp" });
      index += 3;
      continue;
    }

    if (marker === "B") {
      controls.push({ type: "keyDown", key: "ArrowDown" });
      index += 3;
      continue;
    }

    if (marker === "C") {
      controls.push({ type: "keyDown", key: "ArrowRight" });
      index += 3;
      continue;
    }

    if (marker === "D") {
      controls.push({ type: "keyDown", key: "ArrowLeft" });
      index += 3;
      continue;
    }

    if (marker === "Z") {
      controls.push({ type: "focusPrevious" });
      index += 3;
      continue;
    }

    if (marker !== "<") {
      controls.push({ type: "keyDown", key: "Escape" });
      index += 1;
      continue;
    }

    const endIndex = findMouseSequenceEnd(input, index + 3);
    if (endIndex === -1) {
      break;
    }

    const control = parseMouseSequence(
      input.slice(index + 3, endIndex),
      input[endIndex] === "m" ? "m" : "M",
    );
    if (control !== null) {
      controls.push(control);
    }
    index = endIndex + 1;
  }

  return {
    controls,
    rest: input.slice(index),
  };
}

export function resolveTerminalConstraints(
  constraints: Constraints | undefined,
  output: Pick<TerminalOutputStream, "columns" | "rows">,
): Constraints {
  const maxWidth = clampConstraint(constraints?.maxWidth, output.columns);
  const maxHeight = clampConstraint(constraints?.maxHeight, output.rows);

  return {
    ...(maxWidth !== undefined ? { maxWidth } : {}),
    ...(maxHeight !== undefined ? { maxHeight } : {}),
  };
}

function resolveHostIO(io: Partial<TerminalHostIO> | undefined): TerminalHostIO {
  return {
    stdin: io?.stdin ?? process.stdin,
    stdout: io?.stdout ?? process.stdout,
  };
}

function cloneHostConfig<THandler>(
  options: TerminalTuiHostOptions<THandler>,
): TerminalTuiHostConfig<THandler> {
  const scrollOffsets = cloneScrollOffsets(options.scrollOffsets);

  return {
    ...options,
    constraints: cloneConstraints(options.constraints),
    ...(scrollOffsets !== undefined ? { scrollOffsets } : {}),
  };
}

function mergeHostConfig<THandler>(
  current: TerminalTuiHostConfig<THandler>,
  patch: Partial<TerminalTuiHostConfig<THandler>>,
): TerminalTuiHostConfig<THandler> {
  const scrollOffsets =
    patch.scrollOffsets === undefined
      ? cloneScrollOffsets(current.scrollOffsets)
      : cloneScrollOffsets(patch.scrollOffsets);

  return {
    ...current,
    ...patch,
    constraints:
      patch.constraints === undefined
        ? cloneConstraints(current.constraints)
        : cloneConstraints(patch.constraints),
    ...(scrollOffsets !== undefined ? { scrollOffsets } : {}),
  };
}

function buildRuntimeOptions<THandler>(
  options: TerminalTuiHostConfig<THandler>,
  output: TerminalOutputStream,
): TuiRuntimeOptions<THandler> {
  const scrollOffsets = cloneScrollOffsets(options.scrollOffsets);

  return {
    ...options,
    constraints: resolveTerminalConstraints(options.constraints, output),
    ...(scrollOffsets !== undefined ? { scrollOffsets } : {}),
  };
}

function cloneConstraints(constraints: Constraints | undefined): Constraints {
  return {
    ...(constraints?.maxWidth !== undefined
      ? { maxWidth: constraints.maxWidth }
      : {}),
    ...(constraints?.maxHeight !== undefined
      ? { maxHeight: constraints.maxHeight }
      : {}),
  };
}

function cloneScrollOffsets(
  scrollOffsets: ReadonlyMap<number, ScrollOffset> | undefined,
): Map<number, ScrollOffset> | undefined {
  if (scrollOffsets === undefined) {
    return undefined;
  }

  const next = new Map<number, ScrollOffset>();
  for (const [nodeId, offset] of scrollOffsets) {
    next.set(nodeId, { x: offset.x, y: offset.y });
  }

  return next;
}

function clampConstraint(base: number | undefined, terminal: number | undefined) {
  const normalizedTerminal =
    typeof terminal === "number" && Number.isFinite(terminal) && terminal > 0
      ? Math.trunc(terminal)
      : undefined;

  if (normalizedTerminal === undefined) {
    return base;
  }

  if (base === undefined) {
    return normalizedTerminal;
  }

  return Math.min(base, normalizedTerminal);
}

function parsePlainCharacter(char: string | undefined): TerminalControl | null {
  if (char === undefined) {
    return null;
  }

  if (char === "\u0003") {
    return { type: "quit" };
  }

  if (char === "\t") {
    return { type: "focusNext" };
  }

  if (char === "\r" || char === "\n") {
    return { type: "keyDown", key: "Enter" };
  }

  if (char === "\u007f") {
    return { type: "keyDown", key: "Backspace" };
  }

  if (char.charCodeAt(0) < 32) {
    return null;
  }

  return { type: "keyDown", key: char };
}

function findMouseSequenceEnd(input: string, startIndex: number): number {
  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];
    if (char === "M" || char === "m") {
      return index;
    }
  }

  return -1;
}

function parseMouseSequence(
  payload: string,
  terminator: "M" | "m",
): TerminalControl | null {
  const parts = payload.split(";");
  if (parts.length !== 3) {
    return null;
  }

  const code = Number.parseInt(parts[0] ?? "", 10);
  const column = Number.parseInt(parts[1] ?? "", 10);
  const row = Number.parseInt(parts[2] ?? "", 10);
  if (!Number.isInteger(code) || !Number.isInteger(column) || !Number.isInteger(row)) {
    return null;
  }

  const point = { x: Math.max(0, column - 1), y: Math.max(0, row - 1) };

  if ((code & 64) !== 0) {
    const direction = code & 3;
    if (direction === 0) {
      return { type: "scroll", point, delta: { x: 0, y: -1 } };
    }

    if (direction === 1) {
      return { type: "scroll", point, delta: { x: 0, y: 1 } };
    }

    return null;
  }

  if (terminator === "m") {
    return { type: "pointerUp", point };
  }

  if ((code & 32) !== 0) {
    return { type: "pointerMove", point };
  }

  return { type: "pointerDown", point };
}

function listen<TTarget, TEvent extends string, TListener extends (...args: any[]) => void>(
  target: TTarget & { on(event: TEvent, listener: TListener): unknown },
  event: TEvent,
  listener: TListener,
): void {
  target.on(event, listener);
}

function unlisten<TTarget, TEvent extends string, TListener extends (...args: any[]) => void>(
  target: TTarget & {
    off?(event: TEvent, listener: TListener): unknown;
    removeListener?(event: TEvent, listener: TListener): unknown;
  },
  event: TEvent,
  listener: TListener,
): void {
  if (typeof target.off === "function") {
    target.off(event, listener);
    return;
  }

  target.removeListener?.(event, listener);
}