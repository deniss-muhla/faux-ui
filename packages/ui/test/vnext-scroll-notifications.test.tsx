import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Box, Rows, ScrollView, Text } from "../src/index.js";
import { InteractionController } from "../src/internal/controller.js";
import { computeLayout, findLayoutNode } from "../src/internal/layout.js";
import {
  createBoxNode,
  createTextNode,
  replaceChildren,
  updateTextNode,
  type BoxNode,
  type ScrollUiEvent,
  type SemanticNode,
  walkTree,
} from "../src/internal/model.js";
import { SemanticMount } from "../src/internal/mount.js";
import { paintScene } from "../src/internal/scene.js";
import { renderStatic } from "../src/testing.js";

const initialText = Array.from(
  { length: 8 },
  (_, index) => `${index}: ${"abcdefghij".repeat(2)}`,
).join("\n");

type ScrollRecord = Pick<
  ScrollUiEvent,
  "previousOffset" | "offset" | "deltaX" | "deltaY"
>;

function recordScroll(event: ScrollUiEvent): ScrollRecord {
  return {
    previousOffset: event.previousOffset,
    offset: event.offset,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
  };
}

function append(parent: BoxNode, ...children: SemanticNode[]): BoxNode {
  replaceChildren(parent, children);
  return parent;
}

function updateController(
  controller: InteractionController,
  root: BoxNode,
  size: { width: number; height: number },
): boolean {
  const layout = computeLayout(root, size);
  return controller.update(
    root,
    layout,
    paintScene(root, layout, controller.snapshot()),
  );
}

const keyboardCases = [
  ["ArrowUp", { x: 1, y: 2 }, { x: 1, y: 1 }, 0, -1],
  ["ArrowDown", { x: 1, y: 2 }, { x: 1, y: 3 }, 0, 1],
  ["ArrowLeft", { x: 1, y: 2 }, { x: 0, y: 2 }, -1, 0],
  ["ArrowRight", { x: 1, y: 2 }, { x: 2, y: 2 }, 1, 0],
  ["PageUp", { x: 1, y: 2 }, { x: 1, y: 0 }, 0, -2],
  ["PageDown", { x: 1, y: 2 }, { x: 1, y: 4 }, 0, 2],
  ["Home", { x: 1, y: 2 }, { x: 0, y: 0 }, -1, -2],
  ["End", { x: 1, y: 2 }, { x: 0, y: 6 }, -1, 4],
] as const;

