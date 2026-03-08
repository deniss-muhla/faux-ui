#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  appendChild,
  buildRenderTree,
  createTextNode,
  createViewNode,
  layoutNode,
  type BoundActions,
  type Constraints,
  type ScrollAxis,
  type StyleValue,
  type UINode,
} from "@faux-ui/core";
import { formatLayoutDump, type LayoutDumpNode } from "@faux-ui/devtools";
import { renderToDomModel, type DomRenderNode } from "@faux-ui/dom";
import {
  decodeCompactDocument,
  validateDocumentSpec,
  type ActionBindings,
  type DocumentSpec,
  type ElementSpec,
} from "@faux-ui/schema";
import {
  createTuiTextMeasurer,
  mountTerminalTuiHost,
  renderToFrameBuffer,
  type TerminalInputStream,
  type TerminalOutputStream,
} from "@faux-ui/tui";

export type ExecutionTarget = "dom" | "tui";
export type ExecutionFormat = "auto" | "readable" | "compact";
export type InspectMode = "layout" | "render-tree";
export type ExecutionMode = "auto" | "interactive" | "static";

export interface ExecutionOptions {
  entry: string;
  target: ExecutionTarget;
  format: ExecutionFormat;
  inspect: InspectMode | null;
  mode: ExecutionMode;
  constraints: Constraints;
}

export interface ExecutionIO {
  stdin: Pick<TerminalInputStream, "isTTY"> & TerminalInputStream;
  stdout: Pick<TerminalOutputStream, "columns" | "isTTY" | "rows"> &
    TerminalOutputStream;
}

const DEFAULT_TARGET: ExecutionTarget = "dom";
const DEFAULT_FORMAT: ExecutionFormat = "auto";
const DEFAULT_MODE: ExecutionMode = "auto";
const HELP_FLAGS = new Set(["--help", "-h"]);

export function buildExecutionMessage(
  entry: string,
  target = DEFAULT_TARGET,
): string {
  return buildUsage(`exec-faux-ui entry: ${entry}`, `target: ${target}`);
}

export function executeDocumentText(
  sourceText: string,
  options: Omit<ExecutionOptions, "entry" | "mode"> & { entry?: string },
): string {
  const document = parseDocumentText(sourceText, options.format);
  return executeDocument(document, {
    ...options,
    entry: options.entry ?? "<memory>",
    mode: DEFAULT_MODE,
  });
}

export function run(args: string[]): string {
  const parsed = parseExecutionOptions(args);
  if (parsed.help) {
    return buildUsage();
  }

  const sourceText = readEntryText(parsed.options.entry);
  return executeDocumentText(sourceText, parsed.options);
}

export function main(args: string[]): number {
  return mainWithIO(args, {
    stdin: process.stdin,
    stdout: process.stdout,
  });
}

export function mainWithIO(args: string[], io: ExecutionIO): number {
  try {
    const parsed = parseExecutionOptions(args);
    if (parsed.help) {
      io.stdout.write(`${buildUsage()}\n`);
      return 0;
    }

    const sourceText = readEntryText(parsed.options.entry);
    const document = parseDocumentText(sourceText, parsed.options.format);

    if (shouldUseInteractiveTui(parsed.options, io)) {
      if (!io.stdin.isTTY || !io.stdout.isTTY) {
        throw new Error("Interactive TUI mode requires TTY stdin and stdout.");
      }

      startInteractiveTui(document, parsed.options, io);
      return 0;
    }

    io.stdout.write(`${executeDocument(document, parsed.options)}\n`);
    return 0;
  } catch (error) {
    console.error(formatExecutionError(error));
    return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  process.exitCode = main(process.argv.slice(2));
}

function parseExecutionOptions(args: string[]):
  | {
      help: true;
    }
  | {
      help: false;
      options: ExecutionOptions;
    } {
  let entry: string | null = null;
  let target: ExecutionTarget = DEFAULT_TARGET;
  let format: ExecutionFormat = DEFAULT_FORMAT;
  let inspect: InspectMode | null = null;
  let mode: ExecutionMode = DEFAULT_MODE;
  let maxWidth: number | undefined;
  let maxHeight: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (HELP_FLAGS.has(arg)) {
      return { help: true };
    }

    if (arg === "--target") {
      target = parseTarget(requireOptionValue(args, ++index, arg));
      continue;
    }

    if (arg === "--format") {
      format = parseFormat(requireOptionValue(args, ++index, arg));
      continue;
    }

    if (arg === "--inspect") {
      inspect = parseInspectMode(requireOptionValue(args, ++index, arg));
      continue;
    }

    if (arg === "--mode") {
      mode = parseMode(requireOptionValue(args, ++index, arg));
      continue;
    }

    if (arg === "--interactive") {
      mode = "interactive";
      continue;
    }

    if (arg === "--static") {
      mode = "static";
      continue;
    }

    if (arg === "--max-width") {
      maxWidth = parseConstraintValue(
        requireOptionValue(args, ++index, arg),
        arg,
      );
      continue;
    }

    if (arg === "--max-height") {
      maxHeight = parseConstraintValue(
        requireOptionValue(args, ++index, arg),
        arg,
      );
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (entry !== null) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }

    entry = arg;
  }

  if (entry === null) {
    throw new Error("Missing entry path. Use --help for usage.");
  }

  return {
    help: false,
    options: {
      entry,
      target,
      format,
      inspect,
      mode,
      constraints: {
        ...(maxWidth !== undefined ? { maxWidth } : {}),
        ...(maxHeight !== undefined ? { maxHeight } : {}),
      },
    },
  };
}

