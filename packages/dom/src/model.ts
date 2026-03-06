import {
  buildRenderTree,
  type Constraints,
  type RenderTreeNode,
  type ScrollOffset,
  type TextLayoutRequest,
  type UINode,
} from "@faux-ui/core";

export interface DomRenderOptions {
  constraints: Constraints;
  measureText(request: TextLayoutRequest): { width: number; height: number };
  scrollOffsets?: ReadonlyMap<number, ScrollOffset>;
}

export interface DomRenderNode {
  nodeId: number;
  kind: "view" | "text";
  tag: "div";
  styles: Record<string, string>;
  textContent?: string;
  children: DomRenderNode[];
}

export function renderToDomModel(
  root: UINode,
  options: DomRenderOptions,
): DomRenderNode {
  const tree = buildRenderTree(
    root,
    options.scrollOffsets === undefined
      ? {
          constraints: options.constraints,
          measureText: options.measureText,
        }
      : {
          constraints: options.constraints,
          measureText: options.measureText,
          scrollOffsets: options.scrollOffsets,
        },
  );

  return buildNode(tree.root);
}

function buildNode(node: RenderTreeNode): DomRenderNode {
  if (node.kind === "text") {
    return buildTextNode(node);
  }

  return buildViewNode(node);
}

function buildTextNode(
  node: Extract<RenderTreeNode, { kind: "text" }>,
): DomRenderNode {
  return {
    nodeId: node.nodeId,
    kind: "text",
    tag: "div",
    textContent: node.node.spec.text,
    styles: {
      position: "absolute",
      left: `${node.frame.x}px`,
      top: `${node.frame.y}px`,
      width: `${node.frame.width}px`,
      height: `${node.frame.height}px`,
      whiteSpace: node.node.spec.wrap ? "pre-wrap" : "pre",
      overflow: "hidden",
    },
    children: [],
  };
}

function buildViewNode(
  node: Extract<RenderTreeNode, { kind: "view" }>,
): DomRenderNode {
  return {
    nodeId: node.nodeId,
    kind: "view",
    tag: "div",
    styles: {
      position: "absolute",
      left: `${node.frame.x}px`,
      top: `${node.frame.y}px`,
      width: `${node.frame.width}px`,
      height: `${node.frame.height}px`,
      overflow: "hidden",
    },
    children: node.children.map(buildNode),
  };
}
