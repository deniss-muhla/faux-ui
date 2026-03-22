import type {
  ActionBindings,
  CompactBindings,
  CompactStyleSpec,
  DocumentSpec,
  ElementSpec,
  SemanticColor,
  StyleSpec,
  TrackSpec,
  ViewSpec,
} from "./index.js";

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const semanticColors = new Set<SemanticColor>([
  "fg",
  "muted",
  "accent",
  "success",
  "warning",
  "danger",
  "bg",
  "bgAlt",
  "border",
  "focus",
  "selection",
  "inverse",
]);

const viewKeys = new Set<keyof ViewSpec | "kind">([
  "kind",
  "key",
  "rows",
  "columns",
  "scroll",
  "style",
  "styleHover",
  "styleFocus",
  "focusable",
  "bind",
  "children",
]);

const textKeys = new Set(["kind", "key", "text", "wrap", "style"]);
const styleKeys = new Set(["color", "background"]);
const bindingKeys = new Set([
  "focus",
  "blur",
  "keyDown",
  "keyUp",
  "press",
  "click",
  "mouseDown",
  "mouseUp",
  "mouseEnter",
  "mouseLeave",
  "mouseMove",
  "dragStart",
  "drag",
  "dragEnd",
  "scroll",
]);

export function validateDocumentSpec(
  value: unknown,
): ValidationResult<DocumentSpec> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return fail([{ path: "$", message: "Document must be an object." }]);
  }

  rejectUnknownKeys(value, ["version", "root"], "$", issues);

  if (value.version !== 1) {
    issues.push({ path: "$.version", message: "Document version must be 1." });
  }

  const root = validateElementSpec(value.root, "$.root", issues);
  if (issues.length > 0 || root === null) {
    return fail(issues);
  }

  return { ok: true, value: { version: 1, root } };
}

export function validateTrackSpec(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is TrackSpec {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      issues.push({
        path,
        message: "Fixed tracks must be non-negative integers.",
      });
      return false;
    }

    return true;
  }

  if (value === "auto") {
    return true;
  }

  if (typeof value === "string" && /^(?:\d+|\d+\.\d+)fr$/.test(value)) {
    const weight = Number.parseFloat(value.slice(0, -2));
    if (weight <= 0) {
      issues.push({
        path,
        message: "Fraction track weights must be positive.",
      });
      return false;
    }

    return true;
  }

  issues.push({
    path,
    message: "Track must be a non-negative integer, auto, or Nfr string.",
  });
  return false;
}

export function validateStyleSpec(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): StyleSpec | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    issues.push({ path, message: "Style must be an object." });
    return null;
  }

  rejectUnknownKeys(value, styleKeys, path, issues);

  const next: StyleSpec = {};
  if (value.color !== undefined) {
    if (!semanticColors.has(value.color as SemanticColor)) {
      issues.push({
        path: `${path}.color`,
        message: "Unknown semantic color.",
      });
    } else {
      next.color = value.color as SemanticColor;
    }
  }
  if (value.background !== undefined) {
    if (!semanticColors.has(value.background as SemanticColor)) {
      issues.push({
        path: `${path}.background`,
        message: "Unknown semantic color.",
      });
    } else {
      next.background = value.background as SemanticColor;
    }
  }

  return next;
}

export function validateActionBindings(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ActionBindings | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    issues.push({ path, message: "Bindings must be an object." });
    return null;
  }

  rejectUnknownKeys(value, bindingKeys, path, issues);

  const next: ActionBindings = {};
  for (const key of Object.keys(value)) {
    if (!bindingKeys.has(key)) {
      continue;
    }

    const token = value[key];
    if (typeof token !== "string" || token.length === 0) {
      issues.push({
        path: `${path}.${key}`,
        message: "Binding values must be non-empty strings.",
      });
      continue;
    }

    next[key as keyof ActionBindings] = token;
  }

  return next;
}

export function validateCompactBindings(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): CompactBindings | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    issues.push({ path, message: "Compact bindings must be an object." });
    return null;
  }

  const allowed = new Set([
    "f",
    "b",
    "kd",
    "ku",
    "p",
    "cl",
    "md",
    "mu",
    "me",
    "ml",
    "mm",
    "ds",
    "dg",
    "de",
    "sc",
  ]);
  rejectUnknownKeys(value, allowed, path, issues);

  const next: CompactBindings = {};
  for (const key of Object.keys(value)) {
    const token = value[key];
    if (typeof token !== "string" || token.length === 0) {
      issues.push({
        path: `${path}.${key}`,
        message: "Compact binding values must be non-empty strings.",
      });
      continue;
    }

    next[key as keyof CompactBindings] = token;
  }

  return next;
}

