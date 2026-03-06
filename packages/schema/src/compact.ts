import type {
  ActionBindings,
  CompactBindings,
  CompactDocument,
  CompactNode,
  CompactStyleSpec,
  CompactTextSpec,
  CompactViewSpec,
  DocumentSpec,
  ElementSpec,
  StyleSpec,
  TextSpec,
  ViewSpec,
} from "./index.js";
import {
  fail,
  isRecord,
  type ValidationIssue,
  type ValidationResult,
  validateCompactBindings,
  validateCompactStyle,
  validateDocumentSpec,
  validateTrackSpec,
} from "./validation.js";

const compactViewKeys = new Set([
  "k",
  "r",
  "c",
  "x",
  "s",
  "sh",
  "sf",
  "f",
  "b",
]);
const compactTextKeys = new Set(["k", "w", "s"]);

export function decodeCompactDocument(
  value: unknown,
): ValidationResult<DocumentSpec> {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(value) || value.length !== 3) {
    return fail([
      { path: "$", message: "Compact documents must be a three-item array." },
    ]);
  }

  if (value[0] !== "FUI") {
    issues.push({
      path: "$[0]",
      message: "Compact document header must be FUI.",
    });
  }

  if (value[1] !== 1) {
    issues.push({
      path: "$[1]",
      message: "Compact document version must be 1.",
    });
  }

  const root = decodeCompactNode(value[2], "$[2]", issues);
  if (issues.length > 0 || root === null) {
    return fail(issues);
  }

  return validateDocumentSpec({ version: 1, root });
}

export function encodeCompactDocument(document: DocumentSpec): CompactDocument {
  return ["FUI", 1, encodeCompactNode(document.root)];
}

function decodeCompactNode(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ElementSpec | null {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, message: "Compact nodes must be non-empty arrays." });
    return null;
  }

  const tag = value[0];
  if (tag === "V") {
    const props = decodeCompactViewProps(value[1], `${path}[1]`, issues);
    const children = decodeCompactChildren(value[2], `${path}[2]`, issues);
    const next: ElementSpec = {
      kind: "view",
      ...(props?.key !== undefined ? { key: props.key } : {}),
      ...(props?.rows !== undefined ? { rows: props.rows } : {}),
      ...(props?.columns !== undefined ? { columns: props.columns } : {}),
      ...(props?.scroll !== undefined ? { scroll: props.scroll } : {}),
      ...(props?.style !== undefined ? { style: props.style } : {}),
      ...(props?.styleHover !== undefined
        ? { styleHover: props.styleHover }
        : {}),
      ...(props?.styleFocus !== undefined
        ? { styleFocus: props.styleFocus }
        : {}),
      ...(props?.focusable !== undefined ? { focusable: props.focusable } : {}),
      ...(props?.bind !== undefined ? { bind: props.bind } : {}),
      ...(children !== undefined ? { children } : {}),
    };

    return next;
  }

  if (tag === "T") {
    if (typeof value[1] !== "string") {
      issues.push({
        path: `${path}[1]`,
        message: "Compact text nodes require a string payload.",
      });
    }

    const props = decodeCompactTextProps(value[2], `${path}[2]`, issues);
    const next: ElementSpec = {
      kind: "text",
      ...(props?.key !== undefined ? { key: props.key } : {}),
      text: typeof value[1] === "string" ? value[1] : "",
      ...(props?.wrap !== undefined ? { wrap: props.wrap } : {}),
      ...(props?.style !== undefined ? { style: props.style } : {}),
    };

    return next;
  }

  issues.push({
    path: `${path}[0]`,
    message: "Compact node tag must be V or T.",
  });
  return null;
}

function decodeCompactChildren(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ElementSpec[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push({ path, message: "Compact view children must be an array." });
    return undefined;
  }

  const children: ElementSpec[] = [];
  value.forEach((child, index) => {
    const decoded = decodeCompactNode(child, `${path}[${index}]`, issues);
    if (decoded !== null) {
      children.push(decoded);
    }
  });
  return children;
}

function decodeCompactViewProps(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ViewSpec | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    issues.push({ path, message: "Compact view props must be an object." });
    return undefined;
  }

  for (const key of Object.keys(value)) {
    if (!compactViewKeys.has(key)) {
      issues.push({ path, message: `Unknown compact view field: ${key}` });
    }
  }

  const rows = decodeCompactTrackList(value.r, `${path}.r`, issues);
  const columns = decodeCompactTrackList(value.c, `${path}.c`, issues);
  const scroll = decodeCompactScroll(value.x, `${path}.x`, issues);
  const style = decodeCompactStyle(value.s, `${path}.s`, issues);
  const styleHover = decodeCompactStyle(value.sh, `${path}.sh`, issues);
  const styleFocus = decodeCompactStyle(value.sf, `${path}.sf`, issues);
  const bind = decodeCompactBindings(value.b, `${path}.b`, issues);
  const focusable = value.f === true ? true : undefined;

  if (value.f !== undefined && value.f !== true) {
    issues.push({
      path: `${path}.f`,
      message: "Compact focusable flag must be true when present.",
    });
  }

  const next: ViewSpec = {
    kind: "view",
    ...(typeof value.k === "string" ? { key: value.k } : {}),
    ...(rows !== undefined ? { rows } : {}),
    ...(columns !== undefined ? { columns } : {}),
    ...(scroll !== undefined ? { scroll } : {}),
    ...(style !== undefined ? { style } : {}),
    ...(styleHover !== undefined ? { styleHover } : {}),
    ...(styleFocus !== undefined ? { styleFocus } : {}),
    ...(focusable !== undefined ? { focusable } : {}),
    ...(bind !== undefined ? { bind } : {}),
  };

  return next;
}

