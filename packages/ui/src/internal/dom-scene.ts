import type { Size } from "./model.js";
import type { Palette } from "./palette.js";
import { defaultPalette } from "./palette.js";
import {
  type CellScene,
  type ResolvedStyle,
  accessibleNodes,
  sceneRows,
} from "./scene.js";
import type { NodeId, Point, SemanticNode } from "./model.js";

export interface DomCellSize {
  readonly width: number;
  readonly height: number;
}

export interface ClientRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface DomProjectionStats {
  readonly rows: number;
  readonly runs: number;
  readonly cells: number;
}

export interface DomSceneProjectorOptions {
  readonly ariaLabel: string;
  readonly cellSize?: DomCellSize;
  readonly palette?: Palette;
  readonly idPrefix?: string;
}

const DEFAULT_CELL_SIZE: DomCellSize = { width: 8, height: 16 };
let nextProjectionId = 1;

export class DomSceneProjector {
  readonly #surface: HTMLElement;
  readonly #visual: HTMLElement;
  readonly #accessibility: HTMLElement;
  #cellSize: DomCellSize;
  #palette: Palette;
  readonly #idPrefix: string;

  constructor(surface: HTMLElement, options: DomSceneProjectorOptions) {
    this.#surface = surface;
    this.#cellSize = normalizeCellSize(options.cellSize ?? DEFAULT_CELL_SIZE);
    this.#palette = options.palette ?? defaultPalette;
    this.#idPrefix = options.idPrefix ?? `faux-ui-${nextProjectionId++}`;
    this.#visual = surface.ownerDocument.createElement("div");
    this.#accessibility = surface.ownerDocument.createElement("div");

    configureSurface(surface, options.ariaLabel);
    configureVisualLayer(this.#visual);
    configureAccessibilityLayer(this.#accessibility);
    surface.replaceChildren(this.#visual, this.#accessibility);
  }

  updateScene(scene: CellScene): DomProjectionStats {
    const rows = sceneRows(scene);
    const rowElements: HTMLElement[] = [];
    let runCount = 0;

    this.#surface.style.width = px(scene.width * this.#cellSize.width);
    this.#surface.style.height = px(scene.height * this.#cellSize.height);
    this.#surface.style.background = this.#palette.bg;
    this.#surface.style.color = this.#palette.fg;

    for (const row of rows) {
      const rowElement = this.#surface.ownerDocument.createElement("div");
      rowElement.dataset.fauxUiRow = String(row.y);
      Object.assign(rowElement.style, {
        position: "absolute",
        left: "0",
        top: px(row.y * this.#cellSize.height),
        width: px(scene.width * this.#cellSize.width),
        height: px(this.#cellSize.height),
        lineHeight: px(this.#cellSize.height),
        overflow: "hidden",
        whiteSpace: "pre",
      });

      for (const run of row.runs) {
        const runElement = this.#surface.ownerDocument.createElement("span");
        runElement.dataset.fauxUiRun = `${row.y}:${run.x}:${run.width}`;
        runElement.textContent = run.text;
        Object.assign(runElement.style, {
          position: "absolute",
          left: px(run.x * this.#cellSize.width),
          top: "0",
          width: px(run.width * this.#cellSize.width),
          height: px(this.#cellSize.height),
          overflow: "hidden",
          whiteSpace: "pre",
          color: concreteForeground(run.style, this.#palette),
          background: concreteBackground(run.style, this.#palette),
          fontWeight: run.style.bold ? "700" : "400",
          opacity: run.style.dim ? "0.65" : "1",
          textDecoration: run.style.underline ? "underline" : "none",
        });
        rowElement.append(runElement);
        runCount += 1;
      }
      rowElements.push(rowElement);
    }

    this.#visual.replaceChildren(...rowElements);
    return { rows: rows.length, runs: runCount, cells: scene.cells.length };
  }

  updateAccessibility(root: SemanticNode, focusedId: NodeId | null): void {
    const nodes = accessibleNodes(root);
    const elements = nodes.map((node) => {
      const element = this.#surface.ownerDocument.createElement("div");
      element.id = accessibilityId(this.#idPrefix, node.id);
      element.setAttribute("role", node.role);
      element.setAttribute("aria-label", node.label);
      if (node.disabled) element.setAttribute("aria-disabled", "true");
      return element;
    });
    this.#accessibility.replaceChildren(...elements);

    if (focusedId !== null && nodes.some((node) => node.id === focusedId)) {
      this.#surface.setAttribute(
        "aria-activedescendant",
        accessibilityId(this.#idPrefix, focusedId),
      );
    } else {
      this.#surface.removeAttribute("aria-activedescendant");
    }
  }

  setPalette(palette: Palette): void {
    this.#palette = palette;
  }

  setCellSize(cellSize: DomCellSize): void {
    this.#cellSize = normalizeCellSize(cellSize);
  }

  cellSize(): DomCellSize {
    return this.#cellSize;
  }
}

export function clientPointToCell(
  rect: ClientRectLike,
  sceneSize: Size,
  clientX: number,
  clientY: number,
): Point | null {
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    sceneSize.width <= 0 ||
    sceneSize.height <= 0 ||
    clientX < rect.left ||
    clientY < rect.top ||
    clientX >= rect.left + rect.width ||
    clientY >= rect.top + rect.height
  ) {
    return null;
  }

  return {
    x: Math.min(
      sceneSize.width - 1,
      Math.floor(((clientX - rect.left) * sceneSize.width) / rect.width),
    ),
    y: Math.min(
      sceneSize.height - 1,
      Math.floor(((clientY - rect.top) * sceneSize.height) / rect.height),
    ),
  };
}

export function fitCells(
  pixelWidth: number,
  pixelHeight: number,
  cellSize: DomCellSize = DEFAULT_CELL_SIZE,
): Size {
  const normalized = normalizeCellSize(cellSize);
  return {
    width: Math.max(0, Math.floor(pixelWidth / normalized.width)),
    height: Math.max(0, Math.floor(pixelHeight / normalized.height)),
  };
}

function configureSurface(surface: HTMLElement, ariaLabel: string): void {
  surface.setAttribute("role", "application");
  surface.setAttribute("aria-label", ariaLabel.trim() || "faux-ui application");
  surface.tabIndex = 0;
  surface.dataset.fauxUiSurface = "";
  Object.assign(surface.style, {
    position: "relative",
    display: "block",
    margin: "0",
    padding: "0",
    border: "0",
    overflow: "hidden",
    boxSizing: "content-box",
    fontFamily:
      '"Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
    fontSize: "14px",
    fontVariantLigatures: "none",
    fontFeatureSettings: '"liga" 0, "calt" 0',
    letterSpacing: "0",
    direction: "ltr",
    unicodeBidi: "bidi-override",
    userSelect: "none",
    touchAction: "none",
    outline: "none",
  });
}

function configureVisualLayer(element: HTMLElement): void {
  element.dataset.fauxUiVisual = "";
  element.setAttribute("aria-hidden", "true");
  Object.assign(element.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
  });
}

function configureAccessibilityLayer(element: HTMLElement): void {
  element.dataset.fauxUiAccessibility = "";
  Object.assign(element.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: "0",
  });
}

function concreteForeground(style: ResolvedStyle, palette: Palette): string {
  return palette[style.inverse ? style.background : style.foreground];
}

function concreteBackground(style: ResolvedStyle, palette: Palette): string {
  return palette[style.inverse ? style.foreground : style.background];
}

function accessibilityId(prefix: string, id: NodeId): string {
  return `${prefix}-a11y-${id}`;
}

function normalizeCellSize(cellSize: DomCellSize): DomCellSize {
  if (
    !Number.isFinite(cellSize.width) ||
    !Number.isFinite(cellSize.height) ||
    cellSize.width <= 0 ||
    cellSize.height <= 0
  ) {
    throw new Error("DOM cell width and height must be finite positive numbers.");
  }
  return { width: cellSize.width, height: cellSize.height };
}

function px(value: number): string {
  return `${value}px`;
}
