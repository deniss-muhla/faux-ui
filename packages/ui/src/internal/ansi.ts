import type { Palette } from "./model.js";
import type { CellScene, ResolvedStyle } from "./scene.js";
import { sceneRows } from "./scene.js";

const RESET = "\u001b[0m";

export function sceneToAnsi(scene: CellScene, palette: Palette): string {
  const rows = sceneRows(scene);
  let output = "";
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (const run of row?.runs ?? []) {
      output += ansiStyle(run.style, palette);
      output += run.text;
    }
    if (rowIndex < rows.length - 1) output += "\r\n";
  }
  return `${output}${RESET}`;
}

export function ansiStyle(style: ResolvedStyle, palette: Palette): string {
  const foreground = palette[
    style.inverse ? style.background : style.foreground
  ];
  const background = palette[
    style.inverse ? style.foreground : style.background
  ];
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  const parts = [
    "0",
    `38;2;${foregroundRgb.r};${foregroundRgb.g};${foregroundRgb.b}`,
    `48;2;${backgroundRgb.r};${backgroundRgb.g};${backgroundRgb.b}`,
  ];
  if (style.bold) parts.push("1");
  if (style.dim) parts.push("2");
  if (style.underline) parts.push("4");
  return `\u001b[${parts.join(";")}m`;
}

export function parseHexColor(color: string): {
  readonly r: number;
  readonly g: number;
  readonly b: number;
} {
  const match = /^#([\da-f]{6})$/iu.exec(color.trim());
  if (match?.[1] === undefined) {
    throw new Error(`TUI palette colors must use #RRGGBB; received ${color}.`);
  }
  return {
    r: Number.parseInt(match[1].slice(0, 2), 16),
    g: Number.parseInt(match[1].slice(2, 4), 16),
    b: Number.parseInt(match[1].slice(4, 6), 16),
  };
}
