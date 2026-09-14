import { describe, expect, it } from "vitest";

import { bunVersionAtLeast } from "../../../scripts/benchmark-v1-environment.js";
import {
  LARGE_TEXT_BENCHMARK_V1,
  LARGE_TEXT_BENCHMARK_V1_WARM_CASES,
  generateBenchmarkLine,
  generateCorrelatedReplacementFixture,
  generateLineAppendFixture,
  generateManyLineFixture,
  generateResizeOperations,
  generateSameLineAppendFixture,
  generateScrollOperations,
  generateSingleLineFixture,
  generateUnchangedRepaintOperations,
} from "./support/large-text-benchmark-v1.js";

const EXPECTED_MANY_LINE_SHAPES = [
  { target: 100_000, generatedLines: 497, finalLineCodeUnits: 102 },
  { target: 667_633, generatedLines: 3_321, finalLineCodeUnits: 111 },
  { target: 2_000_000, generatedLines: 9_950, finalLineCodeUnits: 49 },
] as const;

describe("large-text-benchmark-v1 fixtures", () => {
  it("accepts stable Bun releases at or above 1.4.0", () => {
    expect(bunVersionAtLeast("1.3.14", "1.4.0")).toBe(false);
    expect(bunVersionAtLeast("1.4.0", "1.4.0")).toBe(true);
    expect(bunVersionAtLeast("1.4.2", "1.4.0")).toBe(true);
    expect(bunVersionAtLeast("1.5.0", "1.4.0")).toBe(true);
    expect(bunVersionAtLeast("1.4.0-canary.1", "1.4.0")).toBe(false);
  });

  it("freezes the exact warm operation matrix", () => {
    expect(LARGE_TEXT_BENCHMARK_V1_WARM_CASES).toEqual([
      { operation: "unchanged-repaint", sourceShape: "many-line" },
      { operation: "resize-and-return", sourceShape: "many-line" },
      { operation: "vertical-scroll", sourceShape: "many-line" },
      { operation: "horizontal-scroll", sourceShape: "many-line" },
      { operation: "horizontal-scroll", sourceShape: "single-line" },
      { operation: "generated-line-append", sourceShape: "many-line" },
      { operation: "same-line-append", sourceShape: "single-line" },
      { operation: "correlated-replacement", sourceShape: "many-line" },
    ]);
  });

  it("generates each exact retained size and source shape", () => {
    expect(LARGE_TEXT_BENCHMARK_V1.version).toBe("large-text-benchmark-v1");
    expect(LARGE_TEXT_BENCHMARK_V1.retainedSizes).toEqual([
      100_000, 667_633, 2_000_000,
    ]);
    expect(generateBenchmarkLine(0)).toBe(
      `00000000|${"abcdefghij".repeat(16)}|0123456789|古|e\u0301|👩‍💻|🇺🇳|\t|\u0001\n`,
    );
    expect(generateBenchmarkLine(0).length).toBe(201);

    for (const shape of EXPECTED_MANY_LINE_SHAPES) {
      const manyLine = generateManyLineFixture(shape.target);
      const logicalLines = manyLine.split("\n");
      const generatedLines = logicalLines.slice(0, shape.generatedLines);
      const finalLine = logicalLines[shape.generatedLines];

      expect(manyLine.length).toBe(shape.target);
      expect(manyLine.endsWith("\n")).toBe(true);
      expect(logicalLines).toHaveLength(shape.generatedLines + 2);
      expect(logicalLines.at(-1)).toBe("");
      expect(generatedLines).toEqual(
        Array.from({ length: shape.generatedLines }, (_, index) =>
          generateBenchmarkLine(index).slice(0, -1),
        ),
      );
      expect(finalLine).toBe(".".repeat(shape.finalLineCodeUnits));

      const singleLine = generateSingleLineFixture(shape.target);
      expect(singleLine.length).toBe(shape.target);
      expect(singleLine.includes("\n")).toBe(false);
      expect(
        singleLine.endsWith(LARGE_TEXT_BENCHMARK_V1.singleLineSuffix),
      ).toBe(true);
      expect(
        singleLine.slice(0, -LARGE_TEXT_BENCHMARK_V1.singleLineSuffix.length),
      ).toMatch(/^x+$/u);
    }
  });

  it("generates the exact 100-frame operation and update sequences", () => {
    expect(generateUnchangedRepaintOperations()).toEqual(
      Array.from({ length: 100 }, () => "repaint"),
    );
    expect(generateResizeOperations()).toEqual(
      Array.from({ length: 100 }, (_, index) =>
        index % 2 === 0
          ? { width: 100, height: 24 }
          : { width: 120, height: 30 },
      ),
    );
    expect(generateScrollOperations(101)).toEqual(
      Array.from({ length: 100 }, (_, index) => (index % 2 === 0 ? 50 : 101)),
    );

    const target = 667_633;
    const lineAppend = generateLineAppendFixture(target);
    expect(lineAppend.history.length).toBe(target);
    expect(lineAppend.updates).toHaveLength(100);
    expect(lineAppend.updates).toEqual(
      Array.from({ length: 100 }, (_, index) => ({
        id: `line-${String(index).padStart(3, "0")}`,
        text: generateBenchmarkLine(index),
      })),
    );

    const sameLine = generateSameLineAppendFixture(target);
    expect(sameLine.growing.length).toBe(target);
    expect(sameLine.growing.includes("\n")).toBe(false);
    expect(sameLine.updates).toHaveLength(100);
    expect(
      sameLine.updates.every(
        (delta) =>
          delta === LARGE_TEXT_BENCHMARK_V1.sameLineDelta &&
          delta.length === 64 &&
          !delta.includes("\n"),
      ),
    ).toBe(true);

    const correlated = generateCorrelatedReplacementFixture(target);
    expect(correlated.history.length).toBe(target - 4_096);
    expect(correlated.replacement).toBe("A".repeat(4_096));
    expect(correlated.history.length + correlated.replacement.length).toBe(
      target,
    );
    expect(correlated.updates).toHaveLength(100);
    expect(correlated.updates).toEqual(
      Array.from({ length: 100 }, (_, index) =>
        (index % 2 === 0 ? "B" : "A").repeat(4_096),
      ),
    );
  });
});
