import type { ReactNode } from "react";

import {
  defaultSemanticColors,
  type SemanticColor,
  type StyleValue,
  type UINode,
} from "@faux-ui/core";
import {
  mountRendererApp,
  type MountedRendererApp,
  type RendererDefinition,
  type RendererThemeValues,
} from "@faux-ui/renderer";

const canvasPadding = 24;
const lineHeight = 24;
const indentSize = 20;

interface CanvasPaintLine {
  depth: number;
  text: string;
  color: SemanticColor;
  background: SemanticColor | null;
}

export interface CanvasThemeTarget {
  variables: Partial<Record<SemanticColor, string>>;
  setThemeVariable(name: string, value: string): void;
}

export interface CanvasRendererCapabilities {
  output: "canvas-outline";
  supportsFocus: boolean;
  supportsHover: boolean;
  supportsThemeTarget: boolean;
}

export interface CanvasRendererMetadata {
  capabilities: CanvasRendererCapabilities;
  themeTargetExample: string;
  notes: string[];
}

export interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  themeTarget?: CanvasThemeTarget;
  includeNodeIds?: boolean;
}

interface CanvasRendererHandle {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  currentRoot: UINode;
  themeTarget: CanvasThemeTarget;
  includeNodeIds: boolean;
}

export interface MountedCanvasRendererApp extends MountedRendererApp<
  void,
  CanvasRendererHandle,
  void
> {
  repaint(): void;
  getThemeTarget(): CanvasThemeTarget;
  getCapabilities(): CanvasRendererCapabilities;
}

export const canvasRendererCapabilities: CanvasRendererCapabilities = {
  output: "canvas-outline",
  supportsFocus: true,
  supportsHover: true,
  supportsThemeTarget: true,
};

export const canvasRendererMetadata: CanvasRendererMetadata = {
  capabilities: canvasRendererCapabilities,
  themeTargetExample: "createCanvasThemeTarget()",
  notes: [
    "This renderer lives entirely inside apps/example-renderer.",
    "It demonstrates a contributor-owned renderer without adding a new first-party renderer package.",
  ],
};

export function createCanvasThemeTarget(
  initial: RendererThemeValues = defaultSemanticColors,
): CanvasThemeTarget {
  const variables: Partial<Record<SemanticColor, string>> = {};

  for (const [token, value] of Object.entries(initial)) {
    if (value === undefined) {
      continue;
    }

    variables[token as SemanticColor] = value;
  }

  return {
    variables,
    setThemeVariable(name, value) {
      const prefix = "--faux-ui-color-";
      if (!name.startsWith(prefix)) {
        return;
      }

      variables[name.slice(prefix.length) as SemanticColor] = value;
    },
  };
}

export const canvasExampleRenderer: RendererDefinition<
  CanvasRendererOptions,
  MountedCanvasRendererApp,
  CanvasThemeTarget
> = {
  name: "canvas-example",
  detect: () => typeof globalThis === "object" && "document" in globalThis,
  render(node, options) {
    return render(node, options);
  },
  applyTheme(target, theme) {
    for (const [token, value] of Object.entries(theme)) {
      if (value === undefined) {
        continue;
      }

      target.setThemeVariable(`--faux-ui-color-${token}`, value);
    }
  },
};

export function render(
  node: ReactNode,
  options?: CanvasRendererOptions,
): MountedCanvasRendererApp {
  if (options === undefined) {
    throw new Error("Canvas example renderer requires a canvas element.");
  }

  const mounted = mountRendererApp<
    CanvasRendererOptions,
    void,
    CanvasRendererHandle,
    void
  >(node, options, {
    targetName: canvasExampleRenderer.name,
    mount(root, initialOptions) {
      const context = initialOptions.canvas.getContext("2d");
      if (context === null) {
        throw new Error(
          "Canvas example renderer requires a 2D canvas context.",
        );
      }

      const handle: CanvasRendererHandle = {
        canvas: initialOptions.canvas,
        context,
        currentRoot: root,
        themeTarget:
          initialOptions.themeTarget ??
          createCanvasThemeTarget(defaultSemanticColors),
        includeNodeIds: initialOptions.includeNodeIds ?? false,
      };

      paintCanvas(handle);
      return handle;
    },
    update(handle, root) {
      handle.currentRoot = root;
      paintCanvas(handle);
    },
    rerender(handle) {
      paintCanvas(handle);
    },
    unmount(handle) {
      handle.context.clearRect(0, 0, handle.canvas.width, handle.canvas.height);
    },
  });

  return {
    ...mounted,
    repaint() {
      paintCanvas(mounted.getImplementationHandle());
    },
    getThemeTarget() {
      return mounted.getImplementationHandle().themeTarget;
    },
    getCapabilities() {
      return canvasRendererCapabilities;
    },
  };
}

export function describeCanvasTree(
  node: UINode,
  includeNodeIds = false,
): string {
  return collectCanvasLines(node, includeNodeIds)
    .map((line) => `${"  ".repeat(line.depth)}${line.text}`)
    .join("\n");
}

function paintCanvas(handle: CanvasRendererHandle): void {
  const { canvas, context, currentRoot, includeNodeIds, themeTarget } = handle;
  const lines = collectCanvasLines(currentRoot, includeNodeIds);
  const requiredHeight = Math.max(
    420,
    canvasPadding * 2 + lines.length * lineHeight,
  );
  if (canvas.height !== requiredHeight) {
    canvas.height = requiredHeight;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = resolveColor(themeTarget, "bg");
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.font = '16px "IBM Plex Mono", "SFMono-Regular", monospace';
  context.textBaseline = "top";

  for (const [index, line] of lines.entries()) {
    const x = canvasPadding + line.depth * indentSize;
    const y = canvasPadding + index * lineHeight;

    if (line.background !== null) {
      context.fillStyle = resolveColor(themeTarget, line.background);
      context.fillRect(x - 8, y - 2, canvas.width - x - canvasPadding + 8, 20);
    }

    context.fillStyle = resolveColor(themeTarget, line.color);
    context.fillText(line.text, x, y);
  }
}

function collectCanvasLines(
  node: UINode,
  includeNodeIds: boolean,
  depth = 0,
): CanvasPaintLine[] {
  const idLabel = includeNodeIds ? `#${node.id}` : "";

  if (node.kind === "text") {
    return [
      {
        depth,
        text: `text${idLabel} ${JSON.stringify(node.spec.text)}`,
        color: node.spec.style?.color ?? "fg",
        background: node.spec.style?.background ?? null,
      },
    ];
  }

  const viewParts = [`view${idLabel}`];
  if (node.spec.focusable) {
    viewParts.push("[interactive]");
  }
  if (node.spec.rows !== null) {
    viewParts.push(`rows=${JSON.stringify(node.spec.rows)}`);
  }
  if (node.spec.columns !== null) {
    viewParts.push(`columns=${JSON.stringify(node.spec.columns)}`);
  }

  const lines: CanvasPaintLine[] = [
    {
      depth,
      text: viewParts.join(" "),
      color: node.spec.style?.color ?? "accent",
      background: node.spec.style?.background ?? null,
    },
  ];

  for (const child of node.children) {
    lines.push(...collectCanvasLines(child, includeNodeIds, depth + 1));
  }

  return lines;
}

function resolveColor(target: CanvasThemeTarget, color: SemanticColor): string {
  return target.variables[color] ?? defaultSemanticColors[color];
}

function formatStyle(_style: StyleValue): void {
  // Intentionally unused for now. The canvas example resolves styles directly in collectCanvasLines.
}
