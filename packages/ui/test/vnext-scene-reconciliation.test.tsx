import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button, Rows, ScrollView, Text } from "../src/index.js";
import { SemanticMount } from "../src/internal/mount.js";
import { walkTree, type SemanticNode } from "../src/internal/model.js";
import { sceneToText } from "../src/internal/scene.js";

function labelledNodeId(root: SemanticNode, label: string): number {
  const node = walkTree(root).find((entry) => entry.accessibleLabel === label);
  if (node === undefined) throw new Error(`Missing node labelled ${label}.`);
  return node.id;
}

describe("scene and controller reconciliation", () => {
  it("paints one scene and reuses it when the first reconciliation is stable", () => {
    const mount = new SemanticMount({
      size: { width: 5, height: 2 },
      measureWork: true,
    });
    mount.render(
      createElement(
        ScrollView,
        { axis: "y" },
        createElement(Text, null, "one\ntwo\nthree"),
      ),
    );

    try {
      mount.clearWorkCounts();
      mount.repaint();
      expect(mount.workCounts().cellsPainted).toBe(26);
      expect(sceneToText(mount.frame().scene)).toBe("one  \ntwo  ");
      expect(mount.controller().snapshot().offsets).toEqual(new Map());
    } finally {
      mount.unmount();
    }
  });

  it("corrects the scene once and attaches it for initial follow-end", () => {
    const mount = new SemanticMount({
      size: { width: 4, height: 2 },
      measureWork: true,
    });
    mount.render(
      createElement(
        ScrollView,
        { axis: "y", followEnd: true },
        createElement(Text, null, "AA\nBB\nCC\nDD"),
      ),
    );

    try {
      const root = mount.frame().root;
      if (root.kind !== "box") throw new Error("Expected a scroll root.");
      expect(mount.controller().snapshot().offsets.get(root.id)).toEqual({
        x: 0,
        y: 2,
      });
      expect(sceneToText(mount.frame().scene)).toBe("CC  \nDD  ");
      // One scene at the initial offset and one corrected scene at the end.
      expect(mount.workCounts().cellsPainted).toBe(2 * (8 + 8 + 4));
    } finally {
      mount.unmount();
    }
  });

  it("paints with the clamped offset after a resize", () => {
    const mount = new SemanticMount({ size: { width: 4, height: 2 } });
    mount.render(
      createElement(
        ScrollView,
        { axis: "y" },
        createElement(Text, null, "1\n2\n3\n4\n5\n6"),
      ),
    );

    try {
      const root = mount.frame().root;
      if (root.kind !== "box") throw new Error("Expected a scroll root.");
      expect(mount.setScrollOffset(root.id, { x: 0, y: 4 })).toBe(true);
      expect(sceneToText(mount.frame().scene)).toBe("5   \n6   ");

      mount.setSize({ width: 4, height: 4 });
      expect(mount.controller().snapshot().offsets.get(root.id)).toEqual({
        x: 0,
        y: 2,
      });
      expect(sceneToText(mount.frame().scene)).toBe("3   \n4   \n5   \n6   ");
    } finally {
      mount.unmount();
    }
  });

  it("paints focus and hover state exactly once per change", () => {
    const onPress = vi.fn();
    const mount = new SemanticMount({
      size: { width: 4, height: 1 },
      measureWork: true,
    });
    mount.render(createElement(Button, { label: "Go", padding: 0, onPress }));

    try {
      const root = mount.frame().root;
      const background = () => mount.frame().scene.cells[0]?.style.background;
      expect(background()).toBe("panel");

      mount.clearWorkCounts();
      expect(mount.pointerMove({ x: 1, y: 0 })).toEqual({
        handled: false,
        defaultPrevented: false,
      });
      expect(background()).toBe("selection");
      expect(mount.workCounts().cellsPainted).toBe(10);
      const textId = root.kind === "box" ? root.children[0]?.id : undefined;
      expect(mount.controller().eventTrace()).toEqual([
        { type: "pointerEnter", targetId: root.id, currentTargetId: root.id },
        { type: "pointerEnter", targetId: textId, currentTargetId: textId },
      ]);

      mount.clearWorkCounts();
      mount.pointerLeave({ x: -1, y: -1 });
      expect(background()).toBe("panel");
      expect(mount.workCounts().cellsPainted).toBe(10);

      mount.clearWorkCounts();
      expect(mount.keyDown({ key: "Tab" })).toEqual({
        handled: true,
        defaultPrevented: true,
      });
      expect(mount.controller().snapshot().focusedId).toBe(root.id);
      expect(background()).toBe("focus");
      expect(mount.workCounts().cellsPainted).toBe(10);

      mount.clearWorkCounts();
      mount.repaint();
      expect(background()).toBe("focus");
      expect(mount.workCounts().cellsPainted).toBe(10);
    } finally {
      mount.unmount();
    }
  });

  it("hit tests pointer input against the corrected follow-end scene", () => {
    const topPress = vi.fn();
    const middlePress = vi.fn();
    const bottomPress = vi.fn();
    const mount = new SemanticMount({ size: { width: 6, height: 2 } });
    mount.render(
      createElement(
        ScrollView,
        { axis: "y", followEnd: true },
        createElement(
          Rows,
          null,
          createElement(Button, {
            label: "Top",
            padding: 0,
            onPress: topPress,
          }),
          createElement(Button, {
            label: "Middle",
            padding: 0,
            onPress: middlePress,
          }),
          createElement(Button, {
            label: "Bottom",
            padding: 0,
            onPress: bottomPress,
          }),
        ),
      ),
    );

    try {
      const root = mount.frame().root;
      if (root.kind !== "box") throw new Error("Expected a scroll root.");
      expect(sceneToText(mount.frame().scene)).toBe("Middle\nBottom");
      expect(mount.controller().snapshot().offsets.get(root.id)).toEqual({
        x: 0,
        y: 1,
      });

      const bottomId = labelledNodeId(root, "Bottom");
      mount.pointerMove({ x: 1, y: 1 });
      mount.controller().clearEventTrace();
      mount.pointerDown({ x: 1, y: 1, button: 0 });
      mount.pointerUp({ x: 1, y: 1, button: 0 });

      expect(bottomPress).toHaveBeenCalledTimes(1);
      expect(middlePress).not.toHaveBeenCalled();
      expect(topPress).not.toHaveBeenCalled();
      expect(mount.controller().snapshot().focusedId).toBe(bottomId);
      expect(mount.controller().eventTrace()).toEqual([
        { type: "press", targetId: bottomId, currentTargetId: bottomId },
      ]);
    } finally {
      mount.unmount();
    }
  });

  it("notifies hosts once with the corrected follow-end frame", () => {
    const mount = new SemanticMount({ size: { width: 4, height: 2 } });
    const frames: string[] = [];
    mount.subscribe((frame) => frames.push(sceneToText(frame.scene)));
    mount.render(
      createElement(
        ScrollView,
        { axis: "y", followEnd: true },
        createElement(Text, null, "AA\nBB\nCC\nDD"),
      ),
    );

    try {
      expect(frames).toEqual(["CC  \nDD  "]);
    } finally {
      mount.unmount();
    }
  });

  it("releases state once when the React root is removed", () => {
    const mount = new SemanticMount({
      size: { width: 6, height: 1 },
      measureWork: true,
    });
    mount.render(createElement(Text, null, "gone"));

    try {
      expect(mount.textIndexes()).toHaveLength(1);
      mount.render(null);
      expect(mount.textIndexes()).toEqual([]);
      expect(mount.controller().snapshot()).toEqual({
        focusedId: null,
        hoveredIds: new Set(),
        offsets: new Map(),
      });
      expect(mount.workCounts().entriesDisposed).toBe(1);
      expect(() => mount.frame()).toThrow(/has not committed/u);
    } finally {
      mount.unmount();
    }
  });

  it("coalesces a reentrant React update during a frame notification", () => {
    const mount = new SemanticMount({ size: { width: 6, height: 1 } });
    const frames: string[] = [];
    mount.subscribe((frame) => {
      frames.push(sceneToText(frame.scene));
      if (frames.length === 1) {
        mount.rerender(createElement(Text, null, "second"));
      }
    });
    mount.render(createElement(Text, null, "first"));

    try {
      expect(frames).toEqual(["first ", "second"]);
      expect(sceneToText(mount.frame().scene)).toBe("second");
    } finally {
      mount.unmount();
    }
  });
});
