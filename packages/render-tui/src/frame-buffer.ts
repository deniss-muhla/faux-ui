export interface CellStyle {
  foreground?: string;
  background?: string;
}

export interface Cell extends CellStyle {
  char: string;
}

export class FrameBuffer {
  readonly width: number;
  readonly height: number;
  readonly cells: Cell[];

  constructor(width: number, height: number, fill = " ") {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: width * height }, () => ({ char: fill }));
  }

  write(x: number, y: number, char: string, style?: CellStyle): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }

    this.cells[y * this.width + x] = {
      char,
      ...(style?.foreground !== undefined
        ? { foreground: style.foreground }
        : {}),
      ...(style?.background !== undefined
        ? { background: style.background }
        : {}),
    };
  }

  writeText(x: number, y: number, text: string, style?: CellStyle): void {
    for (let index = 0; index < text.length; index += 1) {
      this.write(x + index, y, text[index] ?? " ", style);
    }
  }

  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    style: CellStyle,
  ): void {
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const currentX = x + column;
        const currentY = y + row;
        if (
          currentX < 0 ||
          currentY < 0 ||
          currentX >= this.width ||
          currentY >= this.height
        ) {
          continue;
        }

        const existing = this.cells[currentY * this.width + currentX];
        this.cells[currentY * this.width + currentX] = {
          char: existing?.char ?? " ",
          ...(style.foreground !== undefined
            ? { foreground: style.foreground }
            : existing?.foreground !== undefined
              ? { foreground: existing.foreground }
              : {}),
          ...(style.background !== undefined
            ? { background: style.background }
            : existing?.background !== undefined
              ? { background: existing.background }
              : {}),
        };
      }
    }
  }

  toString(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.height; y += 1) {
      let line = "";
      for (let x = 0; x < this.width; x += 1) {
        line += this.cells[y * this.width + x]?.char ?? " ";
      }
      lines.push(line);
    }

    return lines.join("\n");
  }

  toAnsiString(): string {
    let output = "";
    let previousForeground: string | undefined;
    let previousBackground: string | undefined;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const cell = this.cells[y * this.width + x] ?? { char: " " };
        if (
          cell.foreground !== previousForeground ||
          cell.background !== previousBackground
        ) {
          output += toAnsiStyle(cell.foreground, cell.background);
          previousForeground = cell.foreground;
          previousBackground = cell.background;
        }

        output += cell.char;
      }

      if (y < this.height - 1) {
        output += "\n";
      }
    }

    output += "\u001b[0m";
    return output;
  }
}

function toAnsiStyle(
  foreground: string | undefined,
  background: string | undefined,
): string {
  const parts = ["0"];
  if (foreground !== undefined) {
    parts.push(...toTrueColorSequence(38, foreground));
  }
  if (background !== undefined) {
    parts.push(...toTrueColorSequence(48, background));
  }

  return `\u001b[${parts.join(";")}m`;
}

function toTrueColorSequence(prefix: 38 | 48, color: string): string[] {
  const rgb = parseHexColor(color);
  return [String(prefix), "2", String(rgb.r), String(rgb.g), String(rgb.b)];
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const normalized = color.trim();
  const match = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (match === null) {
    throw new Error(`Unsupported TUI color value: ${color}`);
  }

  const hex = match[1];
  if (hex === undefined) {
    throw new Error(`Unsupported TUI color value: ${color}`);
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}
