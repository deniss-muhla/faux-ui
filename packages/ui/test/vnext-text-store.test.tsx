import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  appendTextSourceSegment,
  Button,
  createTextSource,
  extendTextSourceSegment,
  replaceTextSourceSegment,
  Rows,
  ScrollView,
  Text,
  type TextSource,
} from "@faux-ui/ui";
import { inspectTextSource, renderStatic } from "@faux-ui/ui/testing";

import { SemanticMount } from "../src/internal/mount.js";
import {
  eagerTextIndex,
  renderEagerTextOracle,
  type EagerTextLineIndex,
} from "./support/eager-text-oracle.js";
import type {
  TextIndexSnapshot,
  TextLineIndex,
} from "../src/internal/text-store.js";

const NON_FINAL_SIZE = { width: 24, height: 2 } as const;

function onlyIndex(app: ReturnType<typeof renderStatic>): TextIndexSnapshot {
  const indexes = app.getTextIndexes();
  expect(indexes).toHaveLength(1);
  const index = indexes[0];
  if (index === undefined) throw new Error("Expected one text index.");
  return index;
}

function assertMatchesEager(index: TextIndexSnapshot, text: string): void {
  const expected = eagerTextIndex(text);
  expect(index.sourceLength).toBe(text.length);
  expect(index.lineCount).toBe(expected.length);
  expect(index.lines.map(compactLine)).toEqual(expected.map(compactLine));
  expect(index.maxWidth).toBe(
    expected.reduce((maximum, line) => Math.max(maximum, line.width), 0),
  );
  expect(index.currentLineWidth).toBe(expected.at(-1)?.width ?? 0);
}

function compactLine(line: TextLineIndex | EagerTextLineIndex) {
  return {
    start: line.start,
    end: line.end,
    newlineStart: line.newlineStart,
    newlineEnd: line.newlineEnd,
    width: line.width,
  };
}

function renderString(text: string) {
  return renderStatic(<Text>{text}</Text>, { width: 32, height: 8 });
}

function renderSource(source: Parameters<typeof renderStatic>[0]) {
  return renderStatic(source, { width: 32, height: 8 });
}

function sourceNode(source: TextSource) {
  return (
    <ScrollView axis="y">
      <Text source={source} />
    </ScrollView>
  );
}

function referenceNode(text: string) {
  return (
    <ScrollView axis="y">
      <Text>{text}</Text>
    </ScrollView>
  );
}

function onlyMountIndex(actual: SemanticMount): TextIndexSnapshot {
  const indexes = actual.textIndexes();
  expect(indexes).toHaveLength(1);
  const index = indexes[0];
  if (index === undefined) throw new Error("Expected one text index.");
  return index;
}

