import { describe, expect, it, vi } from "vitest";

import { InteractionController } from "../src/internal/controller.js";
import { computeLayout } from "../src/internal/layout.js";
import {
  createBoxNode,
  createTextNode,
  replaceChildren,
  updateTextNode,
  type BoxNode,
  type PressUiEvent,
  type SemanticNode,
} from "../src/internal/model.js";
import {
  paintScene,
  sceneRows,
  sceneToText,
} from "../src/internal/scene.js";

function append(parent: BoxNode, ...children: SemanticNode[]): BoxNode {
  replaceChildren(parent, children);
  return parent;
}

describe("vNext semantic kernel", () => {
  it("allocates fixed and fraction tracks with stable remainder order", () => {
    const root = append(
      createBoxNode(1, {
        axis: "row",
        tracks: [3, "1fr", "2fr"],
        gap: 1,
      }),
      createTextNode(2, { text: "first" }),
      createTextNode(3, { text: "second" }),
      createTextNode(4, { text: "third" }),
    );

    const result = computeLayout(root, { width: 12, height: 4 });
    expect(result.root.frame).toEqual({ x: 0, y: 0, width: 12, height: 4 });
    expect(result.root.children.map((child) => child.frame)).toEqual([
      { x: 0, y: 0, width: 3, height: 4 },
      { x: 4, y: 0, width: 3, height: 4 },
      { x: 8, y: 0, width: 4, height: 4 },
    ]);
  });

  it("keeps fixed/auto overflow deterministic and clips descendants", () => {
    const root = append(
      createBoxNode(1, {
        axis: "row",
        tracks: [4, "auto", "1fr"],
        gap: 1,
      }),
      createTextNode(2, { text: "A" }),
      createTextNode(3, { text: "ABCDE" }),
      createTextNode(4, { text: "C" }),
    );

    const result = computeLayout(root, { width: 7, height: 1 });
    expect(result.root.children.map((child) => child.frame.width)).toEqual([
      4, 5, 0,
    ]);
    expect(result.root.children[1]?.clip).toEqual({
      x: 5,
      y: 0,
      width: 2,
      height: 1,
    });
  });

  it("separates scroll content extent from the viewport layout", () => {
    const child = createTextNode(2, { text: "one\ntwo\nthree\nfour" });
    const root = append(createBoxNode(1, { scroll: "y" }), child);
    const result = computeLayout(root, { width: 8, height: 2 });

    expect(result.root.contentFrame).toEqual({
      x: 0,
      y: 0,
      width: 8,
      height: 2,
    });
    expect(result.root.contentSize).toEqual({ width: 8, height: 4 });
    expect(result.root.children[0]?.frame).toEqual({
      x: 0,
      y: 0,
      width: 8,
      height: 4,
    });
  });

  it("paints borders, ellipsis, and wide continuation cells once", () => {
    const root = append(
      createBoxNode(1, { border: true }),
      createTextNode(2, {
        text: "A古BCDE",
        overflow: "ellipsis-end",
      }),
    );
    const layout = computeLayout(root, { width: 8, height: 3 });
    const scene = paintScene(root, layout);

    expect(sceneToText(scene)).toBe(
      ["┌──────┐", "│A古BC…│", "└──────┘"].join("\n"),
    );
    expect(scene.cells[1 * scene.width + 2]).toMatchObject({
      glyph: "古",
      continuation: false,
      ownerId: 2,
    });
    expect(scene.cells[1 * scene.width + 3]).toMatchObject({
      glyph: "",
      continuation: true,
      ownerId: 2,
    });
    expect(sceneRows(scene).every((row) => row.runs.length === 1)).toBe(true);
  });

  it("applies scroll as scene transform without changing layout", () => {
    const root = append(
      createBoxNode(1, { scroll: "y" }),
      createTextNode(2, { text: "one\ntwo\nthree" }),
    );
    const layout = computeLayout(root, { width: 5, height: 2 });
    const before = paintScene(root, layout);
    const after = paintScene(root, layout, {
      offsets: new Map([[1, { x: 0, y: 1 }]]),
    });

    expect(sceneToText(before)).toBe("one  \ntwo  ");
    expect(sceneToText(after)).toBe("two  \nthree");
    expect(computeLayout(root, { width: 5, height: 2 })).toEqual(layout);
  });
});

