import { describe, expect, it, vi } from "vitest";

import { ScrollView, Text } from "../src/index.js";
import { InteractionController } from "../src/internal/controller.js";
import { computeLayout } from "../src/internal/layout.js";
import {
  createBoxNode,
  createTextNode,
  replaceChildren,
  updateBoxNode,
  updateTextNode,
} from "../src/internal/model.js";
import { SemanticMount } from "../src/internal/mount.js";
import { paintScene, sceneToText } from "../src/internal/scene.js";
import { renderStatic } from "../src/testing.js";

const FIXTURE_LINES = [
  "Aabcde",
  "Bfghij",
  "Kklmno",
  "Pqrstu",
  "Vvwxyz",
  "Z01234",
  "!56789",
] as const;

const size = { width: 4, height: 2 } as const;

function fixtureText(lineCount: number): string {
  return FIXTURE_LINES.slice(0, lineCount).join("\n");
}

function attachText(root: ReturnType<typeof createBoxNode>, text: string) {
  const child = createTextNode(2, { text });
  replaceChildren(root, [child]);
  return child;
}

function updateController(
  controller: InteractionController,
  root: ReturnType<typeof createBoxNode>,
): void {
  const layout = computeLayout(root, size);
  controller.update(root, layout, paintScene(root, layout));
}

const followCases = [
  ["omitted", undefined, { x: 0, y: 0 }],
  ["false", false, { x: 0, y: 0 }],
  ["true", true, { x: 2, y: 2 }],
  ["x", "x", { x: 2, y: 0 }],
  ["y", "y", { x: 0, y: 2 }],
  ["both", "both", { x: 2, y: 2 }],
] as const;

describe("axis-specific follow-end", () => {
  it.each(followCases)(
    "follows the selected axes for %s",
    (_name, followEnd, expected) => {
      const root = createBoxNode(1, {
        scroll: "both",
        ...(followEnd === undefined ? {} : { followEnd }),
      });
      attachText(root, fixtureText(4));
      const controller = new InteractionController();

      updateController(controller, root);

      expect(
        controller.snapshot().offsets.get(root.id) ?? { x: 0, y: 0 },
      ).toEqual(expected);
    },
  );

  it.each([undefined, false] as const)(
    "does not follow either axis when followEnd is %s",
    (followEnd) => {
      const root = createBoxNode(1, {
        scroll: "both",
        ...(followEnd === undefined ? {} : { followEnd }),
      });
      const child = attachText(root, fixtureText(4));
      const controller = new InteractionController();

      updateController(controller, root);
      updateTextNode(child, { text: fixtureText(7) });
      updateController(controller, root);

      expect(
        controller.snapshot().offsets.get(root.id) ?? { x: 0, y: 0 },
      ).toEqual({ x: 0, y: 0 });
    },
  );

  it("normalizes named axes against the enabled scroll axes", () => {
    expect(
      createBoxNode(1, { scroll: "y", followEnd: "x" }).followEnd,
    ).toBeNull();
    expect(
      createBoxNode(1, { scroll: "x", followEnd: "y" }).followEnd,
    ).toBeNull();
    expect(createBoxNode(1, { scroll: "y", followEnd: "both" }).followEnd).toBe(
      "y",
    );

    const node = createBoxNode(1, { scroll: "y", followEnd: "x" });
    updateBoxNode(node, { scroll: "both", followEnd: "x" });
    expect(node.followEnd).toBe("x");
  });

  it("suspends and resumes vertical following without moving horizontal inspection", () => {
    const root = createBoxNode(1, { scroll: "both", followEnd: "y" });
    const child = attachText(root, fixtureText(4));
    const controller = new InteractionController();

    updateController(controller, root);
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 0, y: 2 });

    controller.setScrollOffset(root.id, { x: 1, y: 2 });
    updateTextNode(child, { text: fixtureText(5) });
    updateController(controller, root);
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 1, y: 3 });

    controller.setScrollOffset(root.id, { x: 1, y: 0 });
    updateTextNode(child, { text: fixtureText(6) });
    updateController(controller, root);
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 1, y: 0 });

    controller.setScrollOffset(root.id, { x: 1, y: 4 });
    updateTextNode(child, { text: fixtureText(7) });
    updateController(controller, root);
    expect(controller.snapshot().offsets.get(root.id)).toEqual({ x: 1, y: 5 });
  });

  it("keeps horizontal keyboard and wheel commands in the static trace", () => {
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();
    const onScroll = vi.fn();
    const app = renderStatic(
      <ScrollView
        axis="both"
        followEnd="y"
        focusable
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onScroll={onScroll}
      >
        <Text>{fixtureText(4)}</Text>
      </ScrollView>,
      size,
    );

    try {
      const scrollId = app.getLayout().root.nodeId;
      expect(app.getText()).toBe("Kklm\nPqrs");
      expect(app.keyDown({ key: "Tab" })).toEqual({
        handled: true,
        defaultPrevented: true,
      });
      expect(app.keyDown({ key: "ArrowRight" })).toEqual({
        handled: true,
        defaultPrevented: true,
      });
      expect(app.getText()).toBe("klmn\nqrst");
      expect(onScroll).toHaveBeenCalledTimes(1);

      expect(app.scroll({ x: 1, y: 1, deltaX: 1, deltaY: 0 })).toEqual({
        handled: true,
        defaultPrevented: true,
      });
      expect(app.getText()).toBe("lmno\nrstu");
      expect(onScroll).toHaveBeenCalledTimes(2);
      expect(
        onScroll.mock.calls.map(([event]) => ({
          previousOffset: event.previousOffset,
          offset: event.offset,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
        })),
      ).toEqual([
        {
          previousOffset: { x: 0, y: 2 },
          offset: { x: 1, y: 2 },
          deltaX: 1,
          deltaY: 0,
        },
        {
          previousOffset: { x: 1, y: 2 },
          offset: { x: 2, y: 2 },
          deltaX: 1,
          deltaY: 0,
        },
      ]);
      expect(app.getEventTrace()).toEqual([
        { type: "keyDown", targetId: scrollId, currentTargetId: scrollId },
        { type: "focus", targetId: scrollId, currentTargetId: scrollId },
        { type: "keyDown", targetId: scrollId, currentTargetId: scrollId },
        { type: "scroll", targetId: scrollId, currentTargetId: scrollId },
        { type: "scroll", targetId: scrollId, currentTargetId: scrollId },
      ]);
    } finally {
      app.unmount();
    }
  });

  it("applies y-only following through React updates", () => {
    const view = (lineCount: number) => (
      <ScrollView axis="both" followEnd="y">
        <Text>{fixtureText(lineCount)}</Text>
      </ScrollView>
    );
    const mount = new SemanticMount({ size });
    mount.render(view(4));

    try {
      const root = mount.frame().root;
      expect(root.kind).toBe("box");
      const scrollId = root.id;
      expect(mount.controller().snapshot().offsets.get(scrollId)).toEqual({
        x: 0,
        y: 2,
      });

      mount.setScrollOffset(scrollId, { x: 1, y: 2 });
      mount.rerender(view(5));
      expect(mount.controller().snapshot().offsets.get(scrollId)).toEqual({
        x: 1,
        y: 3,
      });
      expect(sceneToText(mount.frame().scene)).toBe("qrst\nvwxy");
    } finally {
      mount.unmount();
    }
  });
});
