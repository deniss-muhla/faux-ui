import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
  setNodeBindings,
} from "../../core/src/index.js";
import { TEXT_TYPE, createStatefulApp } from "../../reconciler/src/index.js";
import {
  FrameBuffer,
  createTuiTextMeasurer,
  dispatchTuiBinding,
  mountTuiRoot,
  renderStaticStatefulTuiApp,
  renderToFrameBuffer,
  resolveTuiBinding,
  resolveTuiFocusTarget,
} from "../src/index.js";

describe("tui renderer", () => {
  it("measures wrapped text in character cells", () => {
    const measurer = createTuiTextMeasurer();
    const size = measurer.measure({
      text: "hello world",
      wrap: true,
      maxWidth: 5,
    });

    expect(size).toEqual({ width: 5, height: 3 });
  });

  it("renders a simple text node into a frame buffer", () => {
    const root = createTextNode({
      spec: { text: "Hi", wrap: false, style: null },
    });
    const buffer = renderToFrameBuffer(root, { constraints: {} });

    expect(buffer).toBeInstanceOf(FrameBuffer);
    expect(buffer.toString()).toBe("Hi");
  });

  it("renders children using the core layout output", () => {
    const root = createViewNode({ spec: { columns: [3, 3] } });
    appendChild(
      root,
      createTextNode({ spec: { text: "A", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "B", wrap: false, style: null } }),
    );

    const buffer = renderToFrameBuffer(root, { constraints: {} });

    expect(buffer.toString()).toBe("A  B  ");
  });

  it("applies scroll offsets during rendering without changing layout size", () => {
    const root = createViewNode({
      spec: { rows: ["auto", "auto"], scroll: "y" },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "one", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "two", wrap: false, style: null } }),
    );

    const buffer = renderToFrameBuffer(root, {
      constraints: { maxHeight: 1 },
      scrollOffsets: new Map([[root.id, { x: 0, y: 1 }]]),
    });

    expect(root.layout.contentSize).toEqual({ width: 3, height: 2 });
    expect(buffer.toString()).toBe("two");
  });

  it("dispatches TUI bindings and resolves focus from cell coordinates", () => {
    const root = createViewNode({ bindings: { press: "root-press" } });
    const child = createViewNode({ spec: { focusable: true } });
    const leaf = createTextNode({
      spec: { text: "A", wrap: false, style: null },
      bindings: { press: "leaf-press" },
    });
    appendChild(child, leaf);
    appendChild(root, child);
    setNodeBindings(child, { press: "child-press" });

    const result = dispatchTuiBinding(
      root,
      { constraints: {} },
      { x: 0, y: 0 },
      "press",
    );

    expect(result.actions.map((action) => action.token)).toEqual([
      "leaf-press",
      "child-press",
      "root-press",
    ]);
    expect(
      resolveTuiFocusTarget(root, { constraints: {} }, { x: 0, y: 0 })?.nodeId,
    ).toBe(child.id);
  });

  it("builds resolved TUI dispatch executions for application handlers", () => {
    const root = createViewNode({ bindings: { press: "root-press" } });
    const leaf = createTextNode({
      spec: { text: "A", wrap: false, style: null },
      bindings: { press: "leaf-press" },
    });
    appendChild(root, leaf);

    const execution = resolveTuiBinding(
      root,
      { constraints: {} },
      { x: 0, y: 0 },
      "press",
      (token) => (token === "leaf-press" ? "submit" : undefined),
    );

    expect(execution.resolvedActions).toEqual([
      expect.objectContaining({ token: "leaf-press", handler: "submit" }),
    ]);
  });

  it("captures a stable TUI framebuffer snapshot", () => {
    const root = createViewNode({ spec: { columns: [4, 4] } });
    appendChild(
      root,
      createTextNode({ spec: { text: "left", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "R", wrap: false, style: null } }),
    );

    const buffer = renderToFrameBuffer(root, { constraints: {} });

    expect(buffer.toString()).toMatchInlineSnapshot(`"leftR   "`);
  });

  it("routes pointer and keyboard input through the TUI runtime", () => {
    const dispatched: Array<{
      binding: string;
      tokens: Array<string | number>;
      handlers: string[];
    }> = [];
    const focusChanges: Array<{
      previousNodeId: number | null;
      nodeId: number | null;
    }> = [];
    const root = createViewNode({ bindings: { click: "root-click" } });
    const child = createViewNode({
      spec: { focusable: true },
      bindings: {
        focus: "focus-child",
        click: "click-child",
        keyDown: "keydown-child",
        mouseDown: "mousedown-child",
        mouseEnter: "mouseenter-child",
        mouseLeave: "mouseleave-child",
        press: "press-child",
      },
    });
    const leaf = createTextNode({
      spec: { text: "A", wrap: false, style: null },
      bindings: {
        click: "click-leaf",
        mouseEnter: "mouseenter-leaf",
        mouseLeave: "mouseleave-leaf",
      },
    });
    appendChild(child, leaf);
    appendChild(root, child);

    const runtime = mountTuiRoot<string>(root, {
      constraints: {},
      resolveAction: (token) =>
        typeof token === "string" ? `handler:${token}` : undefined,
      onDispatch: ({ binding, result, execution }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.token),
          handlers:
            execution?.resolvedActions.map((action) => action.handler) ?? [],
        });
      },
      onFocusChange: (event) => {
        focusChanges.push(event);
      },
    });

    runtime.dispatchEvent({ type: "pointerMove", point: { x: 0, y: 0 } });
    runtime.dispatchEvent({ type: "pointerMove", point: { x: 10, y: 10 } });
    runtime.dispatchEvent({ type: "pointerDown", point: { x: 0, y: 0 } });
    runtime.dispatchEvent({ type: "click", point: { x: 0, y: 0 } });
    runtime.dispatchEvent({ type: "keyDown", key: "Enter" });

    expect(runtime.getFocusedNodeId()).toBe(child.id);
    expect(focusChanges).toEqual([{ previousNodeId: null, nodeId: child.id }]);
    expect(dispatched).toEqual([
      {
        binding: "mouseEnter",
        tokens: ["mouseenter-child"],
        handlers: ["handler:mouseenter-child"],
      },
      {
        binding: "mouseEnter",
        tokens: ["mouseenter-leaf"],
        handlers: ["handler:mouseenter-leaf"],
      },
      {
        binding: "mouseMove",
        tokens: [],
        handlers: [],
      },
      {
        binding: "mouseLeave",
        tokens: ["mouseleave-leaf"],
        handlers: ["handler:mouseleave-leaf"],
      },
      {
        binding: "mouseLeave",
        tokens: ["mouseleave-child"],
        handlers: ["handler:mouseleave-child"],
      },
      {
        binding: "mouseMove",
        tokens: [],
        handlers: [],
      },
      {
        binding: "focus",
        tokens: ["focus-child"],
        handlers: ["handler:focus-child"],
      },
      {
        binding: "mouseDown",
        tokens: ["mousedown-child"],
        handlers: ["handler:mousedown-child"],
      },
      {
        binding: "click",
        tokens: ["click-leaf", "click-child", "root-click"],
        handlers: [
          "handler:click-leaf",
          "handler:click-child",
          "handler:root-click",
        ],
      },
      {
        binding: "keyDown",
        tokens: ["keydown-child"],
        handlers: ["handler:keydown-child"],
      },
      {
        binding: "press",
        tokens: ["press-child"],
        handlers: ["handler:press-child"],
      },
    ]);
  });

  it("renders a static stateful TUI app through the renderer helper", () => {
    const app = createStatefulApp({
      initialState: 0,
      initialViewState: { focusedNodeLabel: "none" },
      reduce(state: number, action: "increment") {
        return action === "increment" ? state + 1 : state;
      },
      render({ state }) {
        return createElement(TEXT_TYPE, null, String(state));
      },
    });

    const mounted = renderStaticStatefulTuiApp({
      app,
      constraints: { maxWidth: 4, maxHeight: 1 },
    });

    expect(mounted.render().toString()).toContain("0");

    app.dispatch("increment");

    expect(mounted.render().toString()).toContain("1");
    mounted.unmount();
  });

  it("cycles focus in tree order through the TUI runtime", () => {
    const root = createViewNode({ spec: { rows: ["auto", "auto"] } });
    const first = createViewNode({ spec: { focusable: true } });
    const second = createViewNode({ spec: { focusable: true } });
    appendChild(
      first,
      createTextNode({ spec: { text: "A", wrap: false, style: null } }),
    );
    appendChild(
      second,
      createTextNode({ spec: { text: "B", wrap: false, style: null } }),
    );
    appendChild(root, first);
    appendChild(root, second);

    const runtime = mountTuiRoot(root, { constraints: {} });

    expect(runtime.focusNext()).toBe(first.id);
    expect(runtime.focusNext()).toBe(second.id);
    expect(runtime.focusPrevious()).toBe(first.id);
  });

  it("dispatches drag lifecycle bindings with pointer metadata", () => {
    const dispatched: Array<{
      binding: string;
      pointer: unknown;
      tokens: Array<string | number>;
    }> = [];
    const root = createViewNode({
      bindings: {
        mouseDown: "mouse-down-root",
        mouseMove: "mouse-move-root",
        mouseUp: "mouse-up-root",
        dragStart: "drag-start-root",
        drag: "drag-root",
        dragEnd: "drag-end-root",
      },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "AB", wrap: false, style: null } }),
    );

    const runtime = mountTuiRoot(root, {
      constraints: {},
      onDispatch: ({ binding, result, pointer }) => {
        dispatched.push({
          binding,
          pointer,
          tokens: result.actions.map((action) => action.token),
        });
      },
    });

    runtime.dispatchEvent({
      type: "pointerDown",
      point: { x: 0, y: 0 },
      pointer: {
        point: { x: 0, y: 0 },
        button: "secondary",
        modifiers: {
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true,
        },
      },
    });
    runtime.dispatchEvent({
      type: "pointerMove",
      point: { x: 1, y: 0 },
      pointer: {
        point: { x: 1, y: 0 },
        button: "secondary",
        modifiers: {
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true,
        },
      },
    });
    runtime.dispatchEvent({
      type: "pointerUp",
      point: { x: 1, y: 0 },
      pointer: {
        point: { x: 1, y: 0 },
        button: "secondary",
        modifiers: {
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true,
        },
      },
    });

    expect(dispatched).toEqual([
      {
        binding: "mouseDown",
        tokens: ["mouse-down-root"],
        pointer: {
          point: { x: 0, y: 0 },
          button: "secondary",
          modifiers: {
            altKey: true,
            ctrlKey: false,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
      {
        binding: "mouseMove",
        tokens: ["mouse-move-root"],
        pointer: {
          point: { x: 1, y: 0 },
          button: "secondary",
          modifiers: {
            altKey: true,
            ctrlKey: false,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
      {
        binding: "dragStart",
        tokens: ["drag-start-root"],
        pointer: {
          point: { x: 1, y: 0 },
          button: "secondary",
          modifiers: {
            altKey: true,
            ctrlKey: false,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
      {
        binding: "drag",
        tokens: ["drag-root"],
        pointer: {
          point: { x: 1, y: 0 },
          button: "secondary",
          modifiers: {
            altKey: true,
            ctrlKey: false,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
      {
        binding: "mouseUp",
        tokens: ["mouse-up-root"],
        pointer: {
          point: { x: 1, y: 0 },
          button: "secondary",
          modifiers: {
            altKey: true,
            ctrlKey: false,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
      {
        binding: "dragEnd",
        tokens: ["drag-end-root"],
        pointer: {
          point: { x: 1, y: 0 },
          button: "secondary",
          modifiers: {
            altKey: true,
            ctrlKey: false,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
    ]);
  });

  it("updates managed scroll offsets and rerenders through the TUI runtime", () => {
    const dispatched: Array<Array<string | number>> = [];
    const root = createViewNode({
      spec: { rows: ["auto", "auto"], scroll: "y" },
      bindings: { scroll: "scroll-root" },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "one", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "two", wrap: false, style: null } }),
    );

    const runtime = mountTuiRoot(root, {
      constraints: { maxHeight: 1 },
      onDispatch: ({ result }) => {
        dispatched.push(result.actions.map((action) => action.token));
      },
    });

    expect(runtime.render().toString()).toBe("one");

    runtime.scrollAtPoint({ x: 0, y: 0 }, { x: 0, y: 1 });

    expect(runtime.getScrollOffset(root.id)).toEqual({ x: 0, y: 1 });
    expect(runtime.render().toString()).toBe("two");
    expect(dispatched).toEqual([["scroll-root"]]);
  });

  it("normalizes and clamps manual TUI scroll offsets", () => {
    const root = createViewNode({
      spec: { rows: ["auto", "auto"], scroll: "y" },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "one", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "two", wrap: false, style: null } }),
    );

    const runtime = mountTuiRoot(root, {
      constraints: { maxHeight: 1 },
    });

    runtime.setScrollOffset(root.id, { x: 2.7, y: 99.4 });

    expect(runtime.getScrollOffset(root.id)).toEqual({ x: 0, y: 1 });
    expect(runtime.render().toString()).toBe("two");

    runtime.setScrollOffset(root.id, { x: -4, y: -2 });

    expect(runtime.getScrollOffset(root.id)).toEqual({ x: 0, y: 0 });
    expect(runtime.render().toString()).toBe("one");
  });
});
