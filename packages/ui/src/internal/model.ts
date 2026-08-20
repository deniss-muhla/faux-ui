import type { TextOverflow } from "./unicode.js";

export type NodeId = number;
export type Axis = "row" | "column";
export type ScrollAxis = "x" | "y" | "both";
export type Align = "start" | "center" | "end";
export type Track = number | "auto" | `${number}fr`;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point, Size {}

/** Renderer-neutral input for an advanced custom layout algorithm. */
export interface LayoutInput {
  readonly size: Size;
  readonly children: readonly Size[];
}

/** Child frames are local to the custom layout's content frame. */
export interface LayoutOutput {
  readonly children: readonly Rect[];
  readonly contentSize?: Size;
}

/**
 * Advanced public extension contract used by independently packaged layout
 * components. Implementations must be pure and return integer cell geometry.
 */
export interface LayoutEngine {
  preferred(children: readonly Size[]): Size;
  layout(input: LayoutInput): LayoutOutput;
}

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export type InsetsInput =
  | number
  | {
      readonly x?: number;
      readonly y?: number;
      readonly top?: number;
      readonly right?: number;
      readonly bottom?: number;
      readonly left?: number;
    };

export type SemanticColor =
  | "fg"
  | "muted"
  | "inverse"
  | "bg"
  | "panel"
  | "selection"
  | "focus"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "border";

export type Palette = Readonly<Record<SemanticColor, string>>;

export interface Style {
  readonly foreground?: SemanticColor;
  readonly background?: SemanticColor;
  readonly bold?: boolean;
  readonly dim?: boolean;
  readonly inverse?: boolean;
  readonly underline?: boolean;
}

export type BorderKind = "single" | "double" | "rounded";

export interface Border {
  readonly kind: BorderKind;
  readonly foreground?: SemanticColor;
}

export type BorderInput = boolean | BorderKind | Border;

export interface KeyInput {
  readonly key: string;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
  readonly repeat?: boolean;
}

export interface PointerInput extends Point {
  readonly button?: number;
  readonly buttons?: number;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
}

