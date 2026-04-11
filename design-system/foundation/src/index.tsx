import type { SemanticColor, TrackShorthand } from "@faux-ui/core";
import type { ReactNode } from "react";

export interface FoundationSurfaceTheme {
  canvas: SemanticColor;
  panel: SemanticColor;
  accent: SemanticColor;
  selection: SemanticColor;
  focus: SemanticColor;
  border: SemanticColor;
  text: SemanticColor;
  mutedText: SemanticColor;
  inverseText: SemanticColor;
  signal: SemanticColor;
}

export interface FoundationActionTheme {
  restBackground: SemanticColor;
  restText: SemanticColor;
  activeBackground: SemanticColor;
  activeText: SemanticColor;
  hoverBackground: SemanticColor;
  hoverText: SemanticColor;
  focusBackground: SemanticColor;
  focusText: SemanticColor;
  disabledBackground: SemanticColor;
  disabledText: SemanticColor;
}

export interface FoundationTheme {
  surface: FoundationSurfaceTheme;
  action: FoundationActionTheme;
}

export interface PartialFoundationTheme {
  surface?: Partial<FoundationSurfaceTheme>;
  action?: Partial<FoundationActionTheme>;
}

export interface ScaffoldProps {
  label?: string;
  title: string;
  description?: string;
  footer?: string;
  children?: ReactNode;
  theme?: PartialFoundationTheme;
}

export const defaultFoundationTheme: FoundationTheme = {
  surface: {
    canvas: "bg",
    panel: "bgAlt",
    accent: "accent",
    selection: "selection",
    focus: "focus",
    border: "border",
    text: "fg",
    mutedText: "muted",
    inverseText: "inverse",
    signal: "warning",
  },
  action: {
    restBackground: "bgAlt",
    restText: "fg",
    activeBackground: "selection",
    activeText: "fg",
    hoverBackground: "focus",
    hoverText: "inverse",
    focusBackground: "accent",
    focusText: "inverse",
    disabledBackground: "bgAlt",
    disabledText: "muted",
  },
};

export function mergeFoundationTheme(
  overrides: PartialFoundationTheme = {},
): FoundationTheme {
  return {
    surface: {
      ...defaultFoundationTheme.surface,
      ...overrides.surface,
    },
    action: {
      ...defaultFoundationTheme.action,
      ...overrides.action,
    },
  };
}

export function Scaffold(props: ScaffoldProps): ReactNode {
  const theme = mergeFoundationTheme(props.theme);
  const headerRows: TrackShorthand[] = [];
  const headerChildren: ReactNode[] = [];

  if (props.label !== undefined) {
    headerRows.push(1);
    headerChildren.push(
      <text key="label" style={{ color: theme.surface.signal }}>
        {props.label}
      </text>,
    );
  }

  headerRows.push(1);
  headerChildren.push(
    <text key="title" style={{ color: theme.surface.text }}>
      {props.title}
    </text>,
  );

  if (props.description !== undefined) {
    headerRows.push(1);
    headerChildren.push(
      <text key="description" style={{ color: theme.surface.mutedText }}>
        {props.description}
      </text>,
    );
  }

  const rootRows: TrackShorthand[] = [headerRows.length, "1fr"];
  if (props.footer !== undefined) {
    rootRows.push(1);
  }

  return (
    <view rows={rootRows} style={{ background: theme.surface.canvas }}>
      <view rows={headerRows} style={{ background: theme.surface.panel }}>
        {headerChildren}
      </view>
      <view style={{ background: theme.surface.canvas }}>{props.children}</view>
      {props.footer === undefined ? null : (
        <text style={{ color: theme.surface.mutedText }}>{props.footer}</text>
      )}
    </view>
  );
}
