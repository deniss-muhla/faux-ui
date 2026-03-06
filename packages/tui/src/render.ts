import {
  buildRenderTree,
  type Constraints,
  type RenderTreeNode,
  type ScrollOffset,
  type TextLayoutRequest,
  type UINode,
} from "@faux-ui/core";
import { FrameBuffer } from "./frame-buffer.js";
import { createTuiTextMeasurer } from "./text-measurer.js";

export interface RenderOptions {
  constraints: Constraints;
  scrollOffsets?: ReadonlyMap<number, ScrollOffset>;
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
          measureText: (request: TextLayoutRequest) =>
            measurer.measure(request),
        }
      : {
          constraints: options.constraints,
          scrollOffsets: options.scrollOffsets,
          measureText: (request: TextLayoutRequest) =>
            measurer.measure(request),
        },
  );

  const buffer = new FrameBuffer(tree.size.width, tree.size.height);
  paintNode(tree.root, buffer, measurer);
  return buffer;
}

function paintNode(
  node: RenderTreeNode,
  buffer: FrameBuffer,
  measurer: ReturnType<typeof createTuiTextMeasurer>,
): void {
  if (node.clipRect.width <= 0 || node.clipRect.height <= 0) {
    return;
  }

  if (node.kind === "text") {
    paintTextNode(node, buffer, measurer);
    return;
  }

  paintViewNode(node, buffer, measurer);
}

function paintTextNode(
  node: Extract<RenderTreeNode, { kind: "text" }>,
  buffer: FrameBuffer,
  measurer: ReturnType<typeof createTuiTextMeasurer>,
): void {
  const lines = measurer.lines({
    text: node.node.spec.text,
    wrap: node.node.spec.wrap,
    maxWidth: node.frame.width,
  });

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
    );
  }
}

function paintViewNode(
  node: Extract<RenderTreeNode, { kind: "view" }>,
  buffer: FrameBuffer,
  measurer: ReturnType<typeof createTuiTextMeasurer>,
): void {
  node.children.forEach((child) => {
    paintNode(child, buffer, measurer);
  });
}
