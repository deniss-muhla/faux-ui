import { describe, expect, it } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
  setNodeBindings,
} from "../../core/src/index.js";
import {
  dispatchTuiBinding,
  resolveTuiBinding,
  resolveTuiFocusTarget,
} from "../src/events.js";
import { FrameBuffer } from "../src/frame-buffer.js";
import { renderToFrameBuffer } from "../src/render.js";
import { createTuiTextMeasurer } from "../src/text-measurer.js";

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
});
