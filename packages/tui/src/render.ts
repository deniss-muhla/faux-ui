import {
  buildRenderTree,
  type BoundedConstraints,
  type RenderTreeNode,
  defaultSemanticColors,
  type SemanticColor,
  type ScrollOffset,
  type UINode,
} from "@faux-ui/core";
import { FrameBuffer } from "./frame-buffer.js";
import { createTuiTextMeasurer } from "./text-measurer.js";

export interface RenderOptions {
  constraints: BoundedConstraints;
  scrollOffsets?: ReadonlyMap<number, ScrollOffset>;
  hoveredNodeIds?: ReadonlySet<number>;
  focusedNodeId?: number | null;
}

interface RenderStyleState {
  color?: SemanticColor;
  background?: SemanticColor;
}

export function renderToFrameBuffer(
  root: UINode,
  options: RenderOptions,
): FrameBuffer {
  const measurer = createTuiTextMeasurer();
  const tree = buildRenderTree(
    root,
    options.scrollOffsets === undefined
      ? {
          constraints: options.constraints,
        }
      : {
          constraints: options.constraints,
          scrollOffsets: options.scrollOffsets,
        },
  );

  const buffer = new FrameBuffer(tree.size.width, tree.size.height);
  const defaultSurface: RenderStyleState = { color: "fg", background: "bg" };
  buffer.fillRect(
    0,
    0,
    tree.size.width,
    tree.size.height,
    resolveCellStyle(defaultSurface),
  );
  paintNode(tree.root, buffer, measurer, options, defaultSurface);
  return buffer;
}

function paintNode(
  node: RenderTreeNode,
  buffer: FrameBuffer,
  measurer: ReturnType<typeof createTuiTextMeasurer>,
  options: Pick<RenderOptions, "hoveredNodeIds" | "focusedNodeId">,
  inheritedStyle: RenderStyleState,
): void {
  if (node.clipRect.width <= 0 || node.clipRect.height <= 0) {
    return;
  }

  if (node.kind === "text") {
    paintTextNode(node, buffer, measurer, inheritedStyle);
    return;
  }

  paintViewNode(node, buffer, measurer, options, inheritedStyle);
}

function paintTextNode(
  node: Extract<RenderTreeNode, { kind: "text" }>,
  buffer: FrameBuffer,
  measurer: ReturnType<typeof createTuiTextMeasurer>,
  inheritedStyle: RenderStyleState,
): void {
  const lines = measurer.lines(node.node.spec.text);
  const style = mergeStyleValues(inheritedStyle, node.node.spec.style);

  const startLine = Math.max(0, node.clipRect.y - node.frame.y);
  const endLine = Math.min(
    lines.length,
    node.clipRect.y + node.clipRect.height - node.frame.y,
  );
  const startColumn = Math.max(0, node.clipRect.x - node.frame.x);
  const endColumn = node.clipRect.x + node.clipRect.width - node.frame.x;

  for (let lineIndex = startLine; lineIndex < endLine; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    buffer.writeText(
      node.clipRect.x,
      node.frame.y + lineIndex,
      line.slice(startColumn, Math.max(startColumn, endColumn)),
      resolveCellStyle(style),
    );
  }
}

function paintViewNode(
  node: Extract<RenderTreeNode, { kind: "view" }>,
  buffer: FrameBuffer,
  measurer: ReturnType<typeof createTuiTextMeasurer>,
  options: Pick<RenderOptions, "hoveredNodeIds" | "focusedNodeId">,
  inheritedStyle: RenderStyleState,
): void {
  const style = mergeStyleValues(
    inheritedStyle,
    node.node.spec.style,
    options.hoveredNodeIds?.has(node.nodeId) ? node.node.spec.styleHover : null,
    options.focusedNodeId === node.nodeId ? node.node.spec.styleFocus : null,
  );
  const cellStyle = resolveCellStyle(style);

  if (
    cellStyle.background !== undefined ||
    cellStyle.foreground !== undefined
  ) {
    buffer.fillRect(
      node.clipRect.x,
      node.clipRect.y,
      node.clipRect.width,
      node.clipRect.height,
      cellStyle,
    );
  }

  node.children.forEach((child) => {
    paintNode(child, buffer, measurer, options, style);
  });
}

function mergeStyleValues(
  ...styles: Array<{ color?: SemanticColor; background?: SemanticColor } | null>
): RenderStyleState {
  const merged: RenderStyleState = {};

  for (const style of styles) {
    if (style?.color !== undefined) {
      merged.color = style.color;
    }
    if (style?.background !== undefined) {
      merged.background = style.background;
    }
  }

  return merged;
}

function resolveCellStyle(style: RenderStyleState): {
  foreground?: string;
  background?: string;
} {
  return {
    ...(style.color !== undefined
      ? { foreground: defaultSemanticColors[style.color] }
      : {}),
    ...(style.background !== undefined
      ? { background: defaultSemanticColors[style.background] }
      : {}),
  };
}
