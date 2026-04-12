import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
  setNodeBindings,
} from "../../core/src/index.js";
import { TEXT_TYPE, VIEW_TYPE } from "../../reconciler/src/index.js";
import {
  applyDomTheme,
  createBrowserDomTextMeasurer,
  dispatchDomBinding,
  resolveDomBinding,
  resolveDomFocusTarget,
  createDomTextMeasurer,
  render,
  renderToDomModel,
  mountDomRoot,
} from "../src/index.js";
import { FakeDocument } from "./support/fake-dom.js";

const waitForDeferredRerender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));
const ROOT_CONSTRAINTS = { maxWidth: 8, maxHeight: 4 };
const SCROLL_CONSTRAINTS = { maxWidth: 8, maxHeight: 1 };

describe("dom renderer", () => {
  it("adapts a delegated DOM measurer", () => {
    const measurer = createDomTextMeasurer({
      measureText: ({ text, maxWidth }) => ({
        width: maxWidth ?? text.length,
        height: 1,
      }),
    });

    expect(
      measurer.measure({ text: "hello", wrap: false, maxWidth: 3 }),
    ).toEqual({ width: 3, height: 1 });
  });

  it("creates a browser-style DOM measurer from a canvas-like context", () => {
    const measurer = createBrowserDomTextMeasurer({
      context: {
        font: "",
        measureText(text) {
          return { width: text.length * 7.2 };
        },
      },
      lineHeight: 18,
      minimumWidth: 2,
    });

    expect(measurer.measure({ text: "AB", wrap: false })).toEqual({
      width: 15,
      height: 18,
    });
  });

  it("applies semantic DOM theme tokens to a host element", () => {
    const document = new FakeDocument();
    const element = document.createElement("div");

    applyDomTheme(element, {
      fg: "#111111",
      accent: "#222222",
    });

    expect(element.style.toJSON()).toMatchObject({
      "--faux-ui-color-fg": "#111111",
      "--faux-ui-color-accent": "#222222",
    });
  });

  it("renders a text node into an absolute-positioned DOM model", () => {
    const root = createTextNode({
      spec: { text: "Hi", wrap: false, style: null },
    });
    const model = renderToDomModel(root, {
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    expect(model.textContent).toBe("Hi");
    expect(model.styles.position).toBe("absolute");
    expect(model.styles.width).toBe("calc(var(--faux-ui-cell-width, 1ch) * 2)");
  });

  it("renders child positions from core layout output", () => {
    const root = createViewNode({ spec: { columns: [3, 3] } });
    appendChild(
      root,
      createTextNode({ spec: { text: "A", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "B", wrap: false, style: null } }),
    );

    const model = renderToDomModel(root, {
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    expect(model.children[0]?.styles.left).toBe("0px");
    expect(model.children[1]?.styles.left).toBe(
      "calc(var(--faux-ui-cell-width, 1ch) * 3)",
    );
  });

  it("projects hover and focus styles into the DOM model", () => {
    const root = createViewNode({
      spec: {
        focusable: true,
        style: { color: "fg" },
        styleHover: { background: "accent" },
        styleFocus: { color: "focus" },
      },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "A", wrap: false, style: null } }),
    );

    const model = renderToDomModel(root, {
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      hoveredNodeIds: new Set([root.id]),
      focusedNodeId: root.id,
    });

    expect(model.styles.color).toBe("var(--faux-ui-color-focus)");
    expect(model.styles.backgroundColor).toBe("var(--faux-ui-color-accent)");
    expect(model.styles.outline).toBe("none");
  });

  it("applies render-phase scroll offsets without changing layout size", () => {
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

    const model = renderToDomModel(root, {
      constraints: SCROLL_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      scrollOffsets: new Map([[root.id, { x: 0, y: 1 }]]),
    });

    expect(root.layout.contentSize).toEqual({ width: 8, height: 2 });
    expect(model.children).toHaveLength(1);
    expect(model.children[0]?.textContent).toBe("two");
    expect(model.children[0]?.styles.top).toBe("0px");
  });

  it("dispatches DOM bindings and resolves focus from the shared render tree", () => {
    const root = createViewNode({ bindings: { click: "root" } });
    const child = createViewNode({ spec: { focusable: true } });
    const leaf = createTextNode({
      spec: { text: "A", wrap: false, style: null },
      bindings: { click: "leaf" },
    });
    appendChild(child, leaf);
    appendChild(root, child);
    setNodeBindings(child, { click: "child" });

    const options = {
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }: { text: string }) => ({
        width: text.length,
        height: 1,
      }),
    };

    const result = dispatchDomBinding(root, options, { x: 0, y: 0 }, "click");

    expect(result.actions.map((action) => action.action)).toEqual([
      "leaf",
      "child",
      "root",
    ]);
    expect(resolveDomFocusTarget(root, options, { x: 0, y: 0 })?.nodeId).toBe(
      child.id,
    );
  });

  it("builds resolved DOM dispatch executions for application handlers", () => {
    const root = createViewNode({ bindings: { click: "root" } });
    const leaf = createTextNode({
      spec: { text: "A", wrap: false, style: null },
      bindings: { click: "leaf" },
    });
    appendChild(root, leaf);

    const execution = resolveDomBinding(
      root,
      {
        constraints: ROOT_CONSTRAINTS,
        measureText: ({ text }) => ({ width: text.length, height: 1 }),
      },
      { x: 0, y: 0 },
      "click",
      (action) => (action === "leaf" ? "open-leaf" : undefined),
    );

    expect(execution.resolvedActions).toEqual([
      expect.objectContaining({ action: "leaf", handler: "open-leaf" }),
    ]);
  });

  it("captures a stable DOM render snapshot", () => {
    const root = createViewNode({ spec: { columns: [4, 4] } });
    appendChild(
      root,
      createTextNode({ spec: { text: "left", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "R", wrap: false, style: null } }),
    );

    const model = renderToDomModel(root, {
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    expect(stripNodeIds(model)).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [],
            "kind": "text",
            "styles": {
              "fontFamily": "var(--faux-ui-font-family, monospace)",
              "fontVariantLigatures": "none",
              "height": "calc(var(--faux-ui-cell-height, 1em) * 1)",
              "left": "0px",
              "lineHeight": "var(--faux-ui-cell-height, 1em)",
              "overflow": "hidden",
              "position": "absolute",
              "top": "0px",
              "whiteSpace": "pre",
              "width": "calc(var(--faux-ui-cell-width, 1ch) * 4)",
            },
            "tag": "div",
            "textContent": "left",
          },
          {
            "children": [],
            "kind": "text",
            "styles": {
              "fontFamily": "var(--faux-ui-font-family, monospace)",
              "fontVariantLigatures": "none",
              "height": "calc(var(--faux-ui-cell-height, 1em) * 1)",
              "left": "calc(var(--faux-ui-cell-width, 1ch) * 4)",
              "lineHeight": "var(--faux-ui-cell-height, 1em)",
              "overflow": "hidden",
              "position": "absolute",
              "top": "0px",
              "whiteSpace": "pre",
              "width": "calc(var(--faux-ui-cell-width, 1ch) * 1)",
            },
            "tag": "div",
            "textContent": "R",
          },
        ],
        "kind": "view",
        "styles": {
          "height": "calc(var(--faux-ui-cell-height, 1em) * 4)",
          "left": "0px",
          "overflow": "hidden",
          "position": "absolute",
          "top": "0px",
          "width": "calc(var(--faux-ui-cell-width, 1ch) * 8)",
        },
        "tag": "div",
      }
    `);
  });

  it("mounts a live DOM tree and rerenders scroll updates", () => {
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

    const document = new FakeDocument();
    const container = document.createElement("div");
    const mounted = mountDomRoot(root, {
      container,
      document,
      constraints: SCROLL_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    expect(container.children[0]?.children).toHaveLength(1);
    expect(container.children[0]?.children[0]?.textContent).toBe("one");

    mounted.setScrollOffset(root.id, { x: 0, y: 1 });

    expect(container.children[0]?.children).toHaveLength(1);
    expect(container.children[0]?.children[0]?.textContent).toBe("two");
    expect(container.children[0]?.children[0]?.style.toJSON()).toMatchObject({
      top: "0px",
    });
  });

  it("normalizes and clamps manual DOM scroll offsets", () => {
    const stateChanges: number[] = [];
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

    const document = new FakeDocument();
    const container = document.createElement("div");
    const mounted = mountDomRoot(root, {
      container,
      document,
      constraints: SCROLL_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onStateChange: () => {
        stateChanges.push(1);
      },
    });

    mounted.setScrollOffset(root.id, { x: 2.7, y: 99.4 });

    expect(mounted.getScrollOffset(root.id)).toEqual({ x: 0, y: 1 });
    expect(container.children[0]?.children[0]?.textContent).toBe("two");

    mounted.setScrollOffset(root.id, { x: -5, y: -3 });

    expect(mounted.getScrollOffset(root.id)).toEqual({ x: 0, y: 0 });
    expect(container.children[0]?.children[0]?.textContent).toBe("one");
    expect(stateChanges).toHaveLength(2);
  });

  it("translates wheel input into managed DOM scroll updates", () => {
    const dispatched: Array<Array<string | number>> = [];
    const stateChanges: number[] = [];
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

    const document = new FakeDocument();
    const container = document.createElement("div");
    const mounted = mountDomRoot(root, {
      container,
      document,
      constraints: SCROLL_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ result }) => {
        dispatched.push(result.actions.map((action) => action.action));
      },
      onStateChange: () => {
        stateChanges.push(1);
      },
    });

    container.emit("wheel", { clientX: 0, clientY: 0, deltaX: 0, deltaY: 1 });

    expect(mounted.getScrollOffset(root.id)).toEqual({ x: 0, y: 1 });
    expect(container.children[0]?.children[0]?.textContent).toBe("two");
    expect(dispatched).toEqual([["scroll-root"]]);
    expect(stateChanges).toHaveLength(1);
  });

  it("updates projected hover and focus styles through the DOM runtime", async () => {
    const root = createViewNode({
      spec: {
        focusable: true,
        style: { color: "fg" },
        styleHover: { background: "accent" },
        styleFocus: { color: "focus" },
      },
    });
    appendChild(
      root,
      createTextNode({ spec: { text: "A", wrap: false, style: null } }),
    );

    const document = new FakeDocument();
    const container = document.createElement("div");
    mountDomRoot(root, {
      container,
      document,
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    container.emit("mousemove", { clientX: 0, clientY: 0 });
    await waitForDeferredRerender();

    expect(container.children[0]?.style.toJSON()).toMatchObject({
      color: "var(--faux-ui-color-fg)",
      "background-color": "var(--faux-ui-color-accent)",
    });

    container.emit("mousedown", { clientX: 0, clientY: 0 });
    await waitForDeferredRerender();

    expect(container.children[0]?.style.toJSON()).toMatchObject({
      color: "var(--faux-ui-color-focus)",
      "background-color": "var(--faux-ui-color-accent)",
    });

    container.emit("mouseleave", {});
    await waitForDeferredRerender();

    expect(container.children[0]?.style.toJSON()).toMatchObject({
      color: "var(--faux-ui-color-focus)",
    });
    expect(
      container.children[0]?.style.toJSON()["background-color"],
    ).toBeUndefined();
  });

  it("synchronizes runtime focus state from native DOM focus and blur", () => {
    const dispatched: Array<{
      binding: string;
      tokens: Array<string | number>;
    }> = [];
    const focusChanges: Array<{
      previousNodeId: number | null;
      nodeId: number | null;
    }> = [];
    const root = createViewNode({ spec: { columns: [1, 1] } });
    const first = createViewNode({
      spec: { focusable: true },
      bindings: { focus: "focus-first", blur: "blur-first" },
    });
    const second = createViewNode({
      spec: { focusable: true },
      bindings: { focus: "focus-second", blur: "blur-second" },
    });
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

    const document = new FakeDocument();
    const container = document.createElement("div");
    const mounted = mountDomRoot(root, {
      container,
      document,
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ binding, result }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.action),
        });
      },
      onFocusChange: (event) => {
        focusChanges.push(event);
      },
    });

    const rootElement = container.children[0];
    const firstElement = rootElement?.children[0];

    firstElement?.emit("focus", {});
    const rerenderedRootElement = container.children[0];
    const secondElement = rerenderedRootElement?.children[1];
    firstElement?.emit("blur", { relatedTarget: secondElement ?? null });

    expect(mounted.getFocusedNodeId()).toBe(second.id);
    expect(focusChanges).toEqual([
      { previousNodeId: null, nodeId: first.id },
      { previousNodeId: first.id, nodeId: second.id },
    ]);
    expect(dispatched).toEqual([
      { binding: "focus", tokens: ["focus-first"] },
      { binding: "blur", tokens: ["blur-first"] },
      { binding: "focus", tokens: ["focus-second"] },
    ]);
  });

  it("flushes hover and focus state when rerender removes active nodes", () => {
    const dispatched: Array<{
      binding: string;
      tokens: Array<string | number>;
    }> = [];
    const focusChanges: Array<{
      previousNodeId: number | null;
      nodeId: number | null;
    }> = [];
    const root = createViewNode();
    const child = createViewNode({
      spec: { focusable: true },
      bindings: {
        focus: "focus-child",
        blur: "blur-child",
        mouseEnter: "enter-child",
        mouseLeave: "leave-child",
      },
    });
    appendChild(
      child,
      createTextNode({ spec: { text: "A", wrap: false, style: null } }),
    );
    appendChild(root, child);

    const document = new FakeDocument();
    const container = document.createElement("div");
    const mounted = mountDomRoot(root, {
      container,
      document,
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ binding, result }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.action),
        });
      },
      onFocusChange: (event) => {
        focusChanges.push(event);
      },
    });

    container.emit("mousemove", { clientX: 0, clientY: 0 });
    container.emit("mousedown", { clientX: 0, clientY: 0 });

    const replacementRoot = createViewNode();
    appendChild(
      replacementRoot,
      createTextNode({ spec: { text: "B", wrap: false, style: null } }),
    );

    mounted.update(replacementRoot);

    expect(mounted.getFocusedNodeId()).toBeNull();
    expect(focusChanges).toEqual([
      { previousNodeId: null, nodeId: child.id },
      { previousNodeId: child.id, nodeId: null },
    ]);
    expect(dispatched).toEqual([
      { binding: "mouseEnter", tokens: ["enter-child"] },
      { binding: "mouseMove", tokens: [] },
      { binding: "focus", tokens: ["focus-child"] },
      { binding: "mouseDown", tokens: [] },
      { binding: "mouseLeave", tokens: ["leave-child"] },
      { binding: "blur", tokens: ["blur-child"] },
    ]);
  });

  it("dispatches hover enter and leave transitions from mouse movement", () => {
    const dispatched: Array<{
      binding: string;
      tokens: Array<string | number>;
    }> = [];
    const root = createViewNode({ spec: { columns: [1, 1] } });
    const first = createViewNode({
      bindings: { mouseEnter: "enter-first", mouseLeave: "leave-first" },
    });
    const second = createViewNode({
      bindings: { mouseEnter: "enter-second", mouseLeave: "leave-second" },
    });
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

    const document = new FakeDocument();
    const container = document.createElement("div");
    mountDomRoot(root, {
      container,
      document,
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ binding, result }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.action),
        });
      },
    });

    container.emit("mousemove", { clientX: 0, clientY: 0 });
    container.emit("mousemove", { clientX: 1, clientY: 0 });
    container.emit("mouseleave", {});

    expect(dispatched).toEqual([
      { binding: "mouseEnter", tokens: ["enter-first"] },
      { binding: "mouseMove", tokens: [] },
      { binding: "mouseLeave", tokens: ["leave-first"] },
      { binding: "mouseEnter", tokens: ["enter-second"] },
      { binding: "mouseMove", tokens: [] },
      { binding: "mouseLeave", tokens: ["leave-second"] },
    ]);
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

    const document = new FakeDocument();
    const container = document.createElement("div");
    mountDomRoot(root, {
      container,
      document,
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ binding, result, pointer }) => {
        dispatched.push({
          binding,
          pointer,
          tokens: result.actions.map((action) => action.action),
        });
      },
    });

    container.emit("mousedown", {
      clientX: 0,
      clientY: 0,
      button: 2,
      ctrlKey: true,
      shiftKey: true,
    });
    container.emit("mousemove", {
      clientX: 1,
      clientY: 0,
      button: 2,
      ctrlKey: true,
      shiftKey: true,
    });
    container.emit("mouseup", {
      clientX: 1,
      clientY: 0,
      button: 2,
      ctrlKey: true,
      shiftKey: true,
    });

    expect(dispatched).toEqual([
      {
        binding: "mouseDown",
        tokens: ["mouse-down-root"],
        pointer: {
          point: { x: 0, y: 0 },
          button: "secondary",
          modifiers: {
            altKey: false,
            ctrlKey: true,
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
            altKey: false,
            ctrlKey: true,
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
            altKey: false,
            ctrlKey: true,
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
            altKey: false,
            ctrlKey: true,
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
            altKey: false,
            ctrlKey: true,
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
            altKey: false,
            ctrlKey: true,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
    ]);
  });

  it("routes browser-style input through DOM dispatch and focus state", () => {
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
        blur: "blur-child",
        click: "click-child",
        keyDown: "keydown-child",
        press: "press-child",
      },
    });
    const leaf = createTextNode({
      spec: { text: "A", wrap: false, style: null },
      bindings: { click: "click-leaf" },
    });
    appendChild(child, leaf);
    appendChild(root, child);

    const document = new FakeDocument();
    const container = document.createElement("div");
    const mounted = mountDomRoot<string>(root, {
      container,
      document,
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      resolveAction: (action) =>
        typeof action === "string" ? `handler:${action}` : undefined,
      onDispatch: ({ binding, result, execution }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.action),
          handlers:
            execution?.resolvedActions.map((action) => action.handler) ?? [],
        });
      },
      onFocusChange: (event) => {
        focusChanges.push(event);
      },
    });

    container.emit("mousedown", { clientX: 0, clientY: 0 });
    container.emit("click", { clientX: 0, clientY: 0 });
    container.emit("keydown", { key: "Enter" });
    mounted.focusNode(null, { type: "manual-blur" });

    expect(mounted.getFocusedNodeId()).toBeNull();
    expect(focusChanges).toEqual([
      { previousNodeId: null, nodeId: child.id },
      { previousNodeId: child.id, nodeId: null },
    ]);
    expect(dispatched).toEqual([
      {
        binding: "focus",
        tokens: ["focus-child"],
        handlers: ["handler:focus-child"],
      },
      { binding: "mouseDown", tokens: [], handlers: [] },
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
      {
        binding: "blur",
        tokens: ["blur-child"],
        handlers: ["handler:blur-child"],
      },
    ]);
  });

  it("renders and updates a DOM app through direct handlers", async () => {
    let count = 0;
    let focusedNodeLabel = "none";
    const document = new FakeDocument();
    const container = document.createElement("div");
    let mounted: ReturnType<typeof render> | null = null;

    const renderView = () =>
      createElement(
        VIEW_TYPE,
        {
          focusable: true,
          onClick: () => {
            count += 1;
            rerender();
          },
          onPress: () => {
            count += 1;
            rerender();
          },
        },
        createElement(TEXT_TYPE, null, `${String(count)}:${focusedNodeLabel}`),
      );

    const rerender = () => {
      mounted?.update(renderView());
    };

    mounted = render(renderView(), {
      container,
      document,
      constraints: ROOT_CONSTRAINTS,
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onFocusChange(event) {
        focusedNodeLabel =
          event.nodeId === null ? "none" : `node ${String(event.nodeId)}`;
        rerender();
      },
    });

    container.emit("mousedown", { clientX: 0, clientY: 0 });
    container.emit("click", { clientX: 0, clientY: 0 });
    await waitForDeferredRerender();

    expect(count).toBe(1);
    expect(focusedNodeLabel).not.toBe("none");
    expect(container.children[0]?.children[0]?.textContent).toContain("1:");

    mounted.unmount();
  });
});

function stripNodeIds(model: unknown): unknown {
  if (Array.isArray(model)) {
    return model.map(stripNodeIds);
  }

  if (model !== null && typeof model === "object") {
    const entries = Object.entries(model as Record<string, unknown>).filter(
      ([key]) => key !== "nodeId",
    );

    return Object.fromEntries(
      entries.map(([key, value]) => [key, stripNodeIds(value)]),
    );
  }

  return model;
}
