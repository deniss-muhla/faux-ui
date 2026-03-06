export interface Cell {
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

  write(x: number, y: number, char: string): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }

    this.cells[y * this.width + x] = { char };
  }

  writeText(x: number, y: number, text: string): void {
    for (let index = 0; index < text.length; index += 1) {
      this.write(x + index, y, text[index] ?? " ");
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
}
