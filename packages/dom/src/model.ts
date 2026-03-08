import {
  buildRenderTree,
  type Constraints,
  type RenderTreeNode,
  type SemanticColor,
  type ScrollOffset,
  type TextLayoutRequest,
  type UINode,
} from "@faux-ui/core";

export interface DomRenderOptions {
  constraints: Constraints;
  measureText(request: TextLayoutRequest): { width: number; height: number };
  scrollOffsets?: ReadonlyMap<number, ScrollOffset>;
  hoveredNodeIds?: ReadonlySet<number>;
  focusedNodeId?: number | null;
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

  return buildNode(tree.root, options);
}

function buildNode(
  node: RenderTreeNode,
  options: Pick<DomRenderOptions, "hoveredNodeIds" | "focusedNodeId">,
): DomRenderNode {
  if (node.kind === "text") {
    return buildTextNode(node);
  }

  return buildViewNode(node, options);
}

function buildTextNode(
  node: Extract<RenderTreeNode, { kind: "text" }>,
): DomRenderNode {
  const styles: Record<string, string> = {
    position: "absolute",
    left: `${node.frame.x}px`,
    top: `${node.frame.y}px`,
    width: `${node.frame.width}px`,
    height: `${node.frame.height}px`,
    whiteSpace: node.node.spec.wrap ? "pre-wrap" : "pre",
    overflow: "hidden",
  };

  applyStyle(styles, node.node.spec.style);

  return {
    nodeId: node.nodeId,
    kind: "text",
    tag: "div",
    textContent: node.node.spec.text,
    styles,
    children: [],
  };
}

function buildViewNode(
  node: Extract<RenderTreeNode, { kind: "view" }>,
  options: Pick<DomRenderOptions, "hoveredNodeIds" | "focusedNodeId">,
): DomRenderNode {
  const styles: Record<string, string> = {
    position: "absolute",
    left: `${node.frame.x}px`,
    top: `${node.frame.y}px`,
    width: `${node.frame.width}px`,
    height: `${node.frame.height}px`,
    overflow: "hidden",
  };

  if (node.node.spec.focusable) {
    styles.outline = "none";
  }

  const style = mergeStyleValues(
    node.node.spec.style,
    options.hoveredNodeIds?.has(node.nodeId) ? node.node.spec.styleHover : null,
    options.focusedNodeId === node.nodeId ? node.node.spec.styleFocus : null,
  );
  applyStyle(styles, style);

  return {
    nodeId: node.nodeId,
    kind: "view",
    tag: "div",
    styles,
    children: node.children.map((child) => buildNode(child, options)),
  };
}

function mergeStyleValues(
  base: { color?: SemanticColor; background?: SemanticColor } | null,
  hover: { color?: SemanticColor; background?: SemanticColor } | null,
  focus: { color?: SemanticColor; background?: SemanticColor } | null,
): { color?: SemanticColor; background?: SemanticColor } | null {
  const merged = {
    ...(base ?? {}),
    ...(hover ?? {}),
    ...(focus ?? {}),
  };

  return Object.keys(merged).length === 0 ? null : merged;
}

function applyStyle(
  styles: Record<string, string>,
  style: { color?: SemanticColor; background?: SemanticColor } | null,
): void {
  if (style?.color !== undefined) {
    styles.color = toCssColor(style.color);
  }

  if (style?.background !== undefined) {
    styles.backgroundColor = toCssColor(style.background);
  }
}

function toCssColor(color: SemanticColor): string {
  return `var(--faux-ui-color-${color})`;
}
