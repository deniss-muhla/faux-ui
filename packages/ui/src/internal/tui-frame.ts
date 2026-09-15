import {
  ANSI_RESET,
  resolvedStylesEqual,
  sceneRowToAnsi,
  sceneToAnsi,
} from "./ansi.js";
import type { Palette } from "./model.js";
import type { Cell, CellScene } from "./scene.js";

const CLEAR_SCREEN = "\u001b[2J\u001b[H";

export interface TuiFrameSink {
  write(chunk: string): unknown;
}

export interface TuiProjection {
  readonly scene: CellScene;
  readonly palette: Palette;
}

/**
 * Retains the last frame the terminal received. Ordinary updates write only the
 * rows whose visible glyphs or resolved styles changed, so the screen is not
 * cleared on every commit.
 */
export class TuiFrameWriter {
  readonly #output: TuiFrameSink;
  #projection: TuiProjection | null = null;

  constructor(output: TuiFrameSink) {
    this.#output = output;
  }

  write(scene: CellScene, palette: Palette): void {
    const update = planTuiFrame(this.#projection, scene, palette);
    if (update === "") return;
    try {
      this.#output.write(update);
    } catch (error) {
      // The terminal state is unknown after a failed write, so the next frame
      // must redraw completely instead of diffing against an unconfirmed one.
      this.#projection = null;
      throw error;
    }
    this.#projection = { scene, palette };
  }

  /** Forces the next frame to redraw completely. */
  invalidate(): void {
    this.#projection = null;
  }
}

export function planTuiFrame(
  previous: TuiProjection | null,
  scene: CellScene,
  palette: Palette,
): string {
  if (previous === null) return fullTuiFrame(scene, palette);
  if (
    previous.scene.width !== scene.width ||
    previous.scene.height !== scene.height ||
    !palettesEqual(previous.palette, palette)
  ) {
    return fullTuiFrame(scene, palette);
  }
  let update = "";
  for (let y = 0; y < scene.height; y += 1) {
    if (rowsEqual(previous.scene, scene, y)) continue;
    update += `\u001b[${y + 1};1H${sceneRowToAnsi(scene, palette, y)}`;
  }
  return update === "" ? "" : `${update}${ANSI_RESET}`;
}

export function fullTuiFrame(scene: CellScene, palette: Palette): string {
  return `${CLEAR_SCREEN}${sceneToAnsi(scene, palette)}`;
}

function rowsEqual(a: CellScene, b: CellScene, y: number): boolean {
  for (let x = 0; x < b.width; x += 1) {
    if (!visibleCellsEqual(a.cells[y * a.width + x], b.cells[y * b.width + x]))
      return false;
  }
  return true;
}

function visibleCellsEqual(a: Cell | undefined, b: Cell | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.glyph === b.glyph &&
    a.continuation === b.continuation &&
    resolvedStylesEqual(a.style, b.style)
  );
}

function palettesEqual(a: Palette, b: Palette): boolean {
  const names = Object.keys(a) as Array<keyof Palette>;
  if (names.length !== Object.keys(b).length) return false;
  return names.every((name) => a[name] === b[name]);
}
