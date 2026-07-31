import type { Palette, SemanticColor } from "./model.js";

export type { Palette } from "./model.js";

export const defaultPalette: Palette = {
  fg: "#e5e7eb",
  muted: "#94a3b8",
  inverse: "#0f172a",
  bg: "#0f172a",
  panel: "#1e293b",
  selection: "#334155",
  focus: "#1d4ed8",
  accent: "#38bdf8",
  success: "#4ade80",
  warning: "#facc15",
  danger: "#f87171",
  border: "#64748b",
};

export function mergePalette(overrides: Partial<Palette> = {}): Palette {
  const palette = { ...defaultPalette, ...overrides };
  for (const [name, color] of Object.entries(palette) as Array<
    [SemanticColor, string]
  >) {
    if (!/^#[\da-f]{6}$/iu.test(color)) {
      throw new Error(`Palette color ${name} must use #RRGGBB; received ${color}.`);
    }
  }
  return palette;
}
