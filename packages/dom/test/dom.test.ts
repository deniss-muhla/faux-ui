import { describe, expect, it } from "vitest";

import {
  appendChild,
  type BindingToken,
  createTextNode,
  createViewNode,
  setNodeBindings,
} from "../../core/src/index.js";
import {
  dispatchDomBinding,
  resolveDomBinding,
  resolveDomFocusTarget,
} from "../src/events.js";
import { createDomTextMeasurer } from "../src/text-measurer.js";
import { renderToDomModel } from "../src/model.js";
import { mountDomRoot } from "../src/runtime.js";

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

  it("renders a text node into an absolute-positioned DOM model", () => {
    const root = createTextNode({
      spec: { text: "Hi", wrap: false, style: null },
    });
    const model = renderToDomModel(root, {
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    expect(model.textContent).toBe("Hi");
    expect(model.styles.position).toBe("absolute");
    expect(model.styles.width).toBe("2px");
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    expect(model.children[0]?.styles.left).toBe("0px");
    expect(model.children[1]?.styles.left).toBe("3px");
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      hoveredNodeIds: new Set([root.id]),
      focusedNodeId: root.id,
    });

    expect(model.styles.color).toBe("var(--faux-ui-color-focus)");
    expect(model.styles.backgroundColor).toBe("var(--faux-ui-color-accent)");
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
      constraints: { maxHeight: 1 },
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      scrollOffsets: new Map([[root.id, { x: 0, y: 1 }]]),
    });

    expect(root.layout.contentSize).toEqual({ width: 3, height: 2 });
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
      constraints: {},
      measureText: ({ text }: { text: string }) => ({
        width: text.length,
        height: 1,
      }),
    };

    const result = dispatchDomBinding(root, options, { x: 0, y: 0 }, "click");

    expect(result.actions.map((action) => action.token)).toEqual([
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
        constraints: {},
        measureText: ({ text }) => ({ width: text.length, height: 1 }),
      },
      { x: 0, y: 0 },
      "click",
      (token: BindingToken) => (token === "leaf" ? "open-leaf" : undefined),
    );

    expect(execution.resolvedActions).toEqual([
      expect.objectContaining({ token: "leaf", handler: "open-leaf" }),
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    expect(stripNodeIds(model)).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [],
            "kind": "text",
            "styles": {
              "height": "1px",
              "left": "0px",
              "overflow": "hidden",
              "position": "absolute",
              "top": "0px",
              "whiteSpace": "pre",
              "width": "4px",
            },
            "tag": "div",
            "textContent": "left",
          },
          {
            "children": [],
            "kind": "text",
            "styles": {
              "height": "1px",
              "left": "4px",
              "overflow": "hidden",
              "position": "absolute",
              "top": "0px",
              "whiteSpace": "pre",
              "width": "1px",
            },
            "tag": "div",
            "textContent": "R",
          },
        ],
        "kind": "view",
        "styles": {
          "height": "1px",
          "left": "0px",
          "overflow": "hidden",
          "position": "absolute",
          "top": "0px",
          "width": "8px",
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
      constraints: { maxHeight: 1 },
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

  it("translates wheel input into managed DOM scroll updates", () => {
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

    const document = new FakeDocument();
    const container = document.createElement("div");
    const mounted = mountDomRoot(root, {
      container,
      document,
      constraints: { maxHeight: 1 },
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ result }) => {
        dispatched.push(result.actions.map((action) => action.token));
      },
    });

    container.emit("wheel", { clientX: 0, clientY: 0, deltaX: 0, deltaY: 1 });

    expect(mounted.getScrollOffset(root.id)).toEqual({ x: 0, y: 1 });
    expect(container.children[0]?.children[0]?.textContent).toBe("two");
    expect(dispatched).toEqual([["scroll-root"]]);
  });

  it("updates projected hover and focus styles through the DOM runtime", () => {
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    container.emit("mousemove", { clientX: 0, clientY: 0 });

    expect(container.children[0]?.style.toJSON()).toMatchObject({
      color: "var(--faux-ui-color-fg)",
      backgroundColor: "var(--faux-ui-color-accent)",
    });

    container.emit("mousedown", { clientX: 0, clientY: 0 });

    expect(container.children[0]?.style.toJSON()).toMatchObject({
      color: "var(--faux-ui-color-focus)",
      backgroundColor: "var(--faux-ui-color-accent)",
    });

    container.emit("mouseleave", {});

    expect(container.children[0]?.style.toJSON()).toMatchObject({
      color: "var(--faux-ui-color-focus)",
    });
    expect(
      container.children[0]?.style.toJSON().backgroundColor,
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ binding, result }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.token),
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ binding, result }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.token),
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      onDispatch: ({ binding, result }) => {
        dispatched.push({
          binding,
          tokens: result.actions.map((action) => action.token),
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
      constraints: {},
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
      resolveAction: (token: BindingToken) =>
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

class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
}

class FakeStyle {
  private readonly values = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(this.values.entries());
  }
}

class FakeElement {
  readonly style = new FakeStyle();
  readonly children: FakeElement[] = [];
  readonly ownerDocument: FakeDocument;
  textContent: string | null = null;
  tabIndex = -1;
  private readonly listeners = new Map<
    string,
    Array<(event: unknown) => void>
  >();

  constructor(
    readonly tag: string,
    ownerDocument: FakeDocument,
  ) {
    this.ownerDocument = ownerDocument;
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners === undefined) {
      return;
    }

    this.listeners.set(
      type,
      listeners.filter((current) => current !== listener),
    );
  }

  getBoundingClientRect(): { left: number; top: number } {
    return { left: 0, top: 0 };
  }

  focus(): void {}

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