function assertEagerFrames(
  actual: SemanticMount,
  reference: SemanticMount,
): void {
  const root = actual.frame().root;
  const layout = actual.frame().layout;
  const maxX = Math.max(
    0,
    layout.root.contentSize.width - layout.root.contentFrame.width,
  );
  const maxY = Math.max(
    0,
    layout.root.contentSize.height - layout.root.contentFrame.height,
  );
  expect(maxY).toBeGreaterThan(0);
  for (const requested of [
    { x: 0, y: 0 },
    { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
  ]) {
    const target = {
      x: Math.min(requested.x, maxX),
      y: Math.min(requested.y, maxY),
    };
    actual.setScrollOffset(root.id, target);
    const expected = renderEagerTextOracle(
      reference.frame().root,
      NON_FINAL_SIZE,
      actual.controller().snapshot().offsets,
    );
    expect(actual.frame().layout).toEqual(expected.layout);
    expect(actual.frame().scene.cells).toEqual(expected.scene.cells);
  }
}

describe("mount-owned text store", () => {
  it.each([
    ["empty text", ""],
    ["trailing newline", "alpha\n"],
    ["CRLF", "alpha\r\nbeta\r\n"],
    ["many lines", "one\ntwo\nthree\nfour"],
    ["tabs", "a\tb\t古"],
    ["controls", "a\u0001b\u0007c"],
    ["combining marks", "e\u0301 n\u0323\u0302"],
    ["ZWJ sequence", "A👩‍💻B"],
    ["regional indicators", "A🇺🇳B"],
  ])("indexes %s with eager line ranges and widths", (_name, text) => {
    const app = renderString(text);
    try {
      assertMatchesEager(onlyIndex(app), text);
    } finally {
      app.unmount();
    }
  });

  it("keeps source ranges across split Unicode boundaries", () => {
    const app = renderSource(<Text source={createTextSource()} />);
    try {
      let source = createTextSource([{ id: "log", text: "prefix-\ud83d" }]);
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), "prefix-\ud83d");
      expect(onlyIndex(app).unfinishedGrapheme?.range).toEqual({
        start: 7,
        end: 8,
      });

      source = extendTextSourceSegment(source, "log", "\ude00");
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), "prefix-😀");
      expect(onlyIndex(app).unfinishedGrapheme?.range).toEqual({
        start: 7,
        end: 9,
      });

      source = replaceTextSourceSegment(source, "log", "e");
      app.rerender(<Text source={source} />);
      source = extendTextSourceSegment(source, "log", "\u0301");
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), "e\u0301");

      source = replaceTextSourceSegment(source, "log", "👩");
      app.rerender(<Text source={source} />);
      source = extendTextSourceSegment(source, "log", "‍");
      app.rerender(<Text source={source} />);
      source = extendTextSourceSegment(source, "log", "💻");
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), "👩‍💻");

      source = replaceTextSourceSegment(source, "log", "🇺");
      app.rerender(<Text source={source} />);
      source = extendTextSourceSegment(source, "log", "🇳");
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), "🇺🇳");
      expect(onlyIndex(app).boundaryState.trailingRegionalIndicatorCount).toBe(
        2,
      );
    } finally {
      app.unmount();
    }
  });

  it("continues one growing line and appends complete lines", () => {
    let source = createTextSource([{ id: "growing", text: "head" }]);
    const app = renderSource(<Text source={source} />);
    try {
      const delta = "0123456789abcdef".repeat(4);
      for (let update = 0; update < 4; update += 1) {
        source = extendTextSourceSegment(source, "growing", delta);
        app.rerender(<Text source={source} />);
        assertMatchesEager(onlyIndex(app), sourceText(source));
      }

      source = appendTextSourceSegment(source, {
        id: "lines",
        text: "\nnext\nlast",
      });
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), sourceText(source));
      expect(onlyIndex(app).lines.map((line) => line.sourceRange)).toEqual([
        { start: 0, end: 260 },
        { start: 261, end: 265 },
        { start: 266, end: 270 },
      ]);
    } finally {
      app.unmount();
    }
  });

  it("updates the maximum when an appended line is finalized", () => {
    let source = createTextSource([{ id: "log", text: "a" }]);
    const app = renderSource(<Text source={source} />);
    try {
      source = appendTextSourceSegment(source, {
        id: "long-line",
        text: "\n" + "z".repeat(20),
      });
      app.rerender(<Text source={source} />);
      const index = onlyIndex(app);
      assertMatchesEager(index, sourceText(source));
      expect(index.maxWidth).toBe(20);
    } finally {
      app.unmount();
    }
  });

  it("reuses preferred metrics for unchanged ordinary strings", () => {
    const app = renderString("古\n👩‍💻");

    try {
      const preferred = app.getLayout().preferred;
      app.clearWorkCounts();
      app.repaint();
      expect(app.getStageWorkCounts().indexing).toMatchObject({
        sourceCodeUnitsInspected: 0,
        linesIndexed: 0,
        graphemesPrepared: 0,
      });
      expect(app.getLayout().preferred).toEqual(preferred);
    } finally {
      app.unmount();
    }
  });

  it("uses exact Unicode metrics for preferred geometry under vertical scroll", () => {
    const source = createTextSource([{ id: "log", text: "古\nx" }]);
    const app = renderStatic(
      <ScrollView axis="y">
        <Text source={source} align={{ x: "end", y: "center" }} />
      </ScrollView>,
      { width: 1, height: 1 },
    );

    try {
      const index = onlyIndex(app);
      expect(index.maxWidth).toBe(2);
      expect(index.lineCount).toBe(2);
      expect(app.getLayout().preferred.children[0]?.size).toEqual({
        width: 2,
        height: 2,
      });
      expect(app.getLayout().root.contentSize).toEqual({
        width: 1,
        height: 2,
      });
      expect(app.getLayout().root.children[0]?.frame).toEqual({
        x: 0,
        y: 0,
        width: 1,
        height: 2,
      });
      expect(index.source).toBe(source);
    } finally {
      app.unmount();
    }
  });

  it("reuses preferred metrics and indexes only an appended boundary", () => {
    let source = createTextSource([
      { id: "log", text: `${"finalized\n".repeat(128)}tail` },
    ]);
    const app = renderSource(<Text source={source} />);

    try {
      const initialPreferred = app.getLayout().preferred;
      app.clearWorkCounts();
      app.repaint();
      const repaintIndexing = app.getStageWorkCounts().indexing;
      expect(repaintIndexing.sourceCodeUnitsInspected).toBe(0);
      expect(repaintIndexing.linesIndexed).toBe(0);
      expect(repaintIndexing.graphemesPrepared).toBe(0);
      expect(app.getLayout().preferred).toEqual(initialPreferred);

      const sameLineDelta = "0123456789";
      source = extendTextSourceSegment(source, "log", sameLineDelta);
      app.clearWorkCounts();
      app.rerender(<Text source={source} />);
      const sameLineIndexing = app.getStageWorkCounts().indexing;
      expect(sameLineIndexing.sourceCodeUnitsInspected).toBe(
        sameLineDelta.length + 1,
      );
      expect(sameLineIndexing.linesIndexed).toBe(0);
      expect(sameLineIndexing.graphemesPrepared).toBeLessThanOrEqual(
        sameLineDelta.length + 1,
      );
      expect(onlyIndex(app).source).toBe(source);
      expect(app.getLayout().preferred.size).toEqual({
        width: 14,
        height: 129,
      });

      const lineDelta = "\nnew";
      source = extendTextSourceSegment(source, "log", lineDelta);
      app.clearWorkCounts();
      app.rerender(<Text source={source} />);
      const appendedLineIndexing = app.getStageWorkCounts().indexing;
      expect(appendedLineIndexing.sourceCodeUnitsInspected).toBe(
        lineDelta.replace("\n", "").length,
      );
      expect(appendedLineIndexing.linesIndexed).toBe(1);
      expect(appendedLineIndexing.graphemesPrepared).toBeLessThanOrEqual(
        lineDelta.length + 1,
      );
      expect(onlyIndex(app).source).toBe(source);
      expect(app.getLayout().preferred.size).toEqual({
        width: 14,
        height: 130,
      });
    } finally {
      app.unmount();
    }
  });

  it("extends and replaces an earlier growing-line segment with eager-exact state", () => {
    for (const size of [1_000, 100_000]) {
      let source = createTextSource([
        { id: "growing", text: `${"a".repeat(size - 2)}古` },
        { id: "later", text: "\nnext-line\ntail-line" },
      ]);
      const actual = new SemanticMount({
        size: NON_FINAL_SIZE,
        measureWork: true,
      });
      const reference = new SemanticMount({ size: NON_FINAL_SIZE });
      const rerender = (next: TextSource): void => {
        actual.rerender(sourceNode(next));
        reference.rerender(referenceNode(sourceText(next)));
      };
      const assertState = (): void => {
        assertMatchesEager(onlyMountIndex(actual), sourceText(source));
        assertEagerFrames(actual, reference);
      };
      actual.render(sourceNode(source));
      reference.render(referenceNode(sourceText(source)));

      try {
        assertState();

        source = extendTextSourceSegment(source, "growing", "b");
        rerender(source);
        assertState();

        source = extendTextSourceSegment(source, "growing", "c\u0301");
        rerender(source);
        assertState();

        source = extendTextSourceSegment(source, "growing", "\nsecond-window");
        rerender(source);
        assertState();

        const sameShape = `${"q".repeat(size - 2)}古bc\u0301\nsecond-window`;
        source = replaceTextSourceSegment(source, "growing", sameShape);
        rerender(source);
        assertState();

        source = replaceTextSourceSegment(
          source,
          "growing",
          `${"z".repeat(size)}古e\u0301`,
        );
        rerender(source);
        assertState();
      } finally {
        actual.unmount();
        reference.unmount();
      }
    }
  }, 30_000);

  it("keeps a non-final segment non-final after appending a later segment", () => {
    let source = createTextSource([{ id: "growing", text: "a".repeat(1_500) }]);
    const app = renderSource(sourceNode(source));
    try {
      assertMatchesEager(onlyIndex(app), sourceText(source));
      source = appendTextSourceSegment(source, {
        id: "later",
        text: "\nnext-line",
      });
      app.rerender(sourceNode(source));
      assertMatchesEager(onlyIndex(app), sourceText(source));

      const index = onlyIndex(app);
      expect(index.lines.map((line) => line.sourceRange)).toEqual([
        { start: 0, end: 1_500 },
        { start: 1_501, end: 1_510 },
      ]);

      source = extendTextSourceSegment(source, "growing", "b\u0301");
      app.rerender(sourceNode(source));
      assertMatchesEager(onlyIndex(app), sourceText(source));
    } finally {
      app.unmount();
    }
  });

  it("resumes a non-final extension at split Unicode boundaries", () => {
    const pairs = [
      ["\ud83d", "\ude00"],
      ["e", "\u0301"],
      ["👩‍", "💻"],
      ["🇺", "🇳"],
      ["x", "\t"],
    ] as const;

    for (const [left, right] of pairs) {
      let source = createTextSource([
        { id: "left", text: `head${left}` },
        { id: "right", text: `${right}tail` },
      ]);
      const app = renderSource(sourceNode(source));
      try {
        assertMatchesEager(onlyIndex(app), sourceText(source));
        source = extendTextSourceSegment(source, "left", "mid");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));
        source = extendTextSourceSegment(source, "left", "z\u0301");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));
        expect(onlyIndex(app).sourceLength).toBe(sourceText(source).length);
      } finally {
        app.unmount();
      }
    }
  });

  it("extends a non-final segment whose line continues across segments", () => {
    for (const size of [1_000, 100_000]) {
      let source = createTextSource([
        { id: "first", text: "a".repeat(size) },
        { id: "second", text: `${"b".repeat(64)}\nthird-line` },
      ]);
      const app = renderSource(sourceNode(source));
      try {
        assertMatchesEager(onlyIndex(app), sourceText(source));

        source = extendTextSourceSegment(source, "first", "x");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));
        expect(onlyIndex(app).lines.map((line) => line.width)).toEqual([
          size + 1 + 64,
          10,
        ]);

        source = extendTextSourceSegment(source, "first", "\nnew-line");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));

        source = replaceTextSourceSegment(source, "second", "changed\ntail");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));
      } finally {
        app.unmount();
      }
    }
  }, 30_000);

  it("extends a non-final segment within one shared line", () => {
    for (const size of [1_000, 100_000]) {
      let source = createTextSource([
        { id: "first", text: "a".repeat(size) },
        { id: "empty", text: "" },
        { id: "second", text: "b".repeat(64) },
        { id: "third", text: "c".repeat(32) },
      ]);
      const app = renderSource(sourceNode(source));
      try {
        assertMatchesEager(onlyIndex(app), sourceText(source));

        source = extendTextSourceSegment(source, "first", "x");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));
        expect(onlyIndex(app).maxWidth).toBe(size + 1 + 64 + 32);

        source = extendTextSourceSegment(source, "empty", "y\u0301");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));

        source = extendTextSourceSegment(source, "first", "z");
        app.rerender(sourceNode(source));
        assertMatchesEager(onlyIndex(app), sourceText(source));
      } finally {
        app.unmount();
      }
    }
  }, 30_000);

  it("resets and reindexes an edit before a later append point", () => {
    let source = createTextSource([
      { id: "prefix", text: "old\n" },
      { id: "tail", text: "tail" },
    ]);
    const app = renderSource(<Text source={source} />);
    try {
      assertMatchesEager(onlyIndex(app), sourceText(source));
      const beforeIdentity = onlyIndex(app).sourceIdentity;

      source = replaceTextSourceSegment(source, "prefix", "new\nchanged\n");
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), "new\nchanged\ntail");
      expect(onlyIndex(app).source).toBe(source);
      expect(onlyIndex(app).sourceIdentity).not.toBe(beforeIdentity);

      source = createTextSource([{ id: "reset", text: "reset\nvalue" }]);
      app.rerender(<Text source={source} />);
      assertMatchesEager(onlyIndex(app), "reset\nvalue");
      expect(onlyIndex(app).source).toBe(source);
    } finally {
      app.unmount();
    }
  });

  it("reconciles a batched source commit without reindexing retained history", () => {
    const inspected: number[] = [];
    const searched: number[] = [];
    for (const size of [1_000, 100_000]) {
      let source = createTextSource([
        { id: "growing", text: `${`a`.repeat(size - 2)}古` },
        { id: "later", text: "\nnext-line\ntail-line" },
      ]);
      const actual = new SemanticMount({
        size: NON_FINAL_SIZE,
        measureWork: true,
      });
      const reference = new SemanticMount({ size: NON_FINAL_SIZE });
      actual.render(sourceNode(source));
      reference.render(referenceNode(sourceText(source)));

      try {
        assertEagerFrames(actual, reference);
        actual.clearWorkCounts();

        source = appendTextSourceSegment(source, {
          id: "one",
          text: "\nsegment-one",
        });
        source = appendTextSourceSegment(source, {
          id: "two",
          text: "\nsegment-two",
        });
        source = extendTextSourceSegment(source, "growing", "b\u0301");
        source = extendTextSourceSegment(source, "growing", "c");
        actual.rerender(sourceNode(source));
        reference.rerender(referenceNode(sourceText(source)));

        assertMatchesEager(onlyMountIndex(actual), sourceText(source));
        assertEagerFrames(actual, reference);
        const indexing = actual.stageWorkCounts().indexing;
        expect(onlyMountIndex(actual).source).toBe(source);
        expect(indexing.linesIndexed).toBe(2);
        expect(indexing.sourceCodeUnitsInspected).toBeLessThan(64);
        expect(indexing.metadataRecordsSearched).toBeLessThan(512);
        inspected.push(indexing.sourceCodeUnitsInspected);
        searched.push(indexing.metadataRecordsSearched);
      } finally {
        actual.unmount();
        reference.unmount();
      }
    }

    expect(new Set(inspected)).toHaveProperty("size", 1);
    expect(new Set(searched)).toHaveProperty("size", 1);
  });

  it("extends one final segment through a batched commit without rescanning", () => {
    const inspected: number[] = [];
    for (const size of [1_000, 100_000]) {
      let source = createTextSource([
        {
          id: "growing",
          text: `${"a".repeat(size - 2)}古\nsecond-line\nthird-line`,
        },
      ]);
      const actual = new SemanticMount({
        size: NON_FINAL_SIZE,
        measureWork: true,
      });
      const reference = new SemanticMount({ size: NON_FINAL_SIZE });
      actual.render(sourceNode(source));
      reference.render(referenceNode(sourceText(source)));

      try {
        actual.clearWorkCounts();
        source = extendTextSourceSegment(source, "growing", "b\u0301");
        source = extendTextSourceSegment(source, "growing", "c");
        actual.rerender(sourceNode(source));
        reference.rerender(referenceNode(sourceText(source)));

        assertMatchesEager(onlyMountIndex(actual), sourceText(source));
        assertEagerFrames(actual, reference);
        const indexing = actual.stageWorkCounts().indexing;
        expect(indexing.sourceCodeUnitsInspected).toBeLessThan(32);
        expect(indexing.linesIndexed).toBe(0);
        expect(indexing.metadataRecordsSearched).toBeLessThan(512);
        inspected.push(indexing.sourceCodeUnitsInspected);
      } finally {
        actual.unmount();
        reference.unmount();
      }
    }

    expect(new Set(inspected)).toHaveProperty("size", 1);
  });

  it("indexes only appended complete lines after one batched commit", () => {
    const inspected: number[] = [];
    const searched: number[] = [];
    for (const size of [1_000, 100_000]) {
      const block = "history-block-000\n";
      const history = block.repeat(Math.ceil(size / block.length));
      let source = createTextSource([{ id: "history", text: history }]);
      const actual = new SemanticMount({
        size: NON_FINAL_SIZE,
        measureWork: true,
      });
      const reference = new SemanticMount({ size: NON_FINAL_SIZE });
      actual.render(sourceNode(source));
      reference.render(referenceNode(sourceText(source)));

      try {
        actual.clearWorkCounts();
        source = appendTextSourceSegment(source, {
          id: "added-a",
          text: "added-line-a\n",
        });
        source = appendTextSourceSegment(source, {
          id: "added-b",
          text: "added-line-b\n",
        });
        actual.rerender(sourceNode(source));
        reference.rerender(referenceNode(sourceText(source)));

        assertMatchesEager(onlyMountIndex(actual), sourceText(source));
        assertEagerFrames(actual, reference);
        const indexing = actual.stageWorkCounts().indexing;
        expect(indexing.sourceCodeUnitsInspected).toBe(24);
        expect(indexing.linesIndexed).toBe(2);
        // The comparison follows changed leaves and appended order nodes, so
        // no segment search grows with the retained history.
        expect(indexing.metadataRecordsSearched).toBeLessThan(512);
        inspected.push(indexing.sourceCodeUnitsInspected);
        searched.push(indexing.metadataRecordsSearched);
      } finally {
        actual.unmount();
        reference.unmount();
      }
    }

    expect(inspected).toEqual([24, 24]);
    expect(new Set(searched)).toHaveProperty("size", 1);
  });

  it(
    "extends a non-final growing segment across batched Unicode chunks",
    { timeout: 30_000 },
    () => {
      const pairs = [
        ["\ud83d", "\ude00"],
        ["e", "\u0301"],
        ["👩\u200d", "💻"],
        ["🇺", "🇳"],
      ] as const;
      const inspected: number[] = [];

      for (const [left, right] of pairs) {
        for (const size of [1_000, 100_000]) {
          let source = createTextSource([
            { id: "growing", text: `${`a`.repeat(size)}${left}` },
            { id: "later", text: "\nnext-line\ntail-line" },
          ]);
          const actual = new SemanticMount({
            size: NON_FINAL_SIZE,
            measureWork: true,
          });
          const reference = new SemanticMount({ size: NON_FINAL_SIZE });
          actual.render(sourceNode(source));
          reference.render(referenceNode(sourceText(source)));

          try {
            assertMatchesEager(onlyMountIndex(actual), sourceText(source));
            actual.clearWorkCounts();

            source = extendTextSourceSegment(source, "growing", right);
            source = extendTextSourceSegment(source, "growing", left);
            source = appendTextSourceSegment(source, {
              id: "one",
              text: "\nsegment-one",
            });
            source = appendTextSourceSegment(source, {
              id: "two",
              text: "\nsegment-two",
            });
            actual.rerender(sourceNode(source));
            reference.rerender(referenceNode(sourceText(source)));

            assertMatchesEager(onlyMountIndex(actual), sourceText(source));
            assertEagerFrames(actual, reference);
            const indexing = actual.stageWorkCounts().indexing;
            expect(indexing.sourceCodeUnitsInspected).toBeLessThan(128);
            expect(indexing.metadataRecordsSearched).toBeLessThan(512);
            inspected.push(indexing.sourceCodeUnitsInspected);
          } finally {
            actual.unmount();
            reference.unmount();
          }
        }
      }

      for (let index = 0; index < inspected.length; index += 2) {
        expect(inspected[index]).toBe(inspected[index + 1]);
      }
    },
  );

  it("rebuilds only the suffix after a mixed replace and append commit", () => {
    const lines = Array.from(
      { length: 200 },
      (_, index) => `line-${String(index).padStart(3, "0")}\n`,
    );
    let source = createTextSource(
      lines.map((text, index) => ({ id: `line-${index}`, text })),
    );
    const actual = new SemanticMount({
      size: NON_FINAL_SIZE,
      measureWork: true,
    });
    const reference = new SemanticMount({ size: NON_FINAL_SIZE });
    actual.render(sourceNode(source));
    reference.render(referenceNode(sourceText(source)));

    try {
      assertMatchesEager(onlyMountIndex(actual), sourceText(source));
      actual.clearWorkCounts();

      source = replaceTextSourceSegment(source, "line-150", "changed-150\n");
      source = appendTextSourceSegment(source, {
        id: "tail",
        text: "appended-tail\n",
      });
      actual.rerender(sourceNode(source));
      reference.rerender(referenceNode(sourceText(source)));

      assertMatchesEager(onlyMountIndex(actual), sourceText(source));
      assertEagerFrames(actual, reference);
      const indexing = actual.stageWorkCounts().indexing;
      expect(indexing.linesIndexed).toBeGreaterThan(0);
      expect(indexing.linesIndexed).toBeLessThanOrEqual(64);
      expect(indexing.sourceCodeUnitsInspected).toBeLessThan(1_200);

      actual.clearWorkCounts();
      source = replaceTextSourceSegment(source, "line-190", "changed-190-a\n");
      source = replaceTextSourceSegment(source, "line-190", "changed-190-b\n");
      actual.rerender(sourceNode(source));
      reference.rerender(referenceNode(sourceText(source)));

      assertMatchesEager(onlyMountIndex(actual), sourceText(source));
      assertEagerFrames(actual, reference);
      const replaceIndexing = actual.stageWorkCounts().indexing;
      expect(replaceIndexing.linesIndexed).toBeGreaterThan(0);
      expect(replaceIndexing.linesIndexed).toBeLessThanOrEqual(32);
      expect(replaceIndexing.sourceCodeUnitsInspected).toBeLessThan(512);
    } finally {
      actual.unmount();
      reference.unmount();
    }
  });

  it("reconciles a batched commit whose segment IDs share prefixes", () => {
    const segmentText = (name: string) => `${name}${"x".repeat(40)}\n`;
    let source = createTextSource([
      { id: "a", text: segmentText("alpha") },
      { id: "ab", text: segmentText("beta") },
      { id: "abc", text: segmentText("gamma") },
      { id: "abcd", text: segmentText("delta") },
    ]);
    const actual = new SemanticMount({
      size: NON_FINAL_SIZE,
      measureWork: true,
    });
    const reference = new SemanticMount({ size: NON_FINAL_SIZE });
    actual.render(sourceNode(source));
    reference.render(referenceNode(sourceText(source)));

    try {
      assertMatchesEager(onlyMountIndex(actual), sourceText(source));
      actual.clearWorkCounts();

      source = replaceTextSourceSegment(
        source,
        "abc",
        segmentText("changed-gamma"),
      );
      source = appendTextSourceSegment(source, {
        id: "abcde",
        text: segmentText("epsilon"),
      });
      actual.rerender(sourceNode(source));
      reference.rerender(referenceNode(sourceText(source)));

      assertMatchesEager(onlyMountIndex(actual), sourceText(source));
      assertEagerFrames(actual, reference);
      const indexing = actual.stageWorkCounts().indexing;
      expect(indexing.linesIndexed).toBeGreaterThan(0);
      expect(indexing.linesIndexed).toBeLessThanOrEqual(4);
      expect(indexing.sourceCodeUnitsInspected).toBeLessThan(180);
    } finally {
      actual.unmount();
      reference.unmount();
    }
  });

  it("releases a batched source update exactly once on unmount", () => {
    let source = createTextSource([{ id: "growing", text: "a".repeat(1_000) }]);
    const app = renderStatic(sourceNode(source), NON_FINAL_SIZE);

    source = appendTextSourceSegment(source, {
      id: "one",
      text: "\nsegment-one",
    });
    source = appendTextSourceSegment(source, {
      id: "two",
      text: "\nsegment-two",
    });
    source = extendTextSourceSegment(source, "growing", "b");
    source = extendTextSourceSegment(source, "growing", "c");
    app.rerender(sourceNode(source));
    app.clearWorkCounts();
    app.unmount();

    const disposed = app.getWorkCounts();
    expect(disposed.entriesDisposed).toBe(1);
    expect(disposed.cellSlotsRetained).toBe(0);
    expect(disposed.copiedGlyphPayloadCodeUnitsRetained).toBe(0);
    app.unmount();
    expect(app.getWorkCounts().entriesDisposed).toBe(1);
  });

  it("commits batched functional state updates through one source commit", async () => {
    const size = 100_000;
    const initial = createTextSource([
      { id: "growing", text: `${`a`.repeat(size - 2)}古` },
      { id: "later", text: "\nnext-line\ntail-line" },
    ]);
    const applied: TextSource[] = [];
    const rendered: TextSource[] = [];

    function BatchedSource() {
      const [source, setSource] = useState(initial);
      rendered.push(source);
      const stage = (update: (current: TextSource) => TextSource) => {
        return (current: TextSource) => {
          const next = update(current);
          applied.push(next);
          return next;
        };
      };
      return (
        <Rows tracks={[3, 1]}>
          <ScrollView axis="y">
            <Text source={source} />
          </ScrollView>
          <Button
            label="commit"
            padding={0}
            onPress={() => {
              setSource(
                stage((current) =>
                  appendTextSourceSegment(current, {
                    id: "one",
                    text: "\nsegment-one",
                  }),
                ),
              );
              setSource(
                stage((current) =>
                  appendTextSourceSegment(current, {
                    id: "two",
                    text: "\nsegment-two",
                  }),
                ),
              );
              setSource(
                stage((current) =>
                  extendTextSourceSegment(current, "growing", "b\u0301"),
                ),
              );
              setSource(
                stage((current) =>
                  extendTextSourceSegment(current, "growing", "c"),
                ),
              );
            }}
          />
        </Rows>
      );
    }

    const app = renderStatic(<BatchedSource />, { width: 24, height: 4 });
    try {
      app.clearWorkCounts();
      app.pointerDown({ x: 1, y: 3, button: 0 });
      app.pointerUp({ x: 1, y: 3, button: 0 });
      await new Promise((resolve) => setTimeout(resolve, 0));

      const finalSource = applied.at(-1);
      if (finalSource === undefined) {
        throw new Error("Expected the batched updaters to run.");
      }
      expect(applied.length).toBeGreaterThanOrEqual(4);
      expect(rendered[0]).toBe(initial);
      expect(rendered.at(-1)).toBe(finalSource);
      expect(
        rendered.filter((value) => value !== initial && value !== finalSource),
      ).toEqual([]);

      const index = app.getTextIndexes().find((entry) => entry.source !== null);
      if (index === undefined) throw new Error("Expected the source index.");
      const text = sourceText(finalSource);
      expect(index.source).toBe(finalSource);
      assertMatchesEager(index, text);
      const lines = text.split("\n");
      expect(app.getText()).toBe(
        [
          (lines[0] ?? "").slice(0, 24),
          (lines[1] ?? "").padEnd(24),
          (lines[2] ?? "").padEnd(24),
          "commit".padEnd(24),
        ].join("\n"),
      );
      expect(
        app.getStageWorkCounts().indexing.sourceCodeUnitsInspected,
      ).toBeLessThan(64);
    } finally {
      app.unmount();
    }
  });
});

function sourceText(source: TextSource): string {
  return inspectTextSource(source).text;
}
