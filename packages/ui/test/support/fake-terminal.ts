import { ansiStyle } from "../../src/internal/ansi.js";
import type { Palette } from "../../src/internal/model.js";
import type { CellScene } from "../../src/internal/scene.js";
import {
  graphemeCellWidth,
  splitGraphemes,
} from "../../src/internal/unicode.js";
import type { TerminalInput, TerminalOutput } from "../../src/tui.js";

const ESCAPE = "\u001b";
/** The model stores written continuation cells as an empty glyph string. */
const CONTINUATION = "";

export interface FakeTerminalCell {
  readonly glyph: string;
  readonly continuation: boolean;
  readonly style: string;
}

/**
 * A deterministic terminal state model. It consumes the ANSI an adapter emits
 * and reconstructs the visible grid, so tests can compare the terminal state
 * instead of a single output chunk.
 */
export class FakeTerminalOutput implements TerminalOutput {
  readonly isTTY = true;
  readonly writes: string[] = [];
  readonly modes = new Set<number>();
  columns: number;
  rows: number;
  clears = 0;
  autowrap = true;
  cursorVisible = true;
  alternateScreen = false;
  #grid: Array<Array<string | null>>;
  #styles: Array<Array<string | null>>;
  #row = 0;
  #column = 0;
  #style = "";
  readonly #listeners = new Set<() => void>();
  #failures = 0;
  #failureMessage = "fake terminal write failed";
  #failureFragment: string | null = null;

  constructor(columns: number, rows: number) {
    this.columns = columns;
    this.rows = rows;
    this.#grid = blankGrid(columns, rows);
    this.#styles = blankGrid(columns, rows);
  }

  write(chunk: string): void {
    if (
      this.#failures > 0 &&
      (this.#failureFragment === null || chunk.includes(this.#failureFragment))
    ) {
      this.#failures -= 1;
      throw new Error(this.#failureMessage);
    }
    this.writes.push(chunk);
    this.#consume(chunk);
  }

  on(_event: "resize", listener: () => void): void {
    this.#listeners.add(listener);
  }

  off(_event: "resize", listener: () => void): void {
    this.#listeners.delete(listener);
  }

  get listeners(): ReadonlySet<() => void> {
    return this.#listeners;
  }

  failNextWrite(message = "fake terminal write failed"): void {
    this.#failures += 1;
    this.#failureMessage = message;
    this.#failureFragment = null;
  }

  failNextWriteContaining(
    fragment: string,
    message = "fake terminal write failed",
  ): void {
    this.#failures += 1;
    this.#failureMessage = message;
    this.#failureFragment = fragment;
  }

  /** Resizes the terminal screen without notifying size listeners. */
  setDimensions(columns: number, rows: number): void {
    this.#resize(columns, rows);
  }

  /** Resizes the terminal screen and notifies size listeners. */
  resize(columns: number, rows: number): void {
    this.#resize(columns, rows);
    for (const listener of this.#listeners) listener();
  }

  snapshot(): FakeTerminalCell[][] {
    return Array.from({ length: this.rows }, (_, y) =>
      Array.from({ length: this.columns }, (_, x) => {
        const glyph = this.#grid[y]?.[x] ?? null;
        return {
          glyph: glyph === null || glyph === CONTINUATION ? "" : glyph,
          continuation: glyph === CONTINUATION,
          style: this.#styles[y]?.[x] ?? "",
        };
      }),
    );
  }

  text(): string[] {
    return this.snapshot().map((row) =>
      row.map((cell) => (cell.continuation ? "" : cell.glyph)).join(""),
    );
  }

  #resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
    this.#grid = blankGrid(columns, rows);
    this.#styles = blankGrid(columns, rows);
    this.#row = 0;
    this.#column = 0;
  }

  #consume(chunk: string): void {
    let index = 0;
    while (index < chunk.length) {
      const char = chunk[index];
      if (char === ESCAPE) {
        index = this.#consumeEscape(chunk, index);
        continue;
      }
      if (char === "\r") {
        this.#column = 0;
        index += 1;
        continue;
      }
      if (char === "\n") {
        this.#row = Math.min(this.rows - 1, this.#row + 1);
        this.#column = 0;
        index += 1;
        continue;
      }
      const start = index;
      while (
        index < chunk.length &&
        chunk[index] !== ESCAPE &&
        chunk[index] !== "\r" &&
        chunk[index] !== "\n"
      ) {
        index += 1;
      }
      for (const grapheme of splitGraphemes(chunk.slice(start, index))) {
        this.#writeGlyph(grapheme);
      }
    }
  }

  #consumeEscape(chunk: string, index: number): number {
    if (chunk[index + 1] !== "[") return Math.min(chunk.length, index + 2);
    let end = index + 2;
    while (end < chunk.length && !isFinalByte(chunk[end] ?? "")) end += 1;
    if (end >= chunk.length) return chunk.length;
    this.#applySequence(chunk.slice(index + 2, end), chunk[end] ?? "");
    return end + 1;
  }