export interface ScrollInput extends Point {
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface UiEventTarget {
  readonly kind: "box" | "text";
  readonly accessibleLabel: string | null;
}

export interface UiEvent<TType extends string = string> {
  readonly type: TType;
  readonly target: UiEventTarget;
  readonly currentTarget: UiEventTarget;
  readonly defaultPrevented: boolean;
  readonly propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface FocusUiEvent extends UiEvent<"focus" | "blur"> {
  readonly relatedTarget: UiEventTarget | null;
}

export interface KeyUiEvent extends UiEvent<"keyDown" | "keyUp">, KeyInput {}

export interface PointerUiEvent
  extends UiEvent<
      | "pointerDown"
      | "pointerUp"
      | "pointerMove"
      | "pointerEnter"
      | "pointerLeave"
    >,
    PointerInput {}

export interface PressUiEvent extends UiEvent<"press"> {
  readonly source: "keyboard" | "pointer";
}

export interface ScrollUiEvent extends UiEvent<"scroll"> {
  readonly offset: Point;
  readonly previousOffset: Point;
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface EventHandlers {
  readonly onFocus?: (event: FocusUiEvent) => void;
  readonly onBlur?: (event: FocusUiEvent) => void;
  readonly onKeyDown?: (event: KeyUiEvent) => void;
  readonly onKeyUp?: (event: KeyUiEvent) => void;
  readonly onPress?: (event: PressUiEvent) => void;
  readonly onPointerDown?: (event: PointerUiEvent) => void;
  readonly onPointerUp?: (event: PointerUiEvent) => void;
  readonly onPointerMove?: (event: PointerUiEvent) => void;
  readonly onPointerEnter?: (event: PointerUiEvent) => void;
  readonly onPointerLeave?: (event: PointerUiEvent) => void;
  readonly onScroll?: (event: ScrollUiEvent) => void;
}

interface SemanticNodeBase {
  readonly id: NodeId;
  parent: BoxNode | null;
  style: Style;
  focusStyle: Style;
  hoverStyle: Style;
  handlers: EventHandlers;
  accessibleLabel: string | null;
  palette: Palette | null;
}

export interface TextNode extends SemanticNodeBase {
  readonly kind: "text";
  text: string;
  overflow: TextOverflow;
  alignX: Align;
  alignY: Align;
  fill: boolean;
}

export interface BoxNode extends SemanticNodeBase {
  readonly kind: "box";
  children: SemanticNode[];
  axis: Axis | null;
  tracks: Track[] | null;
  gap: number;
  layout: LayoutEngine | null;
  padding: Insets;
  border: Border | null;
  title: string | null;
  scroll: ScrollAxis | null;
  followEnd: boolean;
  focusable: boolean;
  disabled: boolean;
}

export type SemanticNode = TextNode | BoxNode;

export interface TextSpec extends EventHandlers {
  readonly text?: string;
  readonly overflow?: TextOverflow;
  readonly alignX?: Align;
  readonly alignY?: Align;
  readonly style?: Style;
  readonly focusStyle?: Style;
  readonly hoverStyle?: Style;
  readonly fill?: boolean;
  readonly accessibleLabel?: string;
  /** Internal value populated by ThemeProvider-aware public components. */
  readonly palette?: Palette;
}

export interface BoxSpec extends EventHandlers {
  readonly axis?: Axis | null;
  readonly tracks?: readonly Track[];
  readonly gap?: number;
  readonly layout?: LayoutEngine;
  readonly padding?: InsetsInput;
  readonly border?: BorderInput;
  readonly title?: string;
  readonly style?: Style;
  readonly focusStyle?: Style;
  readonly hoverStyle?: Style;
  readonly scroll?: ScrollAxis;
  readonly followEnd?: boolean;
  readonly focusable?: boolean;
  readonly disabled?: boolean;
  readonly accessibleLabel?: string;
  /** Internal value populated by ThemeProvider-aware public components. */
  readonly palette?: Palette;
}

const EMPTY_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function createTextNode(id: NodeId, spec: TextSpec = {}): TextNode {
  return {
    id,
    kind: "text",
    parent: null,
    text: spec.text ?? "",
    overflow: normalizeOverflow(spec.overflow),
    alignX: normalizeAlign(spec.alignX),
    alignY: normalizeAlign(spec.alignY),
    style: normalizeStyle(spec.style),
    focusStyle: normalizeStyle(spec.focusStyle),
    hoverStyle: normalizeStyle(spec.hoverStyle),
    handlers: readHandlers(spec),
    fill: spec.fill === true,
    accessibleLabel: normalizeLabel(spec.accessibleLabel),
    palette: normalizePalette(spec.palette),
  };
}

export function createBoxNode(id: NodeId, spec: BoxSpec = {}): BoxNode {
  return {
    id,
    kind: "box",
    parent: null,
    children: [],
    axis: normalizeAxis(spec.axis),
    tracks: normalizeTracks(spec.tracks),
    gap: normalizeInteger(spec.gap ?? 0, "gap"),
    layout: normalizeLayout(spec.layout),
    padding: normalizeInsets(spec.padding),
    border: normalizeBorder(spec.border),
    title: normalizeLabel(spec.title),
    style: normalizeStyle(spec.style),
    focusStyle: normalizeStyle(spec.focusStyle),
    hoverStyle: normalizeStyle(spec.hoverStyle),
    handlers: readHandlers(spec),
    scroll: normalizeScroll(spec.scroll),
    followEnd: spec.followEnd === true,
    focusable: spec.focusable === true,
    disabled: spec.disabled === true,
    accessibleLabel: normalizeLabel(spec.accessibleLabel),
    palette: normalizePalette(spec.palette),
  };
}

export function updateTextNode(node: TextNode, spec: TextSpec): void {
  node.text = spec.text ?? "";
  node.overflow = normalizeOverflow(spec.overflow);
  node.alignX = normalizeAlign(spec.alignX);
  node.alignY = normalizeAlign(spec.alignY);
  node.style = normalizeStyle(spec.style);
  node.focusStyle = normalizeStyle(spec.focusStyle);
  node.hoverStyle = normalizeStyle(spec.hoverStyle);
  node.handlers = readHandlers(spec);
  node.fill = spec.fill === true;
  node.accessibleLabel = normalizeLabel(spec.accessibleLabel);
  node.palette = normalizePalette(spec.palette);
}

export function updateBoxNode(node: BoxNode, spec: BoxSpec): void {
  node.axis = normalizeAxis(spec.axis);
  node.tracks = normalizeTracks(spec.tracks);
  node.gap = normalizeInteger(spec.gap ?? 0, "gap");
  node.layout = normalizeLayout(spec.layout);
  node.padding = normalizeInsets(spec.padding);
  node.border = normalizeBorder(spec.border);
  node.title = normalizeLabel(spec.title);
  node.style = normalizeStyle(spec.style);
  node.focusStyle = normalizeStyle(spec.focusStyle);
  node.hoverStyle = normalizeStyle(spec.hoverStyle);
  node.handlers = readHandlers(spec);
  node.scroll = normalizeScroll(spec.scroll);
  node.followEnd = spec.followEnd === true;
  node.focusable = spec.focusable === true;
  node.disabled = spec.disabled === true;
  node.accessibleLabel = normalizeLabel(spec.accessibleLabel);
  node.palette = normalizePalette(spec.palette);
}

export function replaceChildren(
  parent: BoxNode,
  children: readonly SemanticNode[],
): void {
  for (const child of parent.children) {
    if (child.parent === parent) child.parent = null;
  }
  parent.children = [...children];
  for (const child of parent.children) child.parent = parent;
}

export function walkTree(root: SemanticNode): SemanticNode[] {
  const result: SemanticNode[] = [];
  const visit = (node: SemanticNode): void => {
    result.push(node);
    if (node.kind === "box") node.children.forEach(visit);
  };
  visit(root);
  return result;
}

export function findNode(root: SemanticNode, id: NodeId): SemanticNode | null {
  if (root.id === id) return root;
  if (root.kind === "text") return null;
  for (const child of root.children) {
    const match = findNode(child, id);
    if (match !== null) return match;
  }
  return null;
}

export function nodePath(node: SemanticNode): SemanticNode[] {
  const result: SemanticNode[] = [];
  let current: SemanticNode | null = node;
  while (current !== null) {
    result.push(current);
    current = current.parent;
  }
  return result;
}

export function normalizeSize(size: Size): Size {
  return {
    width: normalizeInteger(size.width, "width"),
    height: normalizeInteger(size.height, "height"),
  };
}

export function normalizePoint(point: Point): Point {
  return {
    x: normalizeInteger(point.x, "x"),
    y: normalizeInteger(point.y, "y"),
  };
}

export function normalizeInsets(input: InsetsInput | undefined): Insets {
  if (input === undefined) return EMPTY_INSETS;
  if (typeof input === "number") {
    const value = normalizeInteger(input, "padding");
    return { top: value, right: value, bottom: value, left: value };
  }

  const x = normalizeInteger(input.x ?? 0, "padding.x");
  const y = normalizeInteger(input.y ?? 0, "padding.y");
  return {
    top: normalizeInteger(input.top ?? y, "padding.top"),
    right: normalizeInteger(input.right ?? x, "padding.right"),
    bottom: normalizeInteger(input.bottom ?? y, "padding.bottom"),
    left: normalizeInteger(input.left ?? x, "padding.left"),
  };
}

export function normalizeInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative integer.`);
  }
  return value;
}

export function hasScrollAxis(
  scroll: ScrollAxis | null,
  axis: "x" | "y",
): boolean {
  return scroll === axis || scroll === "both";
}

function normalizeAxis(value: Axis | null | undefined): Axis | null {
  if (value === undefined || value === null) return null;
  if (value === "row" || value === "column") return value;
  throw new Error(`Unsupported layout axis: ${String(value)}.`);
}

function normalizeTracks(value: readonly Track[] | undefined): Track[] | null {
  if (value === undefined) return null;
  return value.map((track, index) => normalizeTrack(track, index));
}

function normalizeTrack(track: Track, index: number): Track {
  if (typeof track === "number") {
    return normalizeInteger(track, `tracks[${index}]`);
  }
  if (track === "auto") return track;
  const match = /^(?:([1-9]\d*(?:\.\d+)?)|(0?\.\d+))fr$/u.exec(track);
  if (match === null) {
    throw new Error(
      `tracks[${index}] must be a non-negative integer, "auto", or a positive fraction.`,
    );
  }
  const weight = Number.parseFloat(track.slice(0, -2));
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`tracks[${index}] must have a positive fraction weight.`);
  }
  return `${weight}fr`;
}

function normalizeLayout(value: LayoutEngine | undefined): LayoutEngine | null {
  if (value === undefined) return null;
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.preferred !== "function" ||
    typeof value.layout !== "function"
  ) {
    throw new Error("layout must provide preferred() and layout() functions.");
  }
  return value;
}

function normalizeBorder(value: BorderInput | undefined): Border | null {
  if (value === undefined || value === false) return null;
  if (value === true) return { kind: "single" };
  if (typeof value === "string") return { kind: value };
  return {
    kind: value.kind,
    ...(value.foreground === undefined
      ? {}
      : { foreground: value.foreground }),
  };
}

function normalizeScroll(value: ScrollAxis | undefined): ScrollAxis | null {
  if (value === undefined) return null;
  if (value === "x" || value === "y" || value === "both") return value;
  throw new Error(`Unsupported scroll axis: ${String(value)}.`);
}

function normalizeAlign(value: Align | undefined): Align {
  if (value === undefined) return "start";
  if (value === "start" || value === "center" || value === "end") return value;
  throw new Error(`Unsupported alignment: ${String(value)}.`);
}

function normalizeOverflow(value: TextOverflow | undefined): TextOverflow {
  if (value === undefined) return "clip";
  if (
    value === "clip" ||
    value === "ellipsis-start" ||
    value === "ellipsis-middle" ||
    value === "ellipsis-end"
  ) {
    return value;
  }
  throw new Error(`Unsupported text overflow: ${String(value)}.`);
}

function normalizeStyle(value: Style | undefined): Style {
  return value === undefined ? {} : { ...value };
}

function normalizeLabel(value: string | undefined): string | null {
  if (value === undefined) return null;
  const label = value.trim();
  return label === "" ? null : label;
}

function normalizePalette(value: Palette | undefined): Palette | null {
  return value === undefined ? null : { ...value };
}

function readHandlers(value: EventHandlers): EventHandlers {
  return {
    ...(value.onFocus === undefined ? {} : { onFocus: value.onFocus }),
    ...(value.onBlur === undefined ? {} : { onBlur: value.onBlur }),
    ...(value.onKeyDown === undefined
      ? {}
      : { onKeyDown: value.onKeyDown }),
    ...(value.onKeyUp === undefined ? {} : { onKeyUp: value.onKeyUp }),
    ...(value.onPress === undefined ? {} : { onPress: value.onPress }),
    ...(value.onPointerDown === undefined
      ? {}
      : { onPointerDown: value.onPointerDown }),
    ...(value.onPointerUp === undefined
      ? {}
      : { onPointerUp: value.onPointerUp }),
    ...(value.onPointerMove === undefined
      ? {}
      : { onPointerMove: value.onPointerMove }),
    ...(value.onPointerEnter === undefined
      ? {}
      : { onPointerEnter: value.onPointerEnter }),
    ...(value.onPointerLeave === undefined
      ? {}
      : { onPointerLeave: value.onPointerLeave }),
    ...(value.onScroll === undefined ? {} : { onScroll: value.onScroll }),
  };
}