function executeDocument(
  document: DocumentSpec,
  options: ExecutionOptions,
): string {
  const root = buildNodeTree(document.root);

  if (options.inspect === "layout") {
    layoutNode(root, options.constraints, {
      measureText: measureText,
    });
    return formatLayoutDump(buildLayoutDump(root));
  }

  if (options.inspect === "render-tree") {
    const tree = buildRenderTree(root, {
      constraints: options.constraints,
      measureText,
    });
    return JSON.stringify(serializeRenderNode(tree.root), null, 2);
  }

  if (options.target === "tui") {
    return renderToFrameBuffer(root, {
      constraints: options.constraints,
    }).toString();
  }

  const model = renderToDomModel(root, {
    constraints: options.constraints,
    measureText,
  });
  return JSON.stringify(serializeDomNode(model), null, 2);
}

function readEntryText(entry: string): string {
  if (entry === "-") {
    return readFileSync(0, "utf8");
  }

  return readFileSync(resolve(entry), "utf8");
}

function parseDocumentText(
  sourceText: string,
  format: ExecutionFormat,
): DocumentSpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceText);
  } catch (error) {
    throw new Error(`Entry is not valid JSON: ${formatExecutionError(error)}`);
  }

  const result =
    format === "compact"
      ? decodeCompactDocument(parsed)
      : format === "readable"
        ? validateDocumentSpec(parsed)
        : Array.isArray(parsed)
          ? decodeCompactDocument(parsed)
          : validateDocumentSpec(parsed);

  if (!result.ok) {
    const details = result.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Document validation failed:\n${details}`);
  }

  return result.value;
}

function buildNodeTree(spec: ElementSpec): UINode {
  if (spec.kind === "text") {
    return createTextNode({
      ...(spec.key !== undefined ? { key: spec.key } : {}),
      spec: {
        text: spec.text,
        wrap: spec.wrap ?? false,
        style: cloneStyle(spec.style),
      },
    });
  }

  const node = createViewNode({
    ...(spec.key !== undefined ? { key: spec.key } : {}),
    ...(spec.bind !== undefined ? { bindings: cloneBindings(spec.bind) } : {}),
    spec: {
      rows: spec.rows ?? null,
      columns: spec.columns ?? null,
      scroll: (spec.scroll ?? null) as ScrollAxis | null,
      style: cloneStyle(spec.style),
      styleHover: cloneStyle(spec.styleHover),
      styleFocus: cloneStyle(spec.styleFocus),
      focusable: spec.focusable ?? false,
    },
  });

  for (const child of spec.children ?? []) {
    appendChild(node, buildNodeTree(child));
  }

  return node;
}

function buildLayoutDump(node: UINode): LayoutDumpNode {
  const size = node.layout.cachedSize ?? { width: 0, height: 0 };
  return {
    id: node.id,
    kind: node.kind,
    width: size.width,
    height: size.height,
    children: node.children.map((child) => buildLayoutDump(child)),
  };
}

function serializeRenderNode(
  node: ReturnType<typeof buildRenderTree>["root"],
): unknown {
  return {
    nodeId: node.nodeId,
    kind: node.kind,
    frame: node.frame,
    clipRect: node.clipRect,
    contentSize: node.contentSize,
    scrollOffset: node.scrollOffset,
    children: node.children.map((child) => serializeRenderNode(child)),
  };
}

function serializeDomNode(node: DomRenderNode): unknown {
  return {
    nodeId: node.nodeId,
    kind: node.kind,
    tag: node.tag,
    ...(node.textContent !== undefined
      ? { textContent: node.textContent }
      : {}),
    styles: node.styles,
    children: node.children.map((child) => serializeDomNode(child)),
  };
}

function cloneStyle(style: StyleValue | undefined): StyleValue | null {
  if (style === undefined) {
    return null;
  }

  return {
    ...(style.color !== undefined ? { color: style.color } : {}),
    ...(style.background !== undefined ? { background: style.background } : {}),
  };
}

function cloneBindings(bindings: ActionBindings): BoundActions {
  const next: BoundActions = {};
  for (const [name, token] of Object.entries(bindings)) {
    if (token !== undefined) {
      next[name as keyof BoundActions] = token;
    }
  }

  return next;
}

function parseTarget(value: string): ExecutionTarget {
  if (value === "dom" || value === "tui") {
    return value;
  }

  throw new Error(`Unsupported target: ${value}`);
}

function parseFormat(value: string): ExecutionFormat {
  if (value === "auto" || value === "readable" || value === "compact") {
    return value;
  }

  throw new Error(`Unsupported format: ${value}`);
}

function parseInspectMode(value: string): InspectMode {
  if (value === "layout" || value === "render-tree") {
    return value;
  }

  throw new Error(`Unsupported inspect mode: ${value}`);
}

function parseMode(value: string): ExecutionMode {
  if (value === "auto" || value === "interactive" || value === "static") {
    return value;
  }

  throw new Error(`Unsupported execution mode: ${value}`);
}

function parseConstraintValue(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return parsed;
}

function requireOptionValue(
  args: string[],
  index: number,
  flag: string,
): string {
  const value = args[index];
  if (value === undefined) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function buildUsage(...preamble: string[]): string {
  const lines = [
    ...preamble,
    "Usage: exec-faux-ui <entry|-> [--target dom|tui] [--format auto|readable|compact] [--inspect layout|render-tree] [--mode auto|interactive|static] [--interactive] [--static] [--max-width N] [--max-height N]",
    "- entry can be a JSON file path or - for stdin",
    "- auto format accepts readable document objects or compact FUI arrays",
    "- target dom prints a DOM projection model as JSON",
    "- target tui uses an interactive terminal host on TTYs unless --static is set",
    "- --interactive forces the live TUI host and requires TTY stdin/stdout",
    "- inspect layout prints a semantic size tree",
    "- inspect render-tree prints the visible render tree as JSON",
  ];

  return lines.join("\n");
}

function formatExecutionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const tuiTextMeasurer = createTuiTextMeasurer();

function measureText(request: {
  text: string;
  wrap: boolean;
  maxWidth: number | undefined;
}): { width: number; height: number } {
  return tuiTextMeasurer.measure(request);
}

export function shouldUseInteractiveTui(
  options: Pick<ExecutionOptions, "inspect" | "mode" | "target">,
  io: Pick<ExecutionIO, "stdin" | "stdout">,
): boolean {
  if (options.target !== "tui" || options.inspect !== null) {
    return false;
  }

  if (options.mode === "static") {
    return false;
  }

  if (options.mode === "interactive") {
    return true;
  }

  return Boolean(io.stdin.isTTY && io.stdout.isTTY);
}

function startInteractiveTui(
  document: DocumentSpec,
  options: ExecutionOptions,
  io: ExecutionIO,
): void {
  const root = buildNodeTree(document.root);
  const host = mountTerminalTuiHost(root, {
    constraints: options.constraints,
    io,
  });
  host.start();
}
