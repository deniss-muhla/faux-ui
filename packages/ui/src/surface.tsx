import type {
  ScrollAxis,
  SemanticColor,
  TrackPlacement,
  TrackShorthand,
} from "@faux-ui/core";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { UINodeHandle } from "@faux-ui/reconciler";

import type { UiViewMetrics } from "./runtime-bridge.js";
import { useUiRuntimeBridge, useUiViewMetrics } from "./runtime-bridge.js";

export interface UiSurfaceTheme {
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

export interface UiActionTheme {
  restBackground: SemanticColor;
  restText: SemanticColor;
  hoverBackground: SemanticColor;
  hoverText: SemanticColor;
  focusBackground: SemanticColor;
  focusText: SemanticColor;
  disabledBackground: SemanticColor;
  disabledText: SemanticColor;
}

export interface UiTheme {
  surface: UiSurfaceTheme;
  action: UiActionTheme;
}

export interface PartialUiTheme {
  surface?: Partial<UiSurfaceTheme>;
  action?: Partial<UiActionTheme>;
}

interface PlacementProps {
  row?: TrackPlacement | null;
  column?: TrackPlacement | null;
}

export interface AppShellProps extends PlacementProps {
  label?: string;
  title: string;
  description?: string;
  footer?: string;
  children?: ReactNode;
  theme?: PartialUiTheme;
}

export type ButtonTone = "neutral" | "accent" | "selected";

export interface ButtonProps extends PlacementProps {
  label?: string;
  title: string;
  description?: string;
  footer?: string;
  variant?: ButtonTone;
  disabled?: boolean;
  theme?: PartialUiTheme;
  onPress?: () => void;
}

export type PanelTone = "neutral" | "accent" | "selected";
export type DividerVariant = "single" | "double" | "dotted" | "heavy";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  variant?: DividerVariant;
  theme?: PartialUiTheme;
  color?: SemanticColor;
}

export interface PanelProps extends PlacementProps {
  label?: string;
  title: string;
  description?: string;
  footer?: string;
  variant?: PanelTone;
  theme?: PartialUiTheme;
  onPress?: () => void;
  children?: ReactNode;
  scroll?: ScrollAxis | null;
  divider?: DividerVariant;
}

export const defaultUiTheme: UiTheme = {
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
    hoverBackground: "focus",
    hoverText: "inverse",
    focusBackground: "accent",
    focusText: "inverse",
    disabledBackground: "bgAlt",
    disabledText: "muted",
  },
};

const HORIZONTAL_FILL_LENGTH = 512;
const VERTICAL_FILL_LENGTH = 256;

export function mergeUiTheme(overrides: PartialUiTheme = {}): UiTheme {
  return {
    surface: {
      ...defaultUiTheme.surface,
      ...overrides.surface,
    },
    action: {
      ...defaultUiTheme.action,
      ...overrides.action,
    },
  };
}