describe("scroll event synchronization", () => {
  it.each(keyboardCases)(
    "%s reports its effective offset and actual delta once",
    (key, previous, next, deltaX, deltaY) => {
      const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
      const root = append(
        createBoxNode(1, { scroll: "both", focusable: true, onScroll }),
        createTextNode(2, { text: initialText }),
      );
      const controller = new InteractionController();
      updateController(controller, root, { width: 4, height: 2 });
      expect(controller.focus(root.id)).toBe(true);
      expect(controller.setScrollOffset(root.id, previous)).toBe(true);
      onScroll.mockClear();

      expect(controller.keyDown({ key })).toEqual({
        handled: true,
        defaultPrevented: true,
      });
      expect(controller.snapshot().offsets.get(root.id)).toEqual(next);
      expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
        { previousOffset: previous, offset: next, deltaX, deltaY },
      ]);
    },
  );

  it("does not report a keyboard no-op as motion", () => {
    const onScroll = vi.fn();
    const root = append(
      createBoxNode(1, { scroll: "y", focusable: true, onScroll }),
      createTextNode(2, { text: initialText }),
    );
    const controller = new InteractionController();
    updateController(controller, root, { width: 8, height: 2 });
    controller.focus(root.id);

    expect(controller.keyDown({ key: "ArrowUp" })).toEqual({
      handled: false,
      defaultPrevented: false,
    });
    expect(onScroll).not.toHaveBeenCalled();
  });

  it("reports a resize clamp from the prior effective offset", () => {
    const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
    const root = append(
      createBoxNode(1, { scroll: "both", onScroll }),
      createTextNode(2, { text: initialText }),
    );
    const controller = new InteractionController();
    updateController(controller, root, { width: 4, height: 2 });
    expect(controller.setScrollOffset(root.id, { x: 16, y: 6 })).toBe(true);
    onScroll.mockClear();

    expect(updateController(controller, root, { width: 4, height: 4 })).toBe(
      true,
    );
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 16, y: 4 });
    expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
      {
        previousOffset: { x: 16, y: 6 },
        offset: { x: 16, y: 4 },
        deltaX: 0,
        deltaY: -2,
      },
    ]);
  });

  it("reports content-shrink clamps and emits nothing for a no-op resize", () => {
    const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
    const content = createTextNode(2, { text: initialText });
    const root = append(
      createBoxNode(1, { scroll: "both", onScroll }),
      content,
    );
    const controller = new InteractionController();
    updateController(controller, root, { width: 4, height: 2 });
    controller.setScrollOffset(root.id, { x: 16, y: 6 });
    onScroll.mockClear();

    updateTextNode(content, { text: "a\nbc\nd" });
    expect(updateController(controller, root, { width: 4, height: 2 })).toBe(
      true,
    );
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 0, y: 1 });
    expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
      {
        previousOffset: { x: 16, y: 6 },
        offset: { x: 0, y: 1 },
        deltaX: -16,
        deltaY: -5,
      },
    ]);

    onScroll.mockClear();
    updateController(controller, root, { width: 5, height: 2 });
    expect(onScroll).not.toHaveBeenCalled();
  });

  it("reports one final offset when follow-end and clamp both change geometry", () => {
    const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
    const content = createTextNode(2, { text: initialText });
    const root = append(
      createBoxNode(1, { scroll: "both", followEnd: "y", onScroll }),
      content,
    );
    const controller = new InteractionController();
    updateController(controller, root, { width: 4, height: 2 });
    expect(controller.setScrollOffset(root.id, { x: 16, y: 6 })).toBe(true);
    onScroll.mockClear();

    updateTextNode(content, { text: "a\nbc\nd" });
    expect(updateController(controller, root, { width: 4, height: 2 })).toBe(
      true,
    );
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 0, y: 1 });
    expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
      {
        previousOffset: { x: 16, y: 6 },
        offset: { x: 0, y: 1 },
        deltaX: -16,
        deltaY: -5,
      },
    ]);
  });

  it("keeps initial follow-end placement silent for a new region in an existing root", () => {
    const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
    const root = append(
      createBoxNode(1),
      createTextNode(2, { text: "placeholder" }),
    );
    const controller = new InteractionController();
    updateController(controller, root, { width: 8, height: 2 });

    const content = createTextNode(4, { text: "one\ntwo\nthree\nfour" });
    const scrollRegion = append(
      createBoxNode(3, { scroll: "y", followEnd: "y", onScroll }),
      content,
    );
    append(root, scrollRegion);
    updateController(controller, root, { width: 8, height: 2 });
    expect(controller.snapshot().offsets.get(scrollRegion.id)).toEqual({
      x: 0,
      y: 2,
    });
    expect(onScroll).not.toHaveBeenCalled();

    updateTextNode(content, { text: "one\ntwo\nthree\nfour\nfive" });
    expect(updateController(controller, root, { width: 8, height: 2 })).toBe(
      true,
    );
    expect(controller.snapshot().offsets.get(scrollRegion.id)).toEqual({
      x: 0,
      y: 3,
    });
    expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
      {
        previousOffset: { x: 0, y: 2 },
        offset: { x: 0, y: 3 },
        deltaX: 0,
        deltaY: 1,
      },
    ]);
  });

  it("reports later follow-end movement but not initial end placement", () => {
    const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
    const content = createTextNode(2, { text: "one\ntwo\nthree" });
    const root = append(
      createBoxNode(1, { scroll: "y", followEnd: true, onScroll }),
      content,
    );
    const controller = new InteractionController();
    updateController(controller, root, { width: 8, height: 2 });
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 0, y: 1 });
    expect(onScroll).not.toHaveBeenCalled();

    updateTextNode(content, { text: "one\ntwo\nthree\nfour" });
    updateController(controller, root, { width: 8, height: 2 });
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 0, y: 2 });
    expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
      {
        previousOffset: { x: 0, y: 1 },
        offset: { x: 0, y: 2 },
        deltaX: 0,
        deltaY: 1,
      },
    ]);
  });

  it("keeps wheel and focus notifications accurate without duplicates", () => {
    const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
    const rows = Array.from({ length: 5 }, (_, index) =>
      append(
        createBoxNode(index + 2, { focusable: true }),
        createTextNode(index + 20, { text: `row${index}` }),
      ),
    );
    const root = append(
      createBoxNode(1, {
        axis: "column",
        tracks: rows.map(() => 1),
        scroll: "y",
        onScroll,
      }),
      ...rows,
    );
    const controller = new InteractionController();
    updateController(controller, root, { width: 8, height: 2 });

    expect(controller.scroll({ x: 1, y: 0, deltaX: 0, deltaY: 1 })).toEqual({
      handled: true,
      defaultPrevented: true,
    });
    expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
      {
        previousOffset: { x: 0, y: 0 },
        offset: { x: 0, y: 1 },
        deltaX: 0,
        deltaY: 1,
      },
    ]);

    onScroll.mockClear();
    expect(controller.focus(rows[4]!.id)).toBe(true);
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 0, y: 3 });
    expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
      {
        previousOffset: { x: 0, y: 1 },
        offset: { x: 0, y: 3 },
        deltaX: 0,
        deltaY: 2,
      },
    ]);
  });

  it("updates a mounted position indicator after keyboard scrolling", async () => {
    const events: ScrollRecord[] = [];
    function ScrollablePosition() {
      const [offset, setOffset] = useState(0);
      return (
        <Rows tracks={[1, "1fr"]}>
          <Text>{`Offset ${offset}`}</Text>
          <ScrollView
            axis="y"
            focusable
            onScroll={(event) => {
              events.push(recordScroll(event));
              setOffset(event.offset.y);
            }}
          >
            <Text>{initialText}</Text>
          </ScrollView>
        </Rows>
      );
    }

    const app = renderStatic(<ScrollablePosition />, {
      width: 8,
      height: 3,
    });
    try {
      expect(app.keyDown({ key: "Tab" }).defaultPrevented).toBe(true);
      expect(app.keyDown({ key: "ArrowDown" }).defaultPrevented).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(app.getText().split("\n")[0]).toBe("Offset 1");
      expect(events).toEqual([
        {
          previousOffset: { x: 0, y: 0 },
          offset: { x: 0, y: 1 },
          deltaX: 0,
          deltaY: 1,
        },
      ]);
    } finally {
      app.unmount();
    }
  });

  it("keeps retained focus visible across geometry changes without wheel snapback", () => {
    const onScroll = vi.fn((event: ScrollUiEvent) => recordScroll(event));
    const cards = Array.from({ length: 53 }, (_, index) => {
      const details = Array.from(
        { length: (index % 4) + 1 },
        (_, line) => `Group ${index + 1} detail ${line + 1}`,
      );
      return (
        <Rows key={index} gap={1}>
          <Text>{[`Group ${index + 1}`, ...details].join("\\n")}</Text>
          {index === 52 ? (
            <Box
              focusable
              accessibleLabel="Finish rationale · Group 53"
              focusStyle={{ background: "focus" }}
            >
              <Text>Finish rationale · Group 53</Text>
            </Box>
          ) : undefined}
          {index === 52 ? (
            <Text>
              {Array.from(
                { length: 12 },
                (_, line) => `Group 53 trailing detail ${line + 1}`,
              ).join("\\n")}
            </Text>
          ) : undefined}
        </Rows>
      );
    });
    const mount = new SemanticMount({ size: { width: 160, height: 55 } });
    mount.render(
      <Rows tracks={[6, "1fr", 13]}>
        <Text>Review header</Text>
        <ScrollView axis="y" accessibleLabel="Audio groups" onScroll={onScroll}>
          <Rows gap={1}>{cards}</Rows>
        </ScrollView>
        <Text>Review footer</Text>
      </Rows>,
    );

    try {
      const tree = mount.frame().root;
      const target = walkTree(tree).find(
        (node) =>
          node.kind === "box" &&
          node.accessibleLabel === "Finish rationale · Group 53",
      );
      const viewport = walkTree(tree).find(
        (node) => node.kind === "box" && node.accessibleLabel === "Audio groups",
      );
      expect(target?.kind).toBe("box");
      expect(viewport?.kind).toBe("box");
      if (target?.kind !== "box" || viewport?.kind !== "box") {
        throw new Error("The focused control or group viewport is missing.");
      }
      const targetId = target.id;
      const viewportId = viewport.id;
      const focusedControlIsVisible = (): boolean => {
        const currentTarget = walkTree(mount.frame().root).find(
          (node) => node.id === targetId,
        );
        if (currentTarget === undefined) return false;
        const targetIds = new Set(walkTree(currentTarget).map((node) => node.id));
        return mount.frame().scene.cells.some(
          (cell) =>
            cell.ownerId !== null &&
            targetIds.has(cell.ownerId) &&
            cell.style.background === "focus",
        );
      };
      const focusedId = () => mount.controller().snapshot().focusedId;
      const scrollOffset = () =>
        mount.controller().snapshot().offsets.get(viewportId)?.y ?? 0;

      expect(mount.controller().focus(targetId)).toBe(true);
      expect(focusedId()).toBe(targetId);
      expect(focusedControlIsVisible()).toBe(true);
      const largeOffset = scrollOffset();
      onScroll.mockClear();

      mount.setSize({ width: 80, height: 24 });
      expect(focusedId()).toBe(targetId);
      expect(focusedControlIsVisible()).toBe(true);
      expect(scrollOffset()).toBeGreaterThan(largeOffset);
      expect(onScroll.mock.results.map(({ value }) => value)).toEqual([
        {
          previousOffset: { x: 0, y: largeOffset },
          offset: { x: 0, y: scrollOffset() },
          deltaX: 0,
          deltaY: scrollOffset() - largeOffset,
        },
      ]);

      for (const size of [
        { width: 160, height: 55 },
        { width: 80, height: 24 },
      ]) {
        mount.setSize(size);
        expect(focusedId()).toBe(targetId);
        expect(focusedControlIsVisible()).toBe(true);
      }

      const layout = findLayoutNode(mount.frame().layout.root, viewportId);
      expect(layout).not.toBeNull();
      if (layout === null) throw new Error("The group viewport has no layout.");
      expect(
        mount.scroll({
          x: layout.frame.x + 1,
          y: layout.frame.y + 1,
          deltaX: 0,
          deltaY: -10000,
        }).handled,
      ).toBe(true);
      expect(focusedId()).toBe(targetId);
      expect(scrollOffset()).toBe(0);
      expect(focusedControlIsVisible()).toBe(false);

      mount.repaint();
      expect(focusedId()).toBe(targetId);
      expect(scrollOffset()).toBe(0);
      expect(focusedControlIsVisible()).toBe(false);

      mount.setSize({ width: 160, height: 55 });
      expect(focusedId()).toBe(targetId);
      expect(focusedControlIsVisible()).toBe(true);
    } finally {
      mount.unmount();
    }
  });
});
