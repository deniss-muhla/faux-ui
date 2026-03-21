import { defaultSemanticColors } from "@faux-ui/core";
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
  ...defaultSemanticColors,
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
