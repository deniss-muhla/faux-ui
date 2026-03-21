import {
  buildRenderTree,
  type BoundedConstraints,
  type RenderTreeNode,
  type SemanticColor,
  type ScrollOffset,
  type UINode,
} from "@faux-ui/core";

export interface DomRenderOptions {
  constraints: BoundedConstraints;
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
        }
      : {
          constraints: options.constraints,
          scrollOffsets: options.scrollOffsets,
        },
  );

  return buildNode(tree.root, options, { x: 0, y: 0 });
}

function buildNode(
  node: RenderTreeNode,
  options: Pick<DomRenderOptions, "hoveredNodeIds" | "focusedNodeId">,
  origin: { x: number; y: number },
): DomRenderNode {
  if (node.kind === "text") {
    return buildTextNode(node, origin);
  }

  return buildViewNode(node, options, origin);
}

function buildTextNode(
  node: Extract<RenderTreeNode, { kind: "text" }>,
  origin: { x: number; y: number },
): DomRenderNode {
  const styles: Record<string, string> = {
    position: "absolute",
    left: cellWidth(node.frame.x - origin.x),
    top: cellHeight(node.frame.y - origin.y),
    width: cellWidth(node.frame.width),
    height: cellHeight(node.frame.height),
    whiteSpace: "pre",
    overflow: "hidden",
    fontFamily: "var(--faux-ui-font-family, monospace)",
    lineHeight: "var(--faux-ui-cell-height, 1em)",
    fontVariantLigatures: "none",
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
  origin: { x: number; y: number },
): DomRenderNode {
  const styles: Record<string, string> = {
    position: "absolute",
    left: cellWidth(node.frame.x - origin.x),
    top: cellHeight(node.frame.y - origin.y),
    width: cellWidth(node.frame.width),
    height: cellHeight(node.frame.height),
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
    children: node.children.map((child) =>
      buildNode(child, options, { x: node.frame.x, y: node.frame.y }),
    ),
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

function cellWidth(value: number): string {
  if (value === 0) {
    return "0px";
  }

  return `calc(var(--faux-ui-cell-width, 1ch) * ${String(value)})`;
}

function cellHeight(value: number): string {
  if (value === 0) {
    return "0px";
  }

  return `calc(var(--faux-ui-cell-height, 1em) * ${String(value)})`;
}
