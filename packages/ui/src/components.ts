import {
  Children,
  createContext,
  createElement,
  useContext,
  type Key,
  type ReactNode,
} from "react";

import {
  type Align,
  type BorderInput,
  type EventHandlers,
  type InsetsInput,
  type LayoutEngine,
  type Palette,
  type ScrollAxis,
  type Style,
  type Track,
} from "./internal/model.js";
import { defaultPalette, mergePalette } from "./internal/palette.js";
import {
  cellizeLine,
  type TextOverflow,
} from "./internal/unicode.js";

export const INTERNAL_BOX_TYPE = "faux-box";
export const INTERNAL_TEXT_TYPE = "faux-text";

const PaletteContext = createContext<Palette>(defaultPalette);

interface CommonProps extends EventHandlers {
  readonly key?: Key | null;
  readonly style?: Style;
  readonly focusStyle?: Style;
  readonly hoverStyle?: Style;
  readonly accessibleLabel?: string;
}

export interface BoxProps extends CommonProps {
  readonly children?: ReactNode;
  readonly padding?: InsetsInput;
  readonly border?: BorderInput;
  readonly title?: string;
  readonly focusable?: boolean;
  readonly disabled?: boolean;
}

export interface LayoutProps extends BoxProps {
  readonly layout: LayoutEngine;
}

export interface ColumnsProps extends BoxProps {
  /** Width allocation for each child column. */
  readonly tracks?: readonly Track[];
  readonly gap?: number;
}

export interface RowsProps extends BoxProps {
  /** Height allocation for each child row. */
  readonly tracks?: readonly Track[];
  readonly gap?: number;
}

export type TextContent =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly TextContent[];

export interface TextAlign {
  readonly x?: Align;
  readonly y?: Align;
}

export interface TextProps extends CommonProps {
  readonly children?: TextContent;
  readonly overflow?: TextOverflow;
  readonly align?: TextAlign;
}

export interface FillProps
  extends Omit<TextProps, "children" | "overflow" | "align"> {
  readonly glyph?: string;
}

export interface DividerProps extends Omit<FillProps, "glyph"> {
  readonly orientation?: "horizontal" | "vertical";
  readonly variant?: "solid" | "dashed" | "dotted";
}

export interface ScrollViewProps extends BoxProps {
  readonly axis?: ScrollAxis;
}

export type ButtonTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger";

export interface ButtonProps
  extends Omit<BoxProps, "focusable" | "disabled" | "onPress"> {
  readonly children?: ReactNode;
  readonly label?: string;
  readonly keyHint?: string;
  readonly tone?: ButtonTone;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: EventHandlers["onPress"];
}

export interface ThemeProviderProps {
  readonly palette?: Partial<Palette>;
  readonly children?: ReactNode;
}

export function ThemeProvider({
  palette,
  children,
}: ThemeProviderProps): ReactNode {
  const parent = useContext(PaletteContext);
  const value =
    palette === undefined ? parent : mergePalette({ ...parent, ...palette });
  return createElement(PaletteContext.Provider, { value }, children);
}

export function useTheme(): Palette {
  return useContext(PaletteContext);
}

export function Box({ children, ...props }: BoxProps): ReactNode {
  return hostBox(props, children, useContext(PaletteContext));
}

/** Advanced extension point for pure renderer-neutral cell layout packages. */
export function Layout({
  children,
  layout,
  ...props
}: LayoutProps): ReactNode {
  return hostBox(
    { ...props, layout },
    children,
    useContext(PaletteContext),
  );
}

/** Places each child in one column from left to right. */
export function Columns({
  children,
  tracks,
  gap,
  ...props
}: ColumnsProps): ReactNode {
  return hostBox(
    {
      ...props,
      axis: "row",
      ...(tracks === undefined ? {} : { tracks }),
      ...(gap === undefined ? {} : { gap }),
    },
    children,
    useContext(PaletteContext),
  );
}

/** Places each child in one row from top to bottom. */
export function Rows({
  children,
  tracks,
  gap,
  ...props
}: RowsProps): ReactNode {
  return hostBox(
    {
      ...props,
      axis: "column",
      ...(tracks === undefined ? {} : { tracks }),
      ...(gap === undefined ? {} : { gap }),
    },
    children,
    useContext(PaletteContext),
  );
}

