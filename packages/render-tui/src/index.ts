export { FrameBuffer } from "./frame-buffer.js";
export type { Cell } from "./frame-buffer.js";
export {
  dispatchTuiBinding,
  resolveTuiBinding,
  resolveTuiFocusTarget,
} from "./events.js";
export type { TuiInputOptions, TuiPoint } from "./events.js";
export { renderToFrameBuffer } from "./render.js";
export type { RenderOptions } from "./render.js";
export { mountTuiRoot } from "./runtime.js";
export type {
  MountedTuiRoot,
  TuiDispatchEvent,
  TuiFocusChangeEvent,
  TuiKeyboardEventLike,
  TuiRuntimeEvent,
  TuiRuntimeOptions,
  TuiScrollDelta,
} from "./runtime.js";
export {
  consumeTerminalInput,
  mountTerminalTuiHost,
  resolveTerminalConstraints,
  resolveTerminalMouseSupport,
  supportsTerminalMouse,
} from "./terminal-host.js";
export { render, tuiRenderer } from "./render-app.js";
export type { MountedRenderedTuiApp } from "./render-app.js";
export type {
  MountedTerminalTuiHost,
  TerminalControl,
  TerminalEnvironment,
  TerminalHostIO,
  TerminalInputParseResult,
  TerminalInputStream,
  TerminalMouseMode,
  TerminalMouseSupport,
  TerminalOutputStream,
  TerminalTuiHostConfig,
  TerminalTuiHostOptions,
} from "./terminal-host.js";
export type { ScrollOffset } from "@faux-ui/core";
export { View, Text } from "@faux-ui/reconciler";
export type { ViewProps, TextProps } from "@faux-ui/reconciler";
export { createTuiTextMeasurer } from "./text-measurer.js";
export type { TuiTextMeasurer } from "./text-measurer.js";
