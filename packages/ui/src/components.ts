import {
  Children,
  createContext,
  createElement,
  useContext,
  type Key,
  type ReactNode,
} from "react";

import {
  type BoxSpec,
  type BorderInput,
  type EventHandlers,
  type InsetsInput,
  type Palette,
  type ScrollAxis,
  type Style,
  type TextSpec,
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
  readonly styleFocus?: Style;
  readonly styleHover?: Style;
  readonly accessibleLabel?: string;
}

export interface BoxProps extends CommonProps {
  readonly children?: ReactNode;
  readonly padding?: InsetsInput;
  readonly border?: BorderInput;
  readonly title?: string;
  readonly alignX?: BoxSpec["alignX"];
  readonly alignY?: BoxSpec["alignY"];
  readonly focusable?: boolean;
  readonly disabled?: boolean;
}

export interface RowProps extends BoxProps {
  readonly tracks?: readonly Track[];
  readonly gap?: number;
}

export type ColumnProps = RowProps;

export type TextContent =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly TextContent[];

export interface TextProps extends CommonProps {
  readonly children?: TextContent;
  readonly overflow?: TextOverflow;
  readonly alignX?: TextSpec["alignX"];
  readonly alignY?: TextSpec["alignY"];
}

export interface FillProps extends Omit<TextProps, "children" | "overflow"> {
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
  readonly hotkey?: string;
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

export function Row({ children, tracks, gap, ...props }: RowProps): ReactNode {
  return hostBox(
    { ...props, axis: "row", ...(tracks === undefined ? {} : { tracks }), ...(gap === undefined ? {} : { gap }) },
    children,
    useContext(PaletteContext),
  );
}

export function Column({
  children,
  tracks,
  gap,
  ...props
}: ColumnProps): ReactNode {
  return hostBox(
    { ...props, axis: "column", ...(tracks === undefined ? {} : { tracks }), ...(gap === undefined ? {} : { gap }) },
    children,
    useContext(PaletteContext),
  );
}

export function Text({ children, ...props }: TextProps): ReactNode {
  return createElement(
    INTERNAL_TEXT_TYPE,
    { ...props, palette: useContext(PaletteContext) },
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
  hotkey,
  tone = "neutral",
  selected = false,
  disabled = false,
  onPress,
  padding = { x: 1 },
  style,
  styleHover,
  styleFocus,
  accessibleLabel,
  ...props
}: ButtonProps): ReactNode {
  const visible = children ?? label ?? "";
  const text = hotkey === undefined
    ? visible
    : createElement(Row, { tracks: ["1fr", "auto"], gap: 1 },
        createElement(Text, { overflow: "ellipsis-end" }, visible),
        createElement(Text, { style: { foreground: "muted" } }, hotkey),
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
      styleHover: disabled
        ? { ...base, ...styleHover }
        : { background: "selection", ...styleHover },
      styleFocus: { background: "focus", ...styleFocus },
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
