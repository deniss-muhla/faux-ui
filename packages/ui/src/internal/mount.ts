import { createElement, type ReactNode } from "react";

import {
  InternalRuntimeProvider,
  type InputHandler,
  type RuntimeContextValue,
} from "../runtime.js";
import {
  type DispatchResult,
  InteractionController,
} from "./controller.js";
import { computeLayout, type LayoutResult } from "./layout.js";
import {
  type KeyInput,
  type Palette,
  type Point,
  type PointerInput,
  type ScrollInput,
  type SemanticNode,
  type Size,
  normalizeSize,
  walkTree,
} from "./model.js";
import { defaultPalette } from "./palette.js";
import { createReconcilerRoot, type ReconcilerRoot } from "./reconciler.js";
import { paintScene, type CellScene } from "./scene.js";

export interface RenderFrame {
  readonly root: SemanticNode;
  readonly layout: LayoutResult;
  readonly scene: CellScene;
  readonly palette: Palette;
}

export interface SemanticMountOptions {
  readonly size: Size;
  readonly onFrame?: (frame: RenderFrame) => void;
  readonly onRecoverableError?: (error: unknown) => void;
}

export class SemanticMount {
  readonly #controller: InteractionController;
  readonly #root: ReconcilerRoot;
  readonly #inputHandlers = new Set<InputHandler>();
  readonly #frameListeners = new Set<(frame: RenderFrame) => void>();
  readonly #runtime: RuntimeContextValue;
  #size: Size;
  #frame: RenderFrame | null = null;
  #computing = false;
  #pendingCompute = false;
  #stopped = false;

  constructor(options: SemanticMountOptions) {
    this.#size = normalizeSize(options.size);
    if (options.onFrame !== undefined) {
      this.#frameListeners.add(options.onFrame);
    }
    this.#controller = new InteractionController(() => this.#recompute());
    this.#runtime = {
      registerInput: (handler) => {
        this.#inputHandlers.add(handler);
        return () => this.#inputHandlers.delete(handler);
      },
      focusNext: () => {
        this.#controller.focusNext(false);
      },
      focusPrevious: () => {
        this.#controller.focusNext(true);
      },
      clearFocus: () => {
        this.#controller.focus(null);
      },
    };
    this.#root = createReconcilerRoot({
      onCommit: () => this.#recompute(),
      ...(options.onRecoverableError === undefined
        ? {}
        : { onRecoverableError: options.onRecoverableError }),
    });
  }

  render(element: ReactNode): void {
    this.#assertRunning();
    this.#root.render(
      createElement(InternalRuntimeProvider, {
        value: this.#runtime,
        children: element,
      }),
    );
  }

  rerender(element: ReactNode): void {
    this.render(element);
  }

  setSize(size: Size): void {
    this.#assertRunning();
    const next = normalizeSize(size);
    if (next.width === this.#size.width && next.height === this.#size.height) {
      return;
    }
    this.#size = next;
    this.#recompute();
  }

  size(): Size {
    return this.#size;
  }

  frame(): RenderFrame {
    if (this.#frame === null) {
      throw new Error("The faux-ui application has not committed a semantic root.");
    }
    return this.#frame;
  }

  subscribe(listener: (frame: RenderFrame) => void): () => void {
    this.#frameListeners.add(listener);
    if (this.#frame !== null) listener(this.#frame);
    return () => this.#frameListeners.delete(listener);
  }

  keyDown(input: KeyInput): DispatchResult {
    this.#assertRunning();
    let handled = false;
    for (const handler of this.#inputHandlers) {
      handled = handler(input) === true || handled;
    }
    if (handled) return { handled: true, defaultPrevented: true };
    return this.#controller.keyDown(input);
  }

  keyUp(input: KeyInput): DispatchResult {
    this.#assertRunning();
    return this.#controller.keyUp(input);
  }

  pointerMove(input: PointerInput): DispatchResult {
    this.#assertRunning();
    return this.#controller.pointerMove(input);
  }

  pointerDown(input: PointerInput): DispatchResult {
    this.#assertRunning();
    return this.#controller.pointerDown(input);
  }

  pointerUp(input: PointerInput): DispatchResult {
    this.#assertRunning();
    return this.#controller.pointerUp(input);
  }

  pointerLeave(input: PointerInput): void {
    this.#assertRunning();
    this.#controller.pointerLeave(input);
  }

  scroll(input: ScrollInput): DispatchResult {
    this.#assertRunning();
    return this.#controller.scroll(input);
  }

  focusNext(reverse = false): boolean {
    this.#assertRunning();
    return this.#controller.focusNext(reverse);
  }

  clearFocus(): boolean {
    this.#assertRunning();
    return this.#controller.focus(null);
  }

  setScrollOffset(nodeId: number, offset: Point): boolean {
    this.#assertRunning();
    return this.#controller.setScrollOffset(nodeId, offset);
  }

  controller(): InteractionController {
    return this.#controller;
  }

  unmount(): void {
    if (this.#stopped) return;
    this.#stopped = true;
    this.#root.unmount();
    this.#inputHandlers.clear();
    this.#frameListeners.clear();
    this.#frame = null;
  }

  #recompute(): void {
    if (this.#stopped) return;
    if (this.#computing) {
      this.#pendingCompute = true;
      return;
    }

    this.#computing = true;
    try {
      do {
        this.#pendingCompute = false;
        const root = this.#root.getMountedNode();
        if (root === null) {
          this.#frame = null;
          continue;
        }
        const layout = computeLayout(root, this.#size);
        let scene = paintScene(root, layout, this.#controller.snapshot());
        this.#controller.update(root, layout, scene);
        scene = paintScene(root, layout, this.#controller.snapshot());
        this.#controller.update(root, layout, scene);
        const frame: RenderFrame = {
          root,
          layout,
          scene,
          palette: findPalette(root) ?? defaultPalette,
        };
        this.#frame = frame;
        for (const listener of this.#frameListeners) listener(frame);
      } while (this.#pendingCompute);
    } finally {
      this.#computing = false;
    }
  }

  #assertRunning(): void {
    if (this.#stopped) throw new Error("This faux-ui mount has been unmounted.");
  }
}

function findPalette(root: SemanticNode): Palette | null {
  return walkTree(root).find((node) => node.palette !== null)?.palette ?? null;
}