export function validateCompactStyle(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): CompactStyleSpec | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    issues.push({ path, message: "Compact style must be an object." });
    return null;
  }

  const allowed = new Set(["c", "b"]);
  rejectUnknownKeys(value, allowed, path, issues);

  const next: CompactStyleSpec = {};
  if (value.c !== undefined) {
    if (!semanticColors.has(value.c as SemanticColor)) {
      issues.push({ path: `${path}.c`, message: "Unknown semantic color." });
    } else {
      next.c = value.c as SemanticColor;
    }
  }
  if (value.b !== undefined) {
    if (!semanticColors.has(value.b as SemanticColor)) {
      issues.push({ path: `${path}.b`, message: "Unknown semantic color." });
    } else {
      next.b = value.b as SemanticColor;
    }
  }

  return next;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

export function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: Iterable<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push({ path, message: `Unknown field: ${key}` });
    }
  }
}

function validateElementSpec(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ElementSpec | null {
  if (!isRecord(value)) {
    issues.push({ path, message: "Element must be an object." });
    return null;
  }

  if (value.kind === "view") {
    rejectUnknownKeys(value, viewKeys, path, issues);

    const rows = validateTrackList(value.rows, `${path}.rows`, issues);
    const columns = validateTrackList(value.columns, `${path}.columns`, issues);
    const scroll = validateScroll(value.scroll, `${path}.scroll`, issues);
    const style =
      validateStyleSpec(value.style, `${path}.style`, issues) ?? undefined;
    const styleHover =
      validateStyleSpec(value.styleHover, `${path}.styleHover`, issues) ??
      undefined;
    const styleFocus =
      validateStyleSpec(value.styleFocus, `${path}.styleFocus`, issues) ??
      undefined;
    const bind =
      validateActionBindings(value.bind, `${path}.bind`, issues) ?? undefined;

    if (value.focusable !== undefined && typeof value.focusable !== "boolean") {
      issues.push({
        path: `${path}.focusable`,
        message: "focusable must be a boolean.",
      });
    }

    const children = validateChildren(
      value.children,
      `${path}.children`,
      issues,
    );
    const next: ViewSpec = {
      kind: "view",
      ...(typeof value.key === "string" ? { key: value.key } : {}),
      ...(rows !== undefined ? { rows } : {}),
      ...(columns !== undefined ? { columns } : {}),
      ...(scroll !== undefined ? { scroll } : {}),
      ...(style !== undefined ? { style } : {}),
      ...(styleHover !== undefined ? { styleHover } : {}),
      ...(styleFocus !== undefined ? { styleFocus } : {}),
      ...(typeof value.focusable === "boolean"
        ? { focusable: value.focusable }
        : {}),
      ...(bind !== undefined ? { bind } : {}),
      ...(children !== undefined ? { children } : {}),
    };

    return next;
  }

  if (value.kind === "text") {
    rejectUnknownKeys(value, textKeys, path, issues);

    if (typeof value.text !== "string") {
      issues.push({
        path: `${path}.text`,
        message: "Text nodes require a string text value.",
      });
    }
    if (value.wrap !== undefined && typeof value.wrap !== "boolean") {
      issues.push({ path: `${path}.wrap`, message: "wrap must be a boolean." });
    }

    const style =
      validateStyleSpec(value.style, `${path}.style`, issues) ?? undefined;
    const next: ElementSpec = {
      kind: "text",
      ...(typeof value.key === "string" ? { key: value.key } : {}),
      text: typeof value.text === "string" ? value.text : "",
      ...(typeof value.wrap === "boolean" ? { wrap: value.wrap } : {}),
      ...(style !== undefined ? { style } : {}),
    };

    return next;
  }

  issues.push({
    path: `${path}.kind`,
    message: "Element kind must be view or text.",
  });
  return null;
}

function validateChildren(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): ElementSpec[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push({ path, message: "children must be an array." });
    return undefined;
  }

  const children: ElementSpec[] = [];
  value.forEach((child, index) => {
    const parsed = validateElementSpec(child, `${path}[${index}]`, issues);
    if (parsed !== null) {
      children.push(parsed);
    }
  });
  return children;
}

function validateTrackList(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): TrackSpec[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push({ path, message: "Track lists must be arrays." });
    return undefined;
  }

  const tracks: TrackSpec[] = [];
  value.forEach((track, index) => {
    if (validateTrackSpec(track, `${path}[${index}]`, issues)) {
      tracks.push(track);
    }
  });
  return tracks;
}

function validateScroll(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): "x" | "y" | "both" | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "x" || value === "y" || value === "both") {
    return value;
  }

  issues.push({ path, message: "scroll must be x, y, or both." });
  return undefined;
}
