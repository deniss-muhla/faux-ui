import type { ReactNode } from "react";

import {
  DomSceneProjector,
  clientPointToCell,
  fitCells,
  type DomCellSize,
} from "./internal/dom-scene.js";
import { SemanticMount } from "./internal/mount.js";
import type { CellScene } from "./internal/scene.js";
import type { Palette, Point, Size } from "./internal/model.js";
import { mergePalette } from "./internal/palette.js";

export interface DomRenderOptions {
  readonly container?: HTMLElement;
  readonly width?: number;
  readonly height?: number;
  readonly fit?: "viewport" | "container";
  readonly cellSize?: DomCellSize;
  readonly ariaLabel?: string;
  readonly palette?: Partial<Palette>;
}

export interface DomRenderHandle {
  readonly element: HTMLElement;
  rerender(node: ReactNode): void;
  setSize(size: Size): void;
  getSize(): Size;
  getScene(): CellScene;
  focus(): void;
  unmount(): void;
}

const DEFAULT_CELL_SIZE: DomCellSize = { width: 8, height: 16 };

export function render(
  node: ReactNode,
  options: DomRenderOptions = {},
): DomRenderHandle {
  if (typeof document === "undefined") {
    throw new Error("@faux-ui/ui/dom render() requires a browser document.");
  }
  if ((options.width === undefined) !== (options.height === undefined)) {
    throw new Error("DOM width and height must be provided together.");
  }

  const container = options.container ?? document.body;
  const fit =
    options.width === undefined
      ? (options.fit ?? (container === document.body ? "viewport" : "container"))
      : null;
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const restoreHost = configureHost(container, fit);
  const surface = document.createElement("div");
  container.append(surface);
  const projector = new DomSceneProjector(surface, {
    ariaLabel: options.ariaLabel ?? "faux-ui application",
    cellSize,
  });
  const initialSize =
    options.width === undefined
      ? resolveFitSize(container, fit ?? "container", cellSize)
      : { width: options.width, height: options.height ?? 0 };
  const mount = new SemanticMount({
    size: initialSize,
    onFrame: (frame) => {
      const palette = mergePalette({ ...frame.palette, ...options.palette });
      container.style.background = palette.bg;
      projector.setPalette(palette);
      projector.updateScene(frame.scene);
      projector.updateAccessibility(
        frame.root,
        mount.controller().snapshot().focusedId,
      );
    },
  });

  const listeners: Array<
    readonly [string, EventListenerOrEventListenerObject, AddEventListenerOptions?]
  > = [];
  const wheelRemainder = { x: 0, y: 0 };
  const listen = (
    type: string,
    listener: EventListener,
    listenerOptions?: AddEventListenerOptions,
  ): void => {
    surface.addEventListener(type, listener, listenerOptions);
    listeners.push(
      listenerOptions === undefined
        ? [type, listener]
        : [type, listener, listenerOptions],
    );
  };

  listen("keydown", (rawEvent) => {
    const event = rawEvent as KeyboardEvent;
    const result = mount.keyDown(keyInput(event));
    if (result.defaultPrevented) event.preventDefault();
  });
  listen("keyup", (rawEvent) => {
    const event = rawEvent as KeyboardEvent;
    const result = mount.keyUp(keyInput(event));
    if (result.defaultPrevented) event.preventDefault();
  });
  listen("pointermove", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    const point = pointFromPointer(surface, mount.size(), event);
    if (point === null) {
      mount.pointerLeave({ x: -1, y: -1, ...pointerModifiers(event) });
    } else {
      mount.pointerMove({ ...point, ...pointerModifiers(event) });
    }
  });
  listen("pointerdown", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    surface.focus({ preventScroll: true });
    const point = pointFromPointer(surface, mount.size(), event);
    if (point === null) return;
    surface.setPointerCapture?.(event.pointerId);
    const result = mount.pointerDown({ ...point, ...pointerModifiers(event) });
    if (result.defaultPrevented) event.preventDefault();
  });
  listen("pointerup", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    const point = pointFromPointer(surface, mount.size(), event);
    const result = mount.pointerUp({
      ...(point ?? { x: -1, y: -1 }),
      ...pointerModifiers(event),
    });
    if (surface.hasPointerCapture?.(event.pointerId)) {
      surface.releasePointerCapture?.(event.pointerId);
    }
    if (result.defaultPrevented) event.preventDefault();
  });
  listen("pointercancel", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    mount.pointerUp({ x: -1, y: -1, ...pointerModifiers(event) });
    if (surface.hasPointerCapture?.(event.pointerId)) {
      surface.releasePointerCapture?.(event.pointerId);
    }
  });
  listen("pointerleave", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    mount.pointerLeave({ x: -1, y: -1, ...pointerModifiers(event) });
  });
  listen(
    "wheel",
    (rawEvent) => {
      const event = rawEvent as WheelEvent;
      const point = pointFromPointer(surface, mount.size(), event);
      if (point === null) return;
      const delta = wheelDeltaToCells(event, cellSize, wheelRemainder);
      if (delta.x === 0 && delta.y === 0) return;
      const result = mount.scroll({
        ...point,
        deltaX: delta.x,
        deltaY: delta.y,
      });
      if (result.defaultPrevented) event.preventDefault();
    },
    { passive: false },
  );

  let resizeObserver: ResizeObserver | null = null;
  let viewportResize: (() => void) | null = null;
  let stopped = false;
  if (fit === "container" && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (!stopped) mount.setSize(resolveFitSize(container, fit, cellSize));
    });
    resizeObserver.observe(container);
  } else if (fit === "viewport") {
    viewportResize = () => {
      if (!stopped) mount.setSize(resolveFitSize(container, fit, cellSize));
    };
    window.addEventListener("resize", viewportResize);
  }

  const disableFit = (): void => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (viewportResize !== null) {
      window.removeEventListener("resize", viewportResize);
      viewportResize = null;
    }
  };
  const cleanup = (): void => {
    if (stopped) return;
    stopped = true;
    disableFit();
    for (const [type, listener, listenerOptions] of listeners) {
      surface.removeEventListener(type, listener, listenerOptions);
    }
    mount.unmount();
    surface.remove();
    restoreHost();
  };

  try {
    mount.render(node);
  } catch (error) {
    cleanup();
    throw error;
  }

  return {
    element: surface,
    rerender(next): void {
      mount.rerender(next);
    },
    setSize(size): void {
      disableFit();
      mount.setSize(size);
    },
    getSize(): Size {
      return mount.size();
    },
    getScene(): CellScene {
      return mount.frame().scene;
    },
    focus(): void {
      surface.focus({ preventScroll: true });
    },
    unmount: cleanup,
  };
}

