import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import {
  ScrollView,
  Text,
  createTextSource,
  extendTextSourceSegment,
} from "../src/index.js";
import { SemanticMount } from "../src/internal/mount.js";
import { renderStatic } from "../src/testing.js";
import { renderEagerTextOracle } from "./support/eager-text-oracle.js";

const LONG_LINE =
  "0123456789".repeat(12) + "古e\u0301👩‍💻🇺🇳\t\u0001" + "界".repeat(12) + "tail";
const UNICODE_LINES =
  "古😀e\u0301\t\u0001👩‍💻🇺🇳界" +
  "\r\n" +
  "prefix-" +
  "界".repeat(8) +
  "\n" +
  "suffix-👩‍💻";

function compareWithOracle(
  sourceNode: ReactNode,
  text: string,
  size: { readonly width: number; readonly height: number },
  offsets: readonly { readonly x: number; readonly y: number }[] = [],
  referenceNode: ReactNode = <Text>{text}</Text>,
): void {
  const actual = new SemanticMount({ size });
  const reference = new SemanticMount({ size });
  actual.render(sourceNode);
  reference.render(referenceNode);
  try {
    const actualRoot = actual.frame().root;
    const referenceRoot = reference.frame().root;
    if (actualRoot.kind !== "box") {
      for (const offset of offsets) {
        expect(actual.setScrollOffset(actualRoot.id, offset)).toBe(false);
      }
    } else {
      for (const offset of offsets) {
        expect(actual.setScrollOffset(actualRoot.id, offset)).toBe(true);
        const expected = renderEagerTextOracle(
          referenceRoot,
          size,
          actual.controller().snapshot().offsets,
        );
        expect(actual.frame().layout).toEqual(expected.layout);
        expect(actual.frame().scene.cells).toEqual(expected.scene.cells);
      }
    }
    if (offsets.length === 0) {
      const expected = renderEagerTextOracle(referenceRoot, size);
      expect(actual.frame().layout).toEqual(expected.layout);
      expect(actual.frame().scene.cells).toEqual(expected.scene.cells);
    }
  } finally {
    actual.unmount();
    reference.unmount();
  }
}

describe("large text line rendering", () => {
  it.each([
    "clip",
    "ellipsis-start",
    "ellipsis-middle",
    "ellipsis-end",
  ] as const)(
    "matches eager output for %s at every horizontal alignment",
    (overflow) => {
      for (const align of ["start", "center", "end"] as const) {
        compareWithOracle(
          <Text overflow={overflow} align={{ x: align }}>
            {LONG_LINE}
          </Text>,
          LONG_LINE,
          { width: 7, height: 1 },
          [],
          <Text overflow={overflow} align={{ x: align }}>
            {LONG_LINE}
          </Text>,
        );
      }
    },
  );

  it("matches exact Unicode and alignment rules on every line mode", () => {
    for (const overflow of [
      "clip",
      "ellipsis-start",
      "ellipsis-middle",
      "ellipsis-end",
    ] as const) {
      for (const x of ["start", "center", "end"] as const) {
        for (const y of ["start", "center", "end"] as const) {
          compareWithOracle(
            <Text overflow={overflow} align={{ x, y }}>
              {UNICODE_LINES}
            </Text>,
            UNICODE_LINES,
            { width: 9, height: 4 },
            [],
            <Text overflow={overflow} align={{ x, y }}>
              {UNICODE_LINES}
            </Text>,
          );
        }
      }
    }
  });

  it("matches clip windows at Unicode and cell edges", () => {
    const text = "ab古e\u0301👩‍💻🇺🇳\t\u0001cd界ef";
    const actual = new SemanticMount({ size: { width: 7, height: 1 } });
    actual.render(
      <ScrollView axis="x">
        <Text>{text}</Text>
      </ScrollView>,
    );
    const reference = new SemanticMount({ size: { width: 7, height: 1 } });
    reference.render(
      <ScrollView axis="x">
        <Text>{text}</Text>
      </ScrollView>,
    );
    try {
      const root = actual.frame().root;
      if (root.kind !== "box") throw new Error("Expected scroll root.");
      const maximum = actual.frame().layout.root.contentSize.width - 7;
      for (const x of [0, 1, 2, 3, 4, 5, 6, 7, 8, maximum - 1, maximum]) {
        actual.setScrollOffset(root.id, { x, y: 0 });
        const expected = renderEagerTextOracle(
          reference.frame().root,
          { width: 7, height: 1 },
          actual.controller().snapshot().offsets,
        );
        expect(actual.frame().scene.cells).toEqual(expected.scene.cells);
      }
    } finally {
      actual.unmount();
      reference.unmount();
    }
  });

  it("keeps split source chunks equal to the eager string at deep clip edges", () => {
    let text = "x".repeat(255) + "ab\ud83d";
    let source = createTextSource([{ id: "line", text }]);
    const size = { width: 8, height: 2 };
    const actual = new SemanticMount({ size });
    actual.render(
      <ScrollView axis="x">
        <Text source={source} />
      </ScrollView>,
    );
    try {
      for (const delta of [
        "\ude00",
        "e",
        "\u0301",
        "👩‍",
        "💻",
        "🇺",
        "🇳",
        "\t\u0001界\r\nnext",
      ]) {
        source = extendTextSourceSegment(source, "line", delta);
        text += delta;
        actual.rerender(
          <ScrollView axis="x">
            <Text source={source} />
          </ScrollView>,
        );

        const reference = new SemanticMount({ size });
        reference.render(
          <ScrollView axis="x">
            <Text>{text}</Text>
          </ScrollView>,
        );
        try {
          const root = actual.frame().root;
          if (root.kind !== "box") throw new Error("Expected scroll root.");
          const maximum = Math.max(
            0,
            actual.frame().layout.root.contentSize.width - size.width,
          );
          for (const x of new Set(
            [0, 1, 252, 255, 256, maximum - 1, maximum].map((value) =>
              Math.max(0, Math.min(maximum, value)),
            ),
          )) {
            actual.setScrollOffset(root.id, { x, y: 0 });
            const expected = renderEagerTextOracle(
              reference.frame().root,
              size,
              actual.controller().snapshot().offsets,
            );
            expect(actual.frame().layout).toEqual(expected.layout);
            expect(actual.frame().scene.cells).toEqual(expected.scene.cells);
          }
        } finally {
          reference.unmount();
        }
      }
    } finally {
      actual.unmount();
    }
  });

  it("reuses an ellipsis preparation on later frames", () => {
    const text = "x".repeat(200_000) + "古e\u0301👩‍💻🇺🇳";
    const app = renderStatic(
      <Text overflow="ellipsis-middle" align={{ x: "end" }}>
        {text}
      </Text>,
      { width: 9, height: 1 },
    );
    try {
      const initial = app.getStageWorkCounts().scene;
      expect(initial.sourceCodeUnitsInspected).toBeLessThan(2_000);
      expect(initial.graphemesPrepared).toBeLessThan(2_000);
      app.clearWorkCounts();
      app.repaint();
      expect(app.getStageWorkCounts().scene).toMatchObject({
        sourceCodeUnitsInspected: 0,
        graphemesPrepared: 0,
      });
    } finally {
      app.unmount();
    }
  });
});
