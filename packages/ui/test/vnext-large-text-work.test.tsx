import { describe, expect, it } from "vitest";

import {
  Button,
  createTextSource,
  extendTextSourceSegment,
  replaceTextSourceSegment,
  Rows,
  ScrollView,
  Text,
  type TextSource,
} from "../src/index.js";
import { renderStatic } from "../src/testing.js";
import {
  LARGE_TEXT_BENCHMARK_V1,
  generateCorrelatedReplacementFixture,
  generateManyLineFixture,
  generateSingleLineFixture,
} from "./support/large-text-benchmark-v1.js";

const EMPTY_WORK_COUNTS = {
  sourceCodeUnitsInspected: 0,
  metadataRecordsSearched: 0,
  linesIndexed: 0,
  graphemesPrepared: 0,
  cellSlotsRetained: 0,
  copiedGlyphPayloadCodeUnitsRetained: 0,
  cellsPainted: 0,
  entriesDisposed: 0,
} as const;

describe("large text render work", () => {
  it("reports deterministic frame work and mount-local disposal", () => {
    const app = renderStatic(
      <ScrollView axis="y">
        <Text>{"one\ntwo\nthree"}</Text>
      </ScrollView>,
      { width: 5, height: 2 },
    );

    expect(app.getWorkCounts()).toEqual({
      sourceCodeUnitsInspected: 22,
      metadataRecordsSearched: 12,
      linesIndexed: 3,
      graphemesPrepared: 22,
      cellSlotsRetained: 11,
      copiedGlyphPayloadCodeUnitsRetained: 11,
      cellsPainted: 26,
      entriesDisposed: 0,
    });
    expect(app.getStageDurations()).toEqual({
      indexingMilliseconds: expect.any(Number),
      layoutMilliseconds: expect.any(Number),
      sceneMilliseconds: expect.any(Number),
    });
    const stageWork = app.getStageWorkCounts();
    expect(stageWork.indexing.linesIndexed).toBeGreaterThan(0);
    expect(stageWork.indexing.sourceCodeUnitsInspected).toBeGreaterThan(0);
    expect(stageWork.layout.cellsPainted).toBe(0);
    expect(stageWork.scene.graphemesPrepared).toBeGreaterThan(0);
    expect(stageWork.scene.cellsPainted).toBeGreaterThan(0);

    app.clearWorkCounts();
    expect(app.getStageDurations()).toEqual({
      indexingMilliseconds: 0,
      layoutMilliseconds: 0,
      sceneMilliseconds: 0,
    });
    app.repaint();
    expect(app.getWorkCounts()).toEqual({
      sourceCodeUnitsInspected: 0,
      metadataRecordsSearched: 0,
      linesIndexed: 0,
      graphemesPrepared: 0,
      cellSlotsRetained: 11,
      copiedGlyphPayloadCodeUnitsRetained: 11,
      cellsPainted: 26,
      entriesDisposed: 0,
    });

    app.clearWorkCounts();
    app.unmount();
    const disposed = {
      sourceCodeUnitsInspected: 0,
      metadataRecordsSearched: 0,
      linesIndexed: 0,
      graphemesPrepared: 0,
      cellSlotsRetained: 0,
      copiedGlyphPayloadCodeUnitsRetained: 0,
      cellsPainted: 0,
      entriesDisposed: 1,
    };
    expect(app.getWorkCounts()).toEqual(disposed);
    app.unmount();
    expect(app.getWorkCounts()).toEqual(disposed);
  });

  it("paints one scene pass for an unchanged 10-by-1 repaint", () => {
    const app = renderStatic(<Text>{"x"}</Text>, { width: 10, height: 1 });
    try {
      app.clearWorkCounts();
      app.repaint();
      expect(app.getWorkCounts().cellsPainted).toBe(11);
      expect(app.getText()).toBe("x         ");
    } finally {
      app.unmount();
    }
  });

  it("counts regular and overflow cells once in one frame", () => {
    const app = renderStatic(<Text>{"abc\ndefghijklmn"}</Text>, {
      width: 5,
      height: 2,
    });
    try {
      expect(app.getText()).toBe("abc  \ndefgh");
      const work = app.getWorkCounts();
      // Three regular cells for the fitting line plus five clipped cells for
      // the overflow line; each prepared cell is counted exactly once.
      expect(work.cellSlotsRetained).toBe(8);
      expect(work.copiedGlyphPayloadCodeUnitsRetained).toBe(8);
    } finally {
      app.unmount();
    }
  });

  it(
    "keeps an unchanged 667,633-code-unit repaint within one vertical window",
    { timeout: 30_000 },
    () => {
      const fixture = generateManyLineFixture(667_633);
      expect(fixture.length).toBe(667_633);

      const app = renderStatic(
        <ScrollView axis="y">
          <Text>{fixture}</Text>
        </ScrollView>,
        LARGE_TEXT_BENCHMARK_V1.viewport,
      );
      app.clearWorkCounts();
      app.repaint();
      const repaint = app.getWorkCounts();
      app.unmount();

      expect(repaint.linesIndexed).toBeLessThanOrEqual(
        LARGE_TEXT_BENCHMARK_V1.viewport.height * 3,
      );
    },
  );

  it(
    "keeps interaction-only frames free of indexing work on the exact fixture",
    { timeout: 30_000 },
    () => {
      const source = createTextSource([
        { id: "history", text: generateManyLineFixture(667_633) },
      ]);
      const app = renderStatic(
        <Rows tracks={[3, 1]}>
          <ScrollView axis="both" focusable accessibleLabel="transcript">
            <Text source={source} />
          </ScrollView>
          <Button label="Go" padding={0} onPress={() => {}} />
        </Rows>,
        { width: 40, height: 4 },
      );

      try {
        app.clearWorkCounts();
        for (let index = 0; index < 4; index += 1) {
          app.scroll({ x: 1, y: 1, deltaX: 0, deltaY: 1 });
          app.keyDown({ key: "Tab" });
          app.pointerMove({ x: 1, y: 1 });
          app.pointerMove({ x: 1, y: 3 });
          app.repaint();
        }

        const stages = app.getStageWorkCounts();
        // Retained content is indexed on React commits, never on controller
        // interactions or explicit repaints.
        expect(stages.indexing).toEqual(EMPTY_WORK_COUNTS);
        // Preferred sizes stay cached, so layout counts no text work either.
        expect(stages.layout).toEqual(EMPTY_WORK_COUNTS);
        expect(app.getWorkCounts().linesIndexed).toBe(0);
        expect(stages.scene.cellsPainted).toBeGreaterThan(0);
      } finally {
        app.unmount();
      }
    },
  );

  it("evicts visited vertical windows and preserves deep source windows", () => {
    const lines = Array.from(
      { length: 500 },
      (_, index) => `line-${String(index).padStart(3, "0")}|abcdefghij`,
    );
    const source = createTextSource([
      { id: "history", text: lines.join("\n") },
    ]);
    const app = renderStatic(
      <ScrollView axis="y">
        <Text source={source} />
      </ScrollView>,
      { width: 20, height: 4 },
    );
    const root = app.getLayout().root;
    const limit = 20 * 4 * 3;
    const offsets = [
      0,
      17,
      Math.floor((root.contentSize.height - root.contentFrame.height) / 2),
      root.contentSize.height - root.contentFrame.height,
    ];

    for (const offset of offsets) {
      app.setScrollOffset(root.nodeId, { x: 0, y: offset });
      const work = app.getWorkCounts();
      expect(work.cellSlotsRetained).toBeLessThanOrEqual(limit);
      expect(work.copiedGlyphPayloadCodeUnitsRetained).toBeLessThanOrEqual(
        limit,
      );
      const first = Math.min(offset, lines.length - 4);
      expect(app.getText()).toBe(
        lines
          .slice(first, first + 4)
          .map((line) => line.padEnd(20))
          .join("\n"),
      );
      app.clearWorkCounts();
    }
    app.unmount();
  });

  it("bounds clipped, horizontal, and two-axis prepared slots", () => {
    const horizontalSource = createTextSource([
      { id: "line", text: "0123456789".repeat(100) },
    ]);
    const horizontal = renderStatic(
      <ScrollView axis="x">
        <Text source={horizontalSource} />
      </ScrollView>,
      { width: 8, height: 4 },
    );
    const horizontalRoot = horizontal.getLayout().root;
    const horizontalText = "0123456789".repeat(100);
    for (const x of [0, 37, horizontalRoot.contentSize.width - 8]) {
      horizontal.setScrollOffset(horizontalRoot.nodeId, { x, y: 0 });
      expect(horizontal.getWorkCounts().cellSlotsRetained).toBeLessThanOrEqual(
        8 * 4 * 3,
      );
      expect(horizontal.getText().split("\n")[0]).toBe(
        horizontalText.slice(x, x + 8),
      );
    }
    horizontal.unmount();

    const bothSource = createTextSource([
      {
        id: "history",
        text: Array.from(
          { length: 100 },
          (_, index) => `${String(index).padStart(3, "0")}-` + "x".repeat(80),
        ).join("\n"),
      },
    ]);
    const both = renderStatic(
      <ScrollView axis="both">
        <Text source={bothSource} />
      </ScrollView>,
      { width: 8, height: 4 },
    );
    const bothRoot = both.getLayout().root;
    const bothLimit = 8 * 4 * 9;
    const maxX = bothRoot.contentSize.width - bothRoot.contentFrame.width;
    const maxY = bothRoot.contentSize.height - bothRoot.contentFrame.height;
    for (const offset of [
      { x: 0, y: 0 },
      { x: Math.floor(maxX / 2), y: Math.floor(maxY / 2) },
      { x: maxX, y: maxY },
    ]) {
      both.setScrollOffset(bothRoot.nodeId, offset);
      expect(both.getWorkCounts().cellSlotsRetained).toBeLessThanOrEqual(
        bothLimit,
      );
    }
    both.unmount();

    const clipped = renderStatic(<Text source={bothSource} />, {
      width: 8,
      height: 4,
    });
    expect(clipped.getWorkCounts().cellSlotsRetained).toBeLessThanOrEqual(
      8 * 4,
    );
    clipped.setSize({ width: 4, height: 2 });
    expect(clipped.getWorkCounts().cellSlotsRetained).toBeLessThanOrEqual(
      4 * 2,
    );
    clipped.unmount();
  });

  it("does not retain offscreen glyph payload or stale payload after eviction", () => {
    const combining = `e${"\u0301".repeat(20_000)}`;
    const source = createTextSource([
      {
        id: "history",
        text: [
          combining,
          "visible-1",
          "visible-2",
          "visible-3",
          "visible-4",
        ].join("\n"),
      },
    ]);
    const app = renderStatic(
      <ScrollView axis="y">
        <Text source={source} />
      </ScrollView>,
      { width: 12, height: 1 },
    );
    const initial = app.getWorkCounts();
    expect(initial.cellSlotsRetained).toBeLessThanOrEqual(12 * 1 * 3);
    expect(initial.copiedGlyphPayloadCodeUnitsRetained).toBeGreaterThan(
      initial.cellSlotsRetained,
    );

    const root = app.getLayout().root;
    app.setScrollOffset(root.nodeId, { x: 0, y: root.contentSize.height - 1 });
    const evicted = app.getWorkCounts();
    expect(evicted.cellSlotsRetained).toBeLessThanOrEqual(12 * 1 * 3);
    expect(evicted.copiedGlyphPayloadCodeUnitsRetained).toBeLessThan(
      initial.copiedGlyphPayloadCodeUnitsRetained,
    );
    app.unmount();

    const visible = createTextSource([{ id: "combining", text: combining }]);
    const combiningApp = renderStatic(<Text source={visible} />, {
      width: 12,
      height: 1,
    });
    const combiningWork = combiningApp.getWorkCounts();
    expect(combiningWork.cellSlotsRetained).toBe(1);
    expect(combiningWork.copiedGlyphPayloadCodeUnitsRetained).toBe(
      combining.length,
    );
    expect(combiningApp.getText().startsWith(combining)).toBe(true);
    combiningApp.unmount();
  });

  it("uses bounded source work for a deep horizontal offset", () => {
    const text = `${"x".repeat(200_000)}ENDMARK`;
    const source = createTextSource([{ id: "line", text }]);
    const app = renderStatic(
      <ScrollView axis="both">
        <Text source={source} />
      </ScrollView>,
      { width: 8, height: 1 },
    );
    const root = app.getLayout().root;
    app.clearWorkCounts();
    app.setScrollOffset(root.nodeId, {
      x: root.contentSize.width - root.contentFrame.width,
      y: 0,
    });
    const work = app.getWorkCounts();
    expect(work.sourceCodeUnitsInspected).toBeLessThan(1_000);
    expect(work.graphemesPrepared).toBeLessThan(1_000);
    expect(work.cellSlotsRetained).toBeLessThanOrEqual(8 * 1 * 9);
    expect(work.copiedGlyphPayloadCodeUnitsRetained).toBeLessThan(100);
    expect(app.getText()).toBe("xENDMARK");
    app.unmount();
  });

  it("reuses prepared overflow entries for a one-row movement", () => {
    const lines = Array.from(
      { length: 120 },
      (_, index) => `line-${String(index).padStart(3, "0")}-${"x".repeat(40)}`,
    );
    const lineCodeUnits = lines[0]?.length ?? 0;
    const app = renderStatic(
      <ScrollView axis="y">
        <Text>{lines.join("\n")}</Text>
      </ScrollView>,
      { width: 10, height: 2 },
    );
    const root = app.getLayout().root;
    try {
      app.setScrollOffset(root.nodeId, { x: 0, y: 60 });
      app.clearWorkCounts();
      expect(app.setScrollOffset(root.nodeId, { x: 0, y: 61 })).toBe(true);
      const work = app.getWorkCounts();
      // Only the line entering the bounded window is prepared; a
      // clear-and-prepare window would inspect all six retained lines.
      expect(work.sourceCodeUnitsInspected).toBe(lineCodeUnits);
      expect(work.graphemesPrepared).toBe(lineCodeUnits);
      expect(work.metadataRecordsSearched).toBeLessThanOrEqual(8);
      expect(work.cellSlotsRetained).toBeLessThanOrEqual(10 * 2 * 3);
      expect(work.copiedGlyphPayloadCodeUnitsRetained).toBeLessThanOrEqual(
        10 * 2 * 3,
      );
    } finally {
      app.unmount();
    }
  });

  it("reuses the prepared window intersection for a one-column movement", () => {
    const text = "x".repeat(4_096);
    const source = createTextSource([{ id: "line", text }]);
    const app = renderStatic(
      <ScrollView axis="x">
        <Text source={source} />
      </ScrollView>,
      { width: 10, height: 1 },
    );
    const root = app.getLayout().root;
    try {
      app.clearWorkCounts();
      app.setScrollOffset(root.nodeId, { x: 1_029, y: 0 });
      const fromScratch = app.getWorkCounts().sourceCodeUnitsInspected;
      expect(fromScratch).toBeGreaterThan(0);

      app.clearWorkCounts();
      expect(app.setScrollOffset(root.nodeId, { x: 1_030, y: 0 })).toBe(true);
      const reused = app.getWorkCounts();
      // The retained intersection keeps every prepared cell except the
      // entering strip; clearing the window would re-read the complete range.
      expect(reused.sourceCodeUnitsInspected).toBeGreaterThan(0);
      expect(reused.sourceCodeUnitsInspected).toBeLessThan(fromScratch);
      expect(reused.cellSlotsRetained).toBeLessThanOrEqual(10 * 1 * 3);
      expect(reused.copiedGlyphPayloadCodeUnitsRetained).toBeLessThanOrEqual(
        10 * 1 * 3,
      );
    } finally {
      app.unmount();
    }
  });

  it(
    "keeps one-row and one-column movement work bounded by the entering strip on the exact fixture",
    { timeout: 30_000 },
    () => {
      const manyLine = generateManyLineFixture(667_633);
      expect(manyLine.length).toBe(667_633);
      const rows = renderStatic(
        <ScrollView axis="y">
          <Text>{manyLine}</Text>
        </ScrollView>,
        LARGE_TEXT_BENCHMARK_V1.viewport,
      );
      const rowsRoot = rows.getLayout().root;
      try {
        rows.setScrollOffset(rowsRoot.nodeId, { x: 0, y: 1_600 });
        rows.clearWorkCounts();
        expect(rows.setScrollOffset(rowsRoot.nodeId, { x: 0, y: 1_601 })).toBe(
          true,
        );
        const rowWork = rows.getWorkCounts();
        expect(rowWork.sourceCodeUnitsInspected).toBeGreaterThan(0);
        expect(rowWork.sourceCodeUnitsInspected).toBeLessThanOrEqual(1_024);
        expect(rowWork.cellSlotsRetained).toBeLessThanOrEqual(
          LARGE_TEXT_BENCHMARK_V1.viewport.width *
            LARGE_TEXT_BENCHMARK_V1.viewport.height *
            3,
        );
      } finally {
        rows.unmount();
      }

      const singleLine = generateSingleLineFixture(667_633);
      expect(singleLine.length).toBe(667_633);
      const source = createTextSource([{ id: "line", text: singleLine }]);
      const columns = renderStatic(
        <ScrollView axis="x">
          <Text source={source} />
        </ScrollView>,
        LARGE_TEXT_BENCHMARK_V1.viewport,
      );
      const columnsRoot = columns.getLayout().root;
      try {
        columns.clearWorkCounts();
        columns.setScrollOffset(columnsRoot.nodeId, { x: 400_000, y: 0 });
        const fromScratch = columns.getWorkCounts().sourceCodeUnitsInspected;
        expect(fromScratch).toBeGreaterThan(0);
        columns.clearWorkCounts();
        expect(
          columns.setScrollOffset(columnsRoot.nodeId, { x: 400_001, y: 0 }),
        ).toBe(true);
        const columnWork = columns.getWorkCounts();
        expect(columnWork.sourceCodeUnitsInspected).toBeGreaterThan(0);
        expect(columnWork.sourceCodeUnitsInspected).toBeLessThan(fromScratch);
        expect(columnWork.cellSlotsRetained).toBeLessThanOrEqual(
          LARGE_TEXT_BENCHMARK_V1.viewport.width *
            LARGE_TEXT_BENCHMARK_V1.viewport.height *
            3,
        );
      } finally {
        columns.unmount();
      }
    },
  );

  it(
    "bounds a fixed correlated replacement independently of retained history",
    { timeout: 30_000 },
    () => {
      const inspected: number[] = [];
      for (const target of LARGE_TEXT_BENCHMARK_V1.retainedSizes) {
        const fixture = generateCorrelatedReplacementFixture(target);
        let source = createTextSource([
          { id: "history", text: fixture.history },
          { id: "replacement", text: fixture.replacement },
        ]);
        const app = renderStatic(
          <ScrollView axis="y">
            <Text source={source} />
          </ScrollView>,
          LARGE_TEXT_BENCHMARK_V1.viewport,
        );

        app.clearWorkCounts();
        source = replaceTextSourceSegment(
          source,
          "replacement",
          fixture.updates[0] ?? "",
        );
        app.rerender(
          <ScrollView axis="y">
            <Text source={source} />
          </ScrollView>,
        );
        const work = app.getWorkCounts();
        inspected.push(work.sourceCodeUnitsInspected);
        expect(work.linesIndexed).toBe(1);
        expect(work.sourceCodeUnitsInspected).toBeLessThanOrEqual(
          LARGE_TEXT_BENCHMARK_V1.replacementCodeUnits +
            LARGE_TEXT_BENCHMARK_V1.viewport.width *
              LARGE_TEXT_BENCHMARK_V1.viewport.height *
              4,
        );
        app.unmount();
      }

      expect(new Set(inspected)).toHaveProperty("size", 1);
    },
  );

  it("extends a non-final growing line with changed-input work only", () => {
    for (const size of [1_000, 100_000]) {
      let source = createTextSource([
        { id: "growing", text: "a".repeat(size) },
        { id: "later", text: "\nnext" },
      ]);
      const node = (updated: TextSource) => (
        <ScrollView axis="y">
          <Text source={updated} />
        </ScrollView>
      );
      const app = renderStatic(node(source), LARGE_TEXT_BENCHMARK_V1.viewport);

      try {
        app.clearWorkCounts();
        source = extendTextSourceSegment(source, "growing", "b");
        app.rerender(node(source));
        const indexing = app.getStageWorkCounts().indexing;
        expect(indexing.sourceCodeUnitsInspected).toBeLessThanOrEqual(16);
        expect(indexing.linesIndexed).toBe(0);
        expect(
          app
            .getTextIndexes()[0]
            ?.lines.map((line) => [line.start, line.end, line.width]),
        ).toEqual([
          [0, size + 1, size + 1],
          [size + 2, size + 6, 4],
        ]);
      } finally {
        app.unmount();
      }
    }
  });

  it("counts a retained pending grapheme when an extension indexes it", () => {
    const prefix = "x".repeat(300);
    const combining = `e${"\u0301".repeat(20_000)}`;
    let source = createTextSource([
      { id: "log", text: `${prefix}${combining}` },
    ]);
    const app = renderStatic(<Text source={source} />, {
      width: 12,
      height: 1,
    });

    try {
      expect(
        app.getStageWorkCounts().scene.sourceCodeUnitsInspected,
      ).toBeLessThan(1_000);
      app.clearWorkCounts();
      source = extendTextSourceSegment(source, "log", "z");
      app.rerender(<Text source={source} />);
      expect(app.getStageWorkCounts().indexing.sourceCodeUnitsInspected).toBe(
        combining.length + 1,
      );
      expect(
        app.getStageWorkCounts().scene.sourceCodeUnitsInspected,
      ).toBeLessThan(1_000);
    } finally {
      app.unmount();
    }
  });

  it("bounds metadata records searched for deep reads and early edits", () => {
    const comparisons: number[] = [];
    const deepSourceUnits: number[] = [];
    for (const size of [500, 8_000]) {
      const segments = Array.from({ length: size }, (_, index) => ({
        id: `line-${String(index).padStart(5, "0")}`,
        text: `line-${String(index).padStart(5, "0")}\n`,
      }));
      let source = createTextSource(segments);
      const node = (updated: TextSource) => (
        <ScrollView axis="y">
          <Text source={updated} />
        </ScrollView>
      );
      const app = renderStatic(node(source), { width: 20, height: 4 });

      try {
        const root = app.getLayout().root;
        app.clearWorkCounts();
        app.setScrollOffset(root.nodeId, {
          x: 0,
          y: Math.max(0, root.contentSize.height - 4),
        });
        const deepWork = app.getWorkCounts();
        expect(deepWork.metadataRecordsSearched).toBeGreaterThan(0);
        expect(deepWork.metadataRecordsSearched).toBeLessThan(4_096);
        deepSourceUnits.push(deepWork.sourceCodeUnitsInspected);

        app.clearWorkCounts();
        source = replaceTextSourceSegment(
          source,
          "line-00010",
          "changed-line\n",
        );
        app.rerender(node(source));
        const invalidation = app.getWorkCounts().metadataRecordsSearched;
        expect(invalidation).toBeGreaterThan(0);
        expect(invalidation).toBeLessThan(4_096);
        comparisons.push(invalidation);
      } finally {
        app.unmount();
      }
    }

    expect(comparisons[1]).toBeLessThanOrEqual((comparisons[0] ?? 0) + 256);
    expect(new Set(deepSourceUnits)).toHaveProperty("size", 1);
  });

  it("clears prepared state for an empty clip", () => {
    const source = createTextSource([{ id: "history", text: "offscreen" }]);
    const app = renderStatic(<Text source={source} />, { width: 8, height: 1 });
    expect(app.getWorkCounts().cellSlotsRetained).toBeGreaterThan(0);
    app.setSize({ width: 0, height: 0 });
    expect(app.getWorkCounts().cellSlotsRetained).toBe(0);
    expect(app.getWorkCounts().copiedGlyphPayloadCodeUnitsRetained).toBe(0);
    app.unmount();
  });
});