export function Text({ children, align, ...props }: TextProps): ReactNode {
  return createElement(
    INTERNAL_TEXT_TYPE,
    {
      ...props,
      ...textAlignmentProps(align),
      palette: useContext(PaletteContext),
    },
    children,
  );
}

export function Fill({ glyph = " ", ...props }: FillProps): ReactNode {
  const cells = cellizeLine(glyph);
  if (glyph.includes("\n") || cells.length !== 1) {
    throw new Error("Fill glyph must be exactly one grapheme.");
  }
  return createElement(
    INTERNAL_TEXT_TYPE,
    { ...props, fill: true, palette: useContext(PaletteContext) },
    glyph,
  );
}

function textAlignmentProps(align: TextAlign | undefined): {
  readonly alignX?: Align;
  readonly alignY?: Align;
} {
  if (align === undefined) return {};
  if (typeof align !== "object" || align === null) {
    throw new Error("Text align must be an object with x/y fields.");
  }
  return {
    ...(align.x === undefined ? {} : { alignX: align.x }),
    ...(align.y === undefined ? {} : { alignY: align.y }),
  };
}

export function Divider({
  orientation = "horizontal",
  variant = "solid",
  style,
  ...props
}: DividerProps): ReactNode {
  const glyph = dividerGlyph(orientation, variant);
  return createElement(Fill, {
    ...props,
    glyph,
    style: { foreground: "border", ...style },
  });
}

export function ScrollView({
  axis = "y",
  children,
  ...props
}: ScrollViewProps): ReactNode {
  if (Children.count(children) > 1) {
    throw new Error("ScrollView accepts exactly one semantic child.");
  }
  return hostBox(
    { ...props, scroll: axis },
    children,
    useContext(PaletteContext),
  );
}

export function Button({
  children,
  label,
  keyHint,
  tone = "neutral",
  selected = false,
  disabled = false,
  onPress,
  padding = { x: 1 },
  style,
  hoverStyle,
  focusStyle,
  accessibleLabel,
  ...props
}: ButtonProps): ReactNode {
  const visible = children ?? label ?? "";
  const text = keyHint === undefined
    ? visible
    : createElement(
        Columns,
        { tracks: ["1fr", "auto"], gap: 1 },
        createElement(Text, { overflow: "ellipsis-end" }, visible),
        createElement(Text, { style: { foreground: "muted" } }, keyHint),
      );
  const base = buttonStyle(tone, selected, disabled);
  return hostBox(
    {
      ...props,
      padding,
      focusable: !disabled && onPress !== undefined,
      disabled,
      accessibleLabel: accessibleLabel ?? label ?? plainText(children),
      style: { ...base, ...style },
      hoverStyle: disabled
        ? { ...base, ...hoverStyle }
        : { background: "selection", ...hoverStyle },
      focusStyle: { background: "focus", ...focusStyle },
      ...(disabled || onPress === undefined ? {} : { onPress }),
    },
    typeof text === "string" || typeof text === "number"
      ? createElement(Text, { overflow: "ellipsis-end" }, text)
      : text,
    useContext(PaletteContext),
  );
}

function hostBox(
  props: object,
  children: ReactNode,
  palette: Palette,
): ReactNode {
  return createElement(INTERNAL_BOX_TYPE, { ...props, palette }, children);
}

function buttonStyle(
  tone: ButtonTone,
  selected: boolean,
  disabled: boolean,
): Style {
  if (disabled) {
    return { foreground: "muted", background: "panel", dim: true };
  }
  if (selected) {
    return { foreground: "fg", background: "selection", bold: true };
  }
  if (tone === "neutral") {
    return { foreground: "fg", background: "panel" };
  }
  return {
    foreground: tone === "warning" ? "inverse" : "inverse",
    background: tone === "primary" ? "accent" : tone,
    bold: true,
  };
}

function dividerGlyph(
  orientation: "horizontal" | "vertical",
  variant: "solid" | "dashed" | "dotted",
): string {
  if (orientation === "vertical") {
    if (variant === "dashed") return "┆";
    if (variant === "dotted") return "┊";
    return "│";
  }
  if (variant === "dashed") return "╌";
  if (variant === "dotted") return "┈";
  return "─";
}

function plainText(value: ReactNode): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return undefined;
}

export { defaultPalette, mergePalette };
