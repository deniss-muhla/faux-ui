import type { Palette } from "./model.js";
import type { CellScene, ResolvedStyle } from "./scene.js";

const RESET = "\u001b[0m";

export function sceneToAnsi(scene: CellScene, palette: Palette): string {
  let output = "";
  for (let y = 0; y < scene.height; y += 1) {
    let activeStyle: ResolvedStyle | null = null;
    let x = 0;
    while (x < scene.width) {
      const cell = scene.cells[y * scene.width + x];
      if (cell === undefined) break;
      if (cell.continuation) {
        x += 1;
        continue;
      }
      if (activeStyle === null || !stylesEqual(activeStyle, cell.style)) {
        output += ansiStyle(cell.style, palette);
        activeStyle = cell.style;
      }
      output += cell.glyph === "" ? " " : cell.glyph;

      const wide = scene.cells[y * scene.width + x + 1]?.continuation === true;
      const needsAnchor = wide || !isSinglePrintableAscii(cell.glyph);
      x += wide ? 2 : 1;
      if (needsAnchor && x < scene.width) {
        // Terminals disagree on emoji, combining, ambiguous, and CJK widths.
        // Re-anchor following cells instead of trusting the terminal cursor.
        output += `\u001b[${x + 1}G`;
      }
    }
    if (y < scene.height - 1) output += "\r\n";
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

function isSinglePrintableAscii(glyph: string): boolean {
  return glyph.length === 1 && glyph >= " " && glyph <= "~";
}

function stylesEqual(a: ResolvedStyle, b: ResolvedStyle): boolean {
  return (
    a.foreground === b.foreground &&
    a.background === b.background &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.inverse === b.inverse &&
    a.underline === b.underline
  );
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