  #applySequence(raw: string, final: string): void {
    switch (final) {
      case "m": {
        this.#style = raw === "" || raw === "0" ? "" : `${ESCAPE}[${raw}m`;
        return;
      }
      case "J": {
        // The TUI adapter emits only the full-screen clear; partial erases are
        // not modeled.
        if (raw === "2") this.#clearScreen();
        return;
      }
      case "H":
      case "f": {
        this.#row = clamp(parameter(raw, 0, 1) - 1, this.rows - 1);
        this.#column = clamp(parameter(raw, 1, 1) - 1, this.columns - 1);
        return;
      }
      case "G": {
        this.#column = clamp(parameter(raw, 0, 1) - 1, this.columns - 1);
        return;
      }
      case "A": {
        this.#row = Math.max(0, this.#row - parameter(raw, 0, 1));
        return;
      }
      case "B": {
        this.#row = Math.min(this.rows - 1, this.#row + parameter(raw, 0, 1));
        return;
      }
      case "C": {
        this.#column = Math.min(
          this.columns - 1,
          this.#column + parameter(raw, 0, 1),
        );
        return;
      }
      case "D": {
        this.#column = Math.max(0, this.#column - parameter(raw, 0, 1));
        return;
      }
      case "h":
      case "l": {
        this.#setModes(raw, final === "h");
        return;
      }
      default:
        return;
    }
  }

  #clearScreen(): void {
    this.clears += 1;
    this.#grid = blankGrid(this.columns, this.rows);
    this.#styles = blankGrid(this.columns, this.rows);
    this.#row = 0;
    this.#column = 0;
  }

  #setModes(raw: string, enabled: boolean): void {
    if (!raw.startsWith("?")) return;
    for (const value of raw.slice(1).split(";")) {
      const mode = Number.parseInt(value, 10);
      if (!Number.isFinite(mode)) continue;
      if (enabled) this.modes.add(mode);
      else this.modes.delete(mode);
      if (mode === 7) this.autowrap = enabled;
      if (mode === 25) this.cursorVisible = enabled;
      if (mode === 1049) this.alternateScreen = enabled;
    }
  }

  #writeGlyph(glyph: string): void {
    if (
      this.#row < 0 ||
      this.#row >= this.rows ||
      this.#column < 0 ||
      this.#column >= this.columns
    ) {
      return;
    }
    const width = graphemeCellWidth(glyph);
    const row = this.#row;
    const column = this.#column;
    const line = this.#grid[row];
    const styles = this.#styles[row];
    if (line === undefined || styles === undefined) return;
    if (width === 0) {
      // A zero-width grapheme extends the cell to its left.
      const target = Math.max(0, column - 1);
      const existing = line[target];
      if (
        existing !== null &&
        existing !== undefined &&
        existing !== CONTINUATION
      ) {
        line[target] = existing + glyph;
      }
      return;
    }
    // Overwriting the right half of a wide glyph destroys the whole glyph.
    if (line[column] === CONTINUATION && column > 0) {
      line[column - 1] = null;
      styles[column - 1] = null;
    }
    line[column] = glyph;
    styles[column] = this.#style;
    if (width === 2 && column + 1 < this.columns) {
      line[column + 1] = CONTINUATION;
      styles[column + 1] = this.#style;
    }
    this.#dropStaleContinuations(row, column, width);
    if (this.autowrap) {
      const next = column + width;
      if (next >= this.columns) {
        this.#row = Math.min(this.rows - 1, row + 1);
        this.#column = 0;
      } else {
        this.#column = next;
      }
    } else {
      this.#column = Math.min(this.columns - 1, column + width);
    }
  }

  #dropStaleContinuations(row: number, column: number, width: number): void {
    const line = this.#grid[row];
    const styles = this.#styles[row];
    if (line === undefined || styles === undefined) return;
    for (const index of [column + width - 1, column + width]) {
      if (index < 0 || index >= this.columns) continue;
      if (line[index] !== CONTINUATION) continue;
      const owner = line[index - 1] ?? null;
      if (
        owner !== null &&
        owner !== CONTINUATION &&
        graphemeCellWidth(owner) === 2
      ) {
        continue;
      }
      line[index] = null;
      styles[index] = null;
    }
  }
}

export class FakeTerminalInput implements TerminalInput {
  readonly isTTY = true;
  readonly rawModes: boolean[] = [];
  resumed = 0;
  paused = 0;
  readonly #listeners = new Set<(chunk: Uint8Array | string) => void>();

  setRawMode(enabled: boolean): void {
    this.rawModes.push(enabled);
  }

  resume(): void {
    this.resumed += 1;
  }

  pause(): void {
    this.paused += 1;
  }

  on(_event: "data", listener: (chunk: Uint8Array | string) => void): void {
    this.#listeners.add(listener);
  }

  off(_event: "data", listener: (chunk: Uint8Array | string) => void): void {
    this.#listeners.delete(listener);
  }

  get listeners(): ReadonlySet<(chunk: Uint8Array | string) => void> {
    return this.#listeners;
  }

  emit(chunk: string): void {
    for (const listener of [...this.#listeners]) listener(chunk);
  }
}

/** Builds the expected visible grid for one canonical scene. */
export function expectedTerminalGrid(
  scene: CellScene,
  palette: Palette,
): FakeTerminalCell[][] {
  return Array.from({ length: scene.height }, (_, y) =>
    Array.from({ length: scene.width }, (_, x) => {
      const cell = scene.cells[y * scene.width + x];
      if (cell === undefined) {
        return { glyph: " ", continuation: false, style: "" };
      }
      return {
        glyph: cell.continuation ? "" : cell.glyph === "" ? " " : cell.glyph,
        continuation: cell.continuation,
        style: ansiStyle(cell.style, palette),
      };
    }),
  );
}

function blankGrid(columns: number, rows: number): Array<Array<string | null>> {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );
}

function isFinalByte(char: string): boolean {
  return char >= "@" && char <= "~";
}

function parameter(raw: string, index: number, fallback: number): number {
  const value = raw.split(";")[index];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clamp(value: number, maximum: number): number {
  return Math.max(0, Math.min(Math.max(0, maximum), value));
}
