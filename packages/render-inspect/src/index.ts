import type { ReactNode } from "react";

import type { SemanticColor, StyleValue, UINode } from "@faux-ui/core";
import {
  mountRendererApp,
  type MountedRendererApp,
  type RendererDefinition,
  type RendererThemeValues,
} from "@faux-ui/renderer";

export interface InspectThemeTarget {
  variables: Partial<Record<SemanticColor, string>>;
  setThemeVariable(name: string, value: string): void;
}

export interface InspectRendererCapabilities {
  output: "tree-snapshot";
  supportsFocus: boolean;
  supportsHover: boolean;
  supportsThemeTarget: boolean;
}

export interface InspectRendererMetadata {
  capabilities: InspectRendererCapabilities;
  themeTargetExample: string;
  notes: string[];
}

export interface InspectRendererOptions {
  themeTarget?: InspectThemeTarget;
  includeNodeIds?: boolean;
}

export interface InspectRendererHandle {
  currentRoot: UINode;
  themeTarget: InspectThemeTarget;
  includeNodeIds: boolean;
}

export interface MountedRenderedInspectApp extends MountedRendererApp<
  void,
  InspectRendererHandle,
  string
> {
  snapshot(): string;
  getThemeTarget(): InspectThemeTarget;
  getCapabilities(): InspectRendererCapabilities;
}

export const inspectRendererCapabilities: InspectRendererCapabilities = {
  output: "tree-snapshot",
  supportsFocus: true,
  supportsHover: true,
  supportsThemeTarget: true,
};

export const inspectRendererMetadata: InspectRendererMetadata = {
  capabilities: inspectRendererCapabilities,
  themeTargetExample: "createInspectThemeTarget()",
  notes: [
    "This first-party package is a proof-of-shape for contributor-built renderers.",
    "It serializes the mounted faux-ui tree instead of talking to a host platform.",
  ],
};

export function createInspectThemeTarget(
  initial: RendererThemeValues = {},
): InspectThemeTarget {
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

export const inspectRenderer: RendererDefinition<
  InspectRendererOptions,
  MountedRenderedInspectApp,
  InspectThemeTarget
> = {
  name: "inspect",
  detect: () => false,
  render(node, options) {
    return render(node, options);
  },
  applyTheme(target, theme) {
    applyInspectTheme(target, theme);
  },
};

export function render(
  node: ReactNode,
  options: InspectRendererOptions = {},
): MountedRenderedInspectApp {
  const mounted = mountRendererApp<
    InspectRendererOptions,
    void,
    InspectRendererHandle,
    string
  >(node, options, {
    targetName: inspectRenderer.name,
    mount(root, initialOptions) {
      return {
        currentRoot: root,
        themeTarget: initialOptions.themeTarget ?? createInspectThemeTarget(),
        includeNodeIds: initialOptions.includeNodeIds ?? false,
      };
    },
    update(handle, root) {
      handle.currentRoot = root;
    },
    rerender(handle) {
      return serializeNode(handle.currentRoot, handle.includeNodeIds);
    },
    unmount() {},
  });

  return {
    ...mounted,
    rerender() {
      const handle = mounted.getImplementationHandle();
      return serializeNode(handle.currentRoot, handle.includeNodeIds);
    },
    snapshot() {
      const handle = mounted.getImplementationHandle();
      return serializeNode(handle.currentRoot, handle.includeNodeIds);
    },
    getThemeTarget() {
      return mounted.getImplementationHandle().themeTarget;
    },
    getCapabilities() {
      return inspectRendererCapabilities;
    },
  };
}

function applyInspectTheme(
  target: InspectThemeTarget,
  theme: RendererThemeValues,
): void {
  for (const [token, value] of Object.entries(theme)) {
    if (value === undefined) {
      continue;
    }

    target.setThemeVariable(`--faux-ui-color-${token}`, value);
  }
}

function serializeNode(
  node: UINode,
  includeNodeIds: boolean,
  depth = 0,
): string {
  const indent = "  ".repeat(depth);
  const nodeId = includeNodeIds ? `#${node.id}` : "";

  if (node.kind === "text") {
    const parts = [`${indent}text${nodeId} ${JSON.stringify(node.spec.text)}`];

    if (node.spec.style !== null) {
      parts.push(`style=${formatStyle(node.spec.style)}`);
    }

    return parts.join(" ");
  }

  const parts = [`${indent}view${nodeId}`];

  if (node.spec.focusable) {
    parts.push("focusable");
  }

  if (node.spec.rows !== null) {
    parts.push(`rows=${JSON.stringify(node.spec.rows)}`);
  }

  if (node.spec.columns !== null) {
    parts.push(`columns=${JSON.stringify(node.spec.columns)}`);
  }

  if (node.spec.scroll !== null) {
    parts.push(`scroll=${JSON.stringify(node.spec.scroll)}`);
  }

  if (node.spec.style !== null) {
    parts.push(`style=${formatStyle(node.spec.style)}`);
  }

  if (node.spec.styleHover !== null) {
    parts.push(`styleHover=${formatStyle(node.spec.styleHover)}`);
  }

  if (node.spec.styleFocus !== null) {
    parts.push(`styleFocus=${formatStyle(node.spec.styleFocus)}`);
  }

  const lines = [parts.join(" ")];
  for (const child of node.children) {
    lines.push(serializeNode(child, includeNodeIds, depth + 1));
  }

  return lines.join("\n");
}

function formatStyle(style: StyleValue): string {
  const parts: string[] = [];

  if (style.color !== undefined) {
    parts.push(`color:${style.color}`);
  }

  if (style.background !== undefined) {
    parts.push(`background:${style.background}`);
  }

  return `{${parts.join(",")}}`;
}
