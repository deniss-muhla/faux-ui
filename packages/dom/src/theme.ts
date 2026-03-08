import type { DomElementLike } from "./runtime.js";

export interface DomThemeValues {
  fg?: string;
  muted?: string;
  accent?: string;
  success?: string;
  warning?: string;
  danger?: string;
  bg?: string;
  bgAlt?: string;
  border?: string;
  focus?: string;
  selection?: string;
  inverse?: string;
}

export const defaultDomTheme: Required<DomThemeValues> = {
  fg: "#1f2937",
  muted: "#4b5563",
  accent: "#0f766e",
  success: "#166534",
  warning: "#b45309",
  danger: "#b91c1c",
  bg: "#fffdf7",
  bgAlt: "#f3efe1",
  border: "#d6cfc3",
  focus: "#d7f4f0",
  selection: "#e7f5ef",
  inverse: "#fffaf2",
};

export function applyDomTheme(
  element: DomElementLike,
  theme: DomThemeValues,
): void {
  for (const [token, value] of Object.entries(theme)) {
    if (value === undefined) {
      continue;
    }

    element.style.setProperty(`--faux-ui-color-${token}`, value);
  }
}