function decodeCompactTextProps(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): TextSpec | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    issues.push({ path, message: "Compact text props must be an object." });
    return undefined;
  }

  for (const key of Object.keys(value)) {
    if (!compactTextKeys.has(key)) {
      issues.push({ path, message: `Unknown compact text field: ${key}` });
    }
  }

  if (value.w !== undefined && value.w !== true) {
    issues.push({
      path: `${path}.w`,
      message: "Compact wrap flag must be true when present.",
    });
  }

  const style = decodeCompactStyle(value.s, `${path}.s`, issues);

  const next: TextSpec = {
    kind: "text",
    ...(typeof value.k === "string" ? { key: value.k } : {}),
    text: "",
    ...(value.w === true ? { wrap: true } : {}),
    ...(style !== undefined ? { style } : {}),
  };

  return next;
}

function decodeCompactTrackList(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ViewSpec["rows"] {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push({ path, message: "Compact track lists must be arrays." });
    return undefined;
  }

  const tracks: ViewSpec["rows"] = [];
  value.forEach((track, index) => {
    if (validateTrackSpec(track, `${path}[${index}]`, issues)) {
      tracks.push(track);
    }
  });
  return tracks;
}

function decodeCompactScroll(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ViewSpec["scroll"] {
  if (value === undefined) {
    return undefined;
  }

  if (value === "x" || value === "y" || value === "both") {
    return value;
  }

  issues.push({ path, message: "Compact scroll must be x, y, or both." });
  return undefined;
}

function decodeCompactStyle(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): StyleSpec | undefined {
  const style = validateCompactStyle(value, path, issues);
  if (style === null) {
    return undefined;
  }

  const next: StyleSpec = {};
  if (style.c !== undefined) {
    next.color = style.c;
  }
  if (style.b !== undefined) {
    next.background = style.b;
  }

  return next;
}

function decodeCompactBindings(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ActionBindings | undefined {
  const bindings = validateCompactBindings(value, path, issues);
  if (bindings === null) {
    return undefined;
  }

  const next: ActionBindings = {};
  mapBinding(bindings, next, "f", "focus");
  mapBinding(bindings, next, "b", "blur");
  mapBinding(bindings, next, "kd", "keyDown");
  mapBinding(bindings, next, "ku", "keyUp");
  mapBinding(bindings, next, "p", "press");
  mapBinding(bindings, next, "cl", "click");
  mapBinding(bindings, next, "md", "mouseDown");
  mapBinding(bindings, next, "mu", "mouseUp");
  mapBinding(bindings, next, "me", "mouseEnter");
  mapBinding(bindings, next, "ml", "mouseLeave");
  mapBinding(bindings, next, "mm", "mouseMove");
  mapBinding(bindings, next, "sc", "scroll");
  return next;
}

function encodeCompactNode(node: ElementSpec): CompactNode {
  if (node.kind === "text") {
    const props: CompactTextSpec = {};
    if (node.key !== undefined) props.k = node.key;
    if (node.wrap === true) props.w = true;
    if (node.style !== undefined) props.s = encodeCompactStyle(node.style);
    return Object.keys(props).length === 0
      ? ["T", node.text]
      : ["T", node.text, props];
  }

  const props: CompactViewSpec = {};
  if (node.key !== undefined) props.k = node.key;
  if (node.rows !== undefined) props.r = [...node.rows];
  if (node.columns !== undefined) props.c = [...node.columns];
  if (node.scroll !== undefined) props.x = node.scroll;
  if (node.style !== undefined) props.s = encodeCompactStyle(node.style);
  if (node.styleHover !== undefined)
    props.sh = encodeCompactStyle(node.styleHover);
  if (node.styleFocus !== undefined)
    props.sf = encodeCompactStyle(node.styleFocus);
  if (node.focusable === true) props.f = true;
  if (node.bind !== undefined) props.b = encodeCompactBindings(node.bind);

  const children = node.children?.map(encodeCompactNode);
  if (Object.keys(props).length === 0 && children === undefined) {
    return ["V"];
  }
  if (children === undefined) {
    return ["V", props];
  }
  return ["V", props, children];
}

function encodeCompactStyle(style: StyleSpec): CompactStyleSpec {
  const next: CompactStyleSpec = {};
  if (style.color !== undefined) next.c = style.color;
  if (style.background !== undefined) next.b = style.background;
  return next;
}

function encodeCompactBindings(bindings: ActionBindings): CompactBindings {
  const next: CompactBindings = {};
  reverseMapBinding(bindings, next, "focus", "f");
  reverseMapBinding(bindings, next, "blur", "b");
  reverseMapBinding(bindings, next, "keyDown", "kd");
  reverseMapBinding(bindings, next, "keyUp", "ku");
  reverseMapBinding(bindings, next, "press", "p");
  reverseMapBinding(bindings, next, "click", "cl");
  reverseMapBinding(bindings, next, "mouseDown", "md");
  reverseMapBinding(bindings, next, "mouseUp", "mu");
  reverseMapBinding(bindings, next, "mouseEnter", "me");
  reverseMapBinding(bindings, next, "mouseLeave", "ml");
  reverseMapBinding(bindings, next, "mouseMove", "mm");
  reverseMapBinding(bindings, next, "scroll", "sc");
  return next;
}

function mapBinding(
  source: CompactBindings,
  target: ActionBindings,
  from: keyof CompactBindings,
  to: keyof ActionBindings,
): void {
  const value = source[from];
  if (value !== undefined) {
    target[to] = value;
  }
}

function reverseMapBinding(
  source: ActionBindings,
  target: CompactBindings,
  from: keyof ActionBindings,
  to: keyof CompactBindings,
): void {
  const value = source[from];
  if (value !== undefined) {
    target[to] = value;
  }
}
