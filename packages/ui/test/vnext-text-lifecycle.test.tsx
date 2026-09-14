import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  Columns,
  Rows,
  ScrollView,
  Text,
  createTextSource,
  extendTextSourceSegment,
  replaceTextSourceSegment,
} from "../src/index.js";
import { SemanticMount } from "../src/internal/mount.js";
import { sceneToText } from "../src/internal/scene.js";
import { renderStatic } from "../src/testing.js";

function textNodeId(app: ReturnType<typeof renderStatic>): number {
  const index = app.getTextIndexes()[0];
  if (index === undefined) throw new Error("Expected one text index.");
  return index.nodeId;
}

describe("vNext text lifecycle ownership", () => {
  it("invalidates replacement metrics, cells, source roots, and scroll extent", () => {
    let source = createTextSource([
      {
        id: "history",
        text: `obsolete-wide\n${"x".repeat(20)}\nold`,
      },
    ]);
    const retiredSource =
      typeof WeakRef === "undefined" ? null : new WeakRef(source);
    const app = renderStatic(
      createElement(
        ScrollView,
        { axis: "both" },
        createElement(Text, { source }),
      ),
      { width: 8, height: 2 },
    );
    const scrollNodeId = app.getLayout().root.nodeId;
    const textId = textNodeId(app);

    try {
      expect(app.setScrollOffset(scrollNodeId, { x: 10, y: 10 })).toBe(true);
      expect(app.getLayout().root.contentSize).toEqual({
        width: 20,
        height: 3,
      });

      source = replaceTextSourceSegment(source, "history", "new\nvalue");
      app.clearWorkCounts();
      app.rerender(
        createElement(
          ScrollView,
          { axis: "both" },
          createElement(Text, { source }),
        ),
      );

      const index = app.getTextIndex(textId);
      if (index === null) throw new Error("Expected the replacement index.");
      expect(index.source).toBe(source);
      expect(index.sourceLength).toBe("new\nvalue".length);
      expect(index.lines.map((line) => line.width)).toEqual([3, 5]);
      expect(index.maxWidth).toBe(5);
      expect(index.currentLineWidth).toBe(5);
      expect(app.getLayout().root.contentSize).toEqual({
        width: 8,
        height: 2,
      });
      expect(sceneToText(app.getScene())).toBe("new     \nvalue   ");

      const work = app.getWorkCounts();
      expect(work.cellSlotsRetained).toBe(8);
      expect(work.copiedGlyphPayloadCodeUnitsRetained).toBe(8);
      if (retiredSource !== null) {
        // This identity probe does not wait for or schedule garbage collection.
        expect(retiredSource.deref()).not.toBe(index.source);
      }
    } finally {
      app.unmount();
    }
  });

  it("releases removed and unmounted text entries once", () => {
    const firstSource = createTextSource([{ id: "first", text: "first" }]);
    const mount = new SemanticMount({
      size: { width: 8, height: 2 },
      measureWork: true,
    });
    mount.render(
      createElement(
        Rows,
        null,
        createElement(Text, { key: "first", source: firstSource }),
        createElement(Text, { key: "second" }, "second"),
      ),
    );
    const root = mount.frame().root;
    if (root.kind !== "box") throw new Error("Expected a rows root.");
    const removedNode = root.children[0];
    if (removedNode?.kind !== "text") {
      throw new Error("Expected the first child to be text.");
    }

    mount.clearWorkCounts();
    mount.rerender(
      createElement(
        Rows,
        null,
        createElement(Text, { key: "second" }, "second"),
      ),
    );
    expect(mount.textIndexes()).toHaveLength(1);
    expect(removedNode.source).toBeNull();
    expect(removedNode.text).toBe("");
    expect(mount.workCounts().entriesDisposed).toBe(1);

    mount.repaint();
    expect(mount.workCounts().entriesDisposed).toBe(1);

    mount.unmount();
    expect(mount.workCounts().entriesDisposed).toBe(2);
    mount.unmount();
    expect(mount.workCounts().entriesDisposed).toBe(2);
  });

  it("cleans derived entries after a failed initial mount", () => {
    const mount = new SemanticMount({
      size: { width: 8, height: 1 },
      measureWork: true,
    });

    expect(() =>
      mount.render(
        createElement(
          Columns,
          { tracks: [] },
          createElement(Text, null, "retained before layout failure"),
        ),
      ),
    ).toThrow(/tracks/u);
    expect(mount.textIndexes()).toEqual([]);
    expect(mount.controller().snapshot().offsets).toEqual(new Map());
    expect(mount.workCounts().entriesDisposed).toBe(1);

    mount.unmount();
    expect(mount.workCounts().entriesDisposed).toBe(1);
  });

  it("keeps one mount independent while another mount is disposed", () => {
    const firstSource = createTextSource([
      { id: "first", text: "a0\na1\na2\na3" },
    ]);
    let secondSource = createTextSource([
      { id: "second", text: "b0\nb1\nb2\nb3" },
    ]);
    const first = renderStatic(
      createElement(
        ScrollView,
        { axis: "y" },
        createElement(Text, { source: firstSource }),
      ),
      { width: 4, height: 2 },
    );
    const second = renderStatic(
      createElement(
        ScrollView,
        { axis: "y" },
        createElement(Text, { source: secondSource }),
      ),
      { width: 4, height: 2 },
    );
    const secondScrollNodeId = second.getLayout().root.nodeId;

    try {
      expect(second.setScrollOffset(secondScrollNodeId, { x: 0, y: 1 })).toBe(
        true,
      );
      const before = {
        text: second.getText(),
        layout: second.getLayout(),
        index: second.getTextIndexes(),
      };

      first.unmount();
      first.unmount();

      expect(second.getText()).toBe(before.text);
      expect(second.getLayout()).toEqual(before.layout);
      expect(second.getTextIndexes()).toEqual(before.index);

      secondSource = extendTextSourceSegment(secondSource, "second", "\nb4");
      second.rerender(
        createElement(
          ScrollView,
          { axis: "y" },
          createElement(Text, { source: secondSource }),
        ),
      );
      expect(second.getText()).toBe("b1  \nb2  ");
      const updatedIndex = second.getTextIndex(textNodeId(second));
      expect(updatedIndex?.source).toBe(secondSource);
    } finally {
      second.unmount();
    }
  });
});
