export type TrackSpec = number | "auto" | `${number}fr`;
export type ScrollAxis = "x" | "y" | "both";

export type SemanticColor =
  | "fg"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "bg"
  | "bgAlt"
  | "border"
  | "focus"
  | "selection"
  | "inverse";

export type StyleSpec = {
  color?: SemanticColor;
  background?: SemanticColor;
};

export type ActionBindings = {
  focus?: string;
  blur?: string;
  keyDown?: string;
  keyUp?: string;
  press?: string;
  click?: string;
  mouseDown?: string;
  mouseUp?: string;
  mouseEnter?: string;
  mouseLeave?: string;
  mouseMove?: string;
  dragStart?: string;
  drag?: string;
  dragEnd?: string;
  scroll?: string;
};

export interface BaseSpec {
  key?: string;
}

export interface ViewSpec extends BaseSpec {
  kind: "view";
  rows?: TrackSpec[];
  columns?: TrackSpec[];
  scroll?: ScrollAxis;
  style?: StyleSpec;
  styleHover?: StyleSpec;
  styleFocus?: StyleSpec;
  focusable?: boolean;
  bind?: ActionBindings;
  children?: ElementSpec[];
}

export interface TextSpec extends BaseSpec {
  kind: "text";
  text: string;
  wrap?: boolean;
  style?: StyleSpec;
}

export type ElementSpec = ViewSpec | TextSpec;

export interface DocumentSpec {
  version: 1;
  root: ElementSpec;
}

export type CompactStyleSpec = {
  c?: SemanticColor;
  b?: SemanticColor;
};

export type CompactBindings = {
  f?: string;
  b?: string;
  kd?: string;
  ku?: string;
  p?: string;
  cl?: string;
  md?: string;
  mu?: string;
  me?: string;
  ml?: string;
  mm?: string;
  ds?: string;
  dg?: string;
  de?: string;
  sc?: string;
};

export type CompactViewSpec = {
  k?: string;
  r?: TrackSpec[];
  c?: TrackSpec[];
  x?: ScrollAxis;
  s?: CompactStyleSpec;
  sh?: CompactStyleSpec;
  sf?: CompactStyleSpec;
  f?: true;
  b?: CompactBindings;
};

export type CompactTextSpec = {
  k?: string;
  w?: true;
  s?: CompactStyleSpec;
};

export type CompactNode =
  | ["V", CompactViewSpec?, CompactNode[]?]
  | ["T", string, CompactTextSpec?];

export type CompactDocument = ["FUI", 1, CompactNode];

export type { ValidationIssue, ValidationResult } from "./validation.js";
export { validateDocumentSpec } from "./validation.js";
export { decodeCompactDocument, encodeCompactDocument } from "./compact.js";