export function AppShell(props: AppShellProps): ReactNode {
  const theme = mergeUiTheme(props.theme);
  const placementProps = createPlacementProps(props);
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
    <view
      rows={rootRows}
      style={{ background: theme.surface.canvas }}
      {...placementProps}
    >
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

export function Button(props: ButtonProps): ReactNode {
  const theme = mergeUiTheme(props.theme);
  const placementProps = createPlacementProps(props);
  const variant = props.variant ?? "neutral";
  const rows = createRows(props);
  const interactive = props.disabled !== true && props.onPress !== undefined;

  const background = props.disabled
    ? theme.action.disabledBackground
    : variant === "accent"
      ? theme.surface.accent
      : variant === "selected"
        ? theme.surface.selection
        : theme.action.restBackground;

  const titleColor = props.disabled
    ? theme.action.disabledText
    : variant === "accent"
      ? theme.surface.inverseText
      : theme.surface.text;

  const detailColor = props.disabled
    ? theme.action.disabledText
    : variant === "accent"
      ? theme.surface.inverseText
      : theme.surface.mutedText;

  const metaColor = props.disabled
    ? theme.action.disabledText
    : variant === "accent"
      ? theme.surface.inverseText
      : theme.surface.signal;

  const interactionProps = interactive
    ? {
        onClick: () => props.onPress?.(),
        onPress: () => props.onPress?.(),
        styleHover: {
          background: theme.action.hoverBackground,
          color: theme.action.hoverText,
        },
        styleFocus: {
          background: theme.action.focusBackground,
          color: theme.action.focusText,
        },
      }
    : {};

  return (
    <view
      rows={rows}
      focusable={interactive}
      style={{ background, color: titleColor }}
      {...placementProps}
      {...interactionProps}
    >
      {props.label === undefined ? null : (
        <text style={{ color: metaColor }}>{props.label}</text>
      )}
      <text style={{ color: titleColor }}>{props.title}</text>
      {props.description === undefined ? null : (
        <text style={{ color: detailColor }}>{props.description}</text>
      )}
      {props.footer === undefined ? null : (
        <text style={{ color: metaColor }}>{props.footer}</text>
      )}
    </view>
  );
}

export function Divider(props: DividerProps): ReactNode {
  const theme = mergeUiTheme(props.theme);
  const orientation = props.orientation ?? "horizontal";
  const variant = props.variant ?? "single";
  const color = props.color ?? theme.surface.border;
  const characters = resolveDividerCharacters(variant);

  if (orientation === "horizontal") {
    return (
      <view rows={[1]} style={{ color }}>
        <text>{characters.horizontal.repeat(HORIZONTAL_FILL_LENGTH)}</text>
      </view>
    );
  }

  return (
    <view rows={createUnitTracks(VERTICAL_FILL_LENGTH)} style={{ color }}>
      {Array.from({ length: VERTICAL_FILL_LENGTH }, (_, index) => (
        <text key={`divider-${index}`}>{characters.vertical}</text>
      ))}
    </view>
  );
}

export function Panel(props: PanelProps): ReactNode {
  const theme = mergeUiTheme(props.theme);
  const placementProps = createPlacementProps(props);
  const tone = props.variant ?? "neutral";
  const divider = props.divider ?? "single";
  const rows = createRows(props);
  const interactive = props.children === undefined && props.onPress !== undefined;

  const background =
    tone === "accent"
      ? theme.surface.accent
      : tone === "selected"
        ? theme.surface.selection
        : theme.surface.panel;

  const titleColor =
    tone === "accent" ? theme.surface.inverseText : theme.surface.text;

  const detailColor =
    tone === "accent" ? theme.surface.inverseText : theme.surface.mutedText;

  const metaColor =
    tone === "neutral" ? theme.surface.signal : theme.surface.inverseText;

  const interactionProps = interactive
    ? {
        onClick: () => props.onPress?.(),
        onPress: () => props.onPress?.(),
        styleHover: {
          background: theme.surface.focus,
          color: theme.surface.inverseText,
        },
        styleFocus: {
          background: theme.action.focusBackground,
          color: theme.action.focusText,
        },
      }
    : {};

  if (props.children === undefined) {
    return (
      <view
        rows={rows}
        focusable={interactive}
        style={{ background, color: titleColor }}
        {...placementProps}
        {...interactionProps}
      >
        {props.label === undefined ? null : (
          <text style={{ color: metaColor }}>{props.label}</text>
        )}
        <text style={{ color: titleColor }}>{props.title}</text>
        {props.description === undefined ? null : (
          <text style={{ color: detailColor }}>{props.description}</text>
        )}
        {props.footer === undefined ? null : (
          <text style={{ color: metaColor }}>{props.footer}</text>
        )}
      </view>
    );
  }

  const headerRows: TrackShorthand[] = [];
  const headerChildren: ReactNode[] = [];

  if (props.label !== undefined) {
    headerRows.push(1);
    headerChildren.push(
      <text key="label" style={{ color: metaColor }}>
        {props.label}
      </text>,
    );
  }

  headerRows.push(1);
  headerChildren.push(
    <text key="title" style={{ color: titleColor }}>
      {props.title}
    </text>,
  );

  if (props.description !== undefined) {
    headerRows.push(1);
    headerChildren.push(
      <text key="description" style={{ color: detailColor }}>
        {props.description}
      </text>,
    );
  }

  const rootRows: TrackShorthand[] = [headerRows.length, 1];
  rootRows.push(props.scroll === undefined || props.scroll === null ? "auto" : "1fr");

  if (props.footer !== undefined) {
    rootRows.push(1, 1);
  }

  return (
    <view
      rows={rootRows}
      style={{ background, color: titleColor }}
      {...placementProps}
    >
      <view rows={headerRows} style={{ background }}>
        {headerChildren}
      </view>
      <Divider
        variant={divider}
        color={theme.surface.border}
        {...(props.theme === undefined ? {} : { theme: props.theme })}
      />
      <PanelBody
        background={background}
        borderColor={theme.surface.border}
        divider={divider}
        scroll={props.scroll ?? null}
      >
        {props.children}
      </PanelBody>
      {props.footer === undefined ? null : (
        <>
          <Divider
            variant={divider}
            color={theme.surface.border}
            {...(props.theme === undefined ? {} : { theme: props.theme })}
          />
          <text style={{ color: metaColor }}>{props.footer}</text>
        </>
      )}
    </view>
  );
}

interface PanelBodyProps {
  background: SemanticColor;
  borderColor: SemanticColor;
  divider: DividerVariant;
  scroll: ScrollAxis | null;
  children?: ReactNode;
}

function PanelBody(props: PanelBodyProps): ReactNode {
  const bridge = useUiRuntimeBridge();
  const bodyRef = useRef<UINodeHandle | null>(null);
  const metrics = useUiViewMetrics(bodyRef);

  if (props.scroll === null) {
    return <view style={{ background: props.background }}>{props.children}</view>;
  }

  const showHorizontal =
    (props.scroll === "x" || props.scroll === "both") &&
    metrics?.overflow.x === true;
  const showVertical =
    (props.scroll === "y" || props.scroll === "both") &&
    metrics?.overflow.y === true;

  const rows: TrackShorthand[] = showHorizontal ? ["1fr", 1] : ["1fr"];
  const columns: TrackShorthand[] = showVertical ? ["1fr", 1] : ["1fr"];

  const updateAxisOffset = (axis: "x" | "y", nextValue: number) => {
    const nodeId = bodyRef.current?.id;
    if (bridge === null || nodeId === undefined || metrics === null) {
      return;
    }

    bridge.setScrollOffset(nodeId, {
      x:
        axis === "x"
          ? clampAxis(nextValue, metrics.maxOffset.x)
          : metrics.offset.x,
      y:
        axis === "y"
          ? clampAxis(nextValue, metrics.maxOffset.y)
          : metrics.offset.y,
    });
  };

  const jumpAxis = (axis: "x" | "y", index: number, trackLength: number) => {
    if (metrics === null) {
      return;
    }

    const maxOffset = axis === "x" ? metrics.maxOffset.x : metrics.maxOffset.y;
    const ratio = trackLength <= 1 ? 0 : index / (trackLength - 1);
    updateAxisOffset(axis, Math.round(maxOffset * ratio));
  };

  return (
    <view rows={rows} columns={columns} style={{ background: props.background }}>
      <view ref={bodyRef} scroll={props.scroll} style={{ background: props.background }}>
        {props.children}
      </view>
      {showVertical && metrics !== null ? (
        <ScrollBar
          axis="y"
          background={props.background}
          borderColor={props.borderColor}
          metrics={metrics}
          variant={props.divider}
          onJump={(index, trackLength) => jumpAxis("y", index, trackLength)}
          onStep={(delta) => updateAxisOffset("y", metrics.offset.y + delta)}
        />
      ) : null}
      {showHorizontal && metrics !== null ? (
        <ScrollBar
          axis="x"
          background={props.background}
          borderColor={props.borderColor}
          metrics={metrics}
          variant={props.divider}
          onJump={(index, trackLength) => jumpAxis("x", index, trackLength)}
          onStep={(delta) => updateAxisOffset("x", metrics.offset.x + delta)}
        />
      ) : null}
      {showHorizontal && showVertical ? (
        <text style={{ color: props.borderColor }}>
          {resolveDividerCorner(props.divider)}
        </text>
      ) : null}
    </view>
  );
}

interface ScrollBarProps {
  axis: "x" | "y";
  background: SemanticColor;
  borderColor: SemanticColor;
  metrics: UiViewMetrics;
  variant: DividerVariant;
  onJump(index: number, trackLength: number): void;
  onStep(delta: number): void;
}

function ScrollBar(props: ScrollBarProps): ReactNode {
  const extent =
    props.axis === "x" ? props.metrics.viewport.width : props.metrics.viewport.height;
  if (extent <= 0) {
    return null;
  }

  const withButtons = extent >= 3;
  const trackLength = Math.max(1, extent - (withButtons ? 2 : 0));
  const characters = resolveDividerCharacters(props.variant);
  const trackCharacter =
    props.axis === "x" ? characters.horizontal : characters.vertical;
  const currentOffset =
    props.axis === "x" ? props.metrics.offset.x : props.metrics.offset.y;
  const maxOffset =
    props.axis === "x" ? props.metrics.maxOffset.x : props.metrics.maxOffset.y;
  const thumbIndex =
    trackLength <= 1 || maxOffset === 0
      ? 0
      : Math.round((currentOffset / maxOffset) * (trackLength - 1));
  const tracks = createUnitTracks(trackLength + (withButtons ? 2 : 0));
  const children: ReactNode[] = [];

  if (withButtons) {
    children.push(
      <text key={`${props.axis}-back`} onClick={() => props.onStep(-1)}>
        {props.axis === "x" ? "<" : "^"}
      </text>,
    );
  }

  for (let index = 0; index < trackLength; index += 1) {
    children.push(
      <text
        key={`${props.axis}-track-${index}`}
        onClick={() => props.onJump(index, trackLength)}
      >
        {index === thumbIndex ? "#" : trackCharacter}
      </text>,
    );
  }

  if (withButtons) {
    children.push(
      <text key={`${props.axis}-forward`} onClick={() => props.onStep(1)}>
        {props.axis === "x" ? ">" : "v"}
      </text>,
    );
  }

  if (props.axis === "x") {
    return (
      <view columns={tracks} style={{ background: props.background, color: props.borderColor }}>
        {children}
      </view>
    );
  }

  return (
    <view rows={tracks} style={{ background: props.background, color: props.borderColor }}>
      {children}
    </view>
  );
}

function createRows(props: {
  label?: string;
  description?: string;
  footer?: string;
}): TrackShorthand[] {
  const rows: TrackShorthand[] = [];

  if (props.label !== undefined) {
    rows.push(1);
  }

  rows.push(1);

  if (props.description !== undefined) {
    rows.push(1);
  }

  if (props.footer !== undefined) {
    rows.push(1);
  }

  return rows;
}

function createUnitTracks(count: number): TrackShorthand[] {
  return Array.from({ length: count }, () => 1);
}

function resolveDividerCharacters(variant: DividerVariant): {
  horizontal: string;
  vertical: string;
} {
  switch (variant) {
    case "double":
      return { horizontal: "\u2550", vertical: "\u2551" };
    case "dotted":
      return { horizontal: "\u2508", vertical: "\u250a" };
    case "heavy":
      return { horizontal: "\u2501", vertical: "\u2503" };
    default:
      return { horizontal: "\u2500", vertical: "\u2502" };
  }
}

function resolveDividerCorner(variant: DividerVariant): string {
  switch (variant) {
    case "double":
      return "\u256c";
    case "heavy":
      return "\u254b";
    default:
      return "+";
  }
}

function clampAxis(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function createPlacementProps(props: PlacementProps): {
  row?: TrackPlacement | null;
  column?: TrackPlacement | null;
} {
  return {
    ...(props.row === undefined ? {} : { row: props.row }),
    ...(props.column === undefined ? {} : { column: props.column }),
  };
}

export { View, Text, VIEW_TYPE, TEXT_TYPE } from "@faux-ui/reconciler";
export type {
  TextProps,
  UINodeHandle,
  ViewProps,
} from "@faux-ui/reconciler";
export {
  UiRuntimeProvider,
  createUiRuntimeBridge,
  useUiRuntimeBridge,
  useUiViewMetrics,
} from "./runtime-bridge.js";
export type {
  UiRuntimeAdapter,
  UiRuntimeBridge,
  UiViewMetrics,
} from "./runtime-bridge.js";