describe("vNext shared interaction controller", () => {
  it("shares focus traversal, global keys, and one activation path", () => {
    const firstPress = vi.fn();
    const secondPress = vi.fn();
    const globalKey = vi.fn();
    const first = createBoxNode(2, {
      focusable: true,
      onPress: firstPress,
      accessibleLabel: "First",
    });
    const second = createBoxNode(3, {
      focusable: true,
      onPress: secondPress,
      accessibleLabel: "Second",
    });
    const root = append(
      createBoxNode(1, {
        axis: "column",
        tracks: [1, 1],
        onKeyDown: globalKey,
      }),
      first,
      second,
    );
    const layout = computeLayout(root, { width: 8, height: 2 });
    const scene = paintScene(root, layout);
    const controller = new InteractionController();
    controller.update(root, layout, scene);

    expect(controller.keyDown({ key: "Tab" })).toEqual({
      handled: true,
      defaultPrevented: true,
    });
    expect(controller.snapshot().focusedId).toBe(2);
    controller.keyDown({ key: "Enter" });
    expect(firstPress).toHaveBeenCalledTimes(1);
    expect(globalKey).toHaveBeenCalledTimes(2);

    controller.pointerDown({ x: 2, y: 1, button: 0 });
    controller.pointerUp({ x: 2, y: 1, button: 0 });
    expect(secondPress).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().focusedId).toBe(3);
  });

  it("bubbles deterministically and honors stopPropagation", () => {
    const rootPress = vi.fn();
    const childPress = vi.fn((event: PressUiEvent) => event.stopPropagation());
    const child = createBoxNode(2, {
      focusable: true,
      onPress: childPress,
    });
    const root = append(createBoxNode(1, { onPress: rootPress }), child);
    const layout = computeLayout(root, { width: 5, height: 1 });
    const scene = paintScene(root, layout);
    const controller = new InteractionController();
    controller.update(root, layout, scene);
    controller.pointerDown({ x: 1, y: 0, button: 0 });
    controller.pointerUp({ x: 1, y: 0, button: 0 });

    expect(childPress).toHaveBeenCalledTimes(1);
    expect(rootPress).not.toHaveBeenCalled();
    expect(controller.eventTrace()).toContainEqual({
      type: "press",
      targetId: 2,
      currentTargetId: 2,
    });
  });

  it("uses the same keyboard commands for scrolling", () => {
    const root = append(
      createBoxNode(1, { scroll: "y", focusable: true }),
      createTextNode(2, { text: "one\ntwo\nthree\nfour" }),
    );
    const layout = computeLayout(root, { width: 8, height: 2 });
    const scene = paintScene(root, layout);
    const controller = new InteractionController();
    controller.update(root, layout, scene);
    controller.focusNext();

    expect(controller.keyDown({ key: "PageDown" })).toEqual({
      handled: true,
      defaultPrevented: true,
    });
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 2 });
  });

  it("follows growing content only while already at the end", () => {
    const child = createTextNode(2, { text: "one\ntwo\nthree" });
    const root = append(
      createBoxNode(1, {
        scroll: "y",
        followEnd: true,
        focusable: true,
      }),
      child,
    );
    const controller = new InteractionController();
    const update = (): void => {
      const layout = computeLayout(root, { width: 8, height: 2 });
      controller.update(root, layout, paintScene(root, layout));
    };

    update();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 1 });

    controller.setScrollOffset(1, { x: 0, y: 0 });
    updateTextNode(child, { text: "one\ntwo\nthree\nfour" });
    update();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 0 });

    controller.setScrollOffset(1, { x: 0, y: 2 });
    updateTextNode(child, { text: "one\ntwo\nthree\nfour\nfive" });
    update();
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 3 });
  });

  it("clamps one shared scroll offset and emits a trace", () => {
    const onScroll = vi.fn();
    const root = append(
      createBoxNode(1, { scroll: "y", onScroll }),
      createTextNode(2, { text: "one\ntwo\nthree\nfour" }),
    );
    const layout = computeLayout(root, { width: 8, height: 2 });
    const scene = paintScene(root, layout);
    const controller = new InteractionController();
    controller.update(root, layout, scene);

    expect(
      controller.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 99 }),
    ).toEqual({ handled: true, defaultPrevented: true });
    expect(controller.snapshot().offsets.get(1)).toEqual({ x: 0, y: 2 });
    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(controller.eventTrace()).toContainEqual({
      type: "scroll",
      targetId: 1,
      currentTargetId: 1,
    });
  });
});