function resolveFitSize(
  container: HTMLElement,
  fit: "viewport" | "container",
  cellSize: DomCellSize,
): Size {
  return fitCells(
    fit === "viewport" ? window.innerWidth : container.clientWidth,
    fit === "viewport" ? window.innerHeight : container.clientHeight,
    cellSize,
  );
}

function pointFromPointer(
  surface: HTMLElement,
  size: Size,
  event: Pick<MouseEvent, "clientX" | "clientY">,
) {
  return clientPointToCell(
    surface.getBoundingClientRect(),
    size,
    event.clientX,
    event.clientY,
  );
}

function keyInput(event: KeyboardEvent) {
  return {
    key: event.key,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    repeat: event.repeat,
  };
}

function pointerModifiers(event: PointerEvent) {
  return {
    button: event.button,
    buttons: event.buttons,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
}

interface WheelRemainder {
  x: number;
  y: number;
}

function wheelDeltaToCells(
  event: Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">,
  cellSize: DomCellSize,
  remainder: WheelRemainder,
): Point {
  const horizontal = wheelAxisToCells(
    event.deltaX,
    event.deltaMode,
    cellSize.width,
    remainder.x,
  );
  const vertical = wheelAxisToCells(
    event.deltaY,
    event.deltaMode,
    cellSize.height,
    remainder.y,
  );
  remainder.x = horizontal.remainder;
  remainder.y = vertical.remainder;
  return { x: horizontal.cells, y: vertical.cells };
}

function wheelAxisToCells(
  delta: number,
  deltaMode: number,
  cellPixels: number,
  previousRemainder: number,
): { readonly cells: number; readonly remainder: number } {
  if (!Number.isFinite(delta) || delta === 0) {
    return { cells: 0, remainder: previousRemainder };
  }

  // Line/page-mode wheels and conventional ~100 px mouse notches should
  // match one terminal wheel command rather than skipping several rows.
  if (deltaMode !== 0 || Math.abs(delta) >= Math.max(40, cellPixels * 3)) {
    return { cells: Math.sign(delta), remainder: 0 };
  }

  const sameDirection =
    previousRemainder === 0 || Math.sign(previousRemainder) === Math.sign(delta);
  const accumulated = (sameDirection ? previousRemainder : 0) + delta;
  if (Math.abs(accumulated) < cellPixels) {
    return { cells: 0, remainder: accumulated };
  }
  const cells = Math.sign(accumulated);
  return {
    cells,
    remainder: accumulated - cells * cellPixels,
  };
}

function configureHost(
  container: HTMLElement,
  fit: "viewport" | "container" | null,
): () => void {
  const oldContainerStyle = container.getAttribute("style");
  const html = container.ownerDocument.documentElement;
  const oldHtmlStyle = html.getAttribute("style");

  if (fit === "viewport" && container === container.ownerDocument.body) {
    Object.assign(html.style, { width: "100%", height: "100%", margin: "0" });
    Object.assign(container.style, {
      width: "100%",
      height: "100%",
      margin: "0",
      overflow: "hidden",
    });
  } else {
    const position =
      container.ownerDocument.defaultView?.getComputedStyle(container).position ??
      container.style.position;
    if (position === "static") container.style.position = "relative";
    container.style.overflow = "hidden";
  }

  return () => {
    restoreStyle(container, oldContainerStyle);
    restoreStyle(html, oldHtmlStyle);
  };
}

function restoreStyle(element: HTMLElement, value: string | null): void {
  if (value === null) element.removeAttribute("style");
  else element.setAttribute("style", value);
}
