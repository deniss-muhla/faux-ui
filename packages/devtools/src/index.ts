export interface LayoutDumpNode {
  id: number;
  kind: "view" | "text";
  width: number;
  height: number;
  children: LayoutDumpNode[];
}

export function formatLayoutDump(node: LayoutDumpNode, indent = 0): string {
  const line = `${" ".repeat(indent)}[${node.kind} ${node.width}x${node.height} #${node.id}]`;
  if (node.children.length === 0) {
    return line;
  }

  return [
    line,
    ...node.children.map((child) => formatLayoutDump(child, indent + 2)),
  ].join("\n");
}
