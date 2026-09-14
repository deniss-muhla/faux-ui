export const LARGE_TEXT_BENCHMARK_V1 = {
  version: "large-text-benchmark-v1",
  retainedSizes: [100_000, 667_633, 2_000_000],
  viewport: { width: 120, height: 30 },
  resizedViewport: { width: 100, height: 24 },
  operationCount: 100,
  replacementCodeUnits: 4_096,
  sameLineDelta: "0123456789abcdef".repeat(4),
  singleLineSuffix: "|古|e\u0301|👩‍💻|🇺🇳",
} as const;

export const LARGE_TEXT_BENCHMARK_V1_WARM_CASES = Object.freeze([
  { operation: "unchanged-repaint", sourceShape: "many-line" },
  { operation: "resize-and-return", sourceShape: "many-line" },
  { operation: "vertical-scroll", sourceShape: "many-line" },
  { operation: "horizontal-scroll", sourceShape: "many-line" },
  { operation: "horizontal-scroll", sourceShape: "single-line" },
  { operation: "generated-line-append", sourceShape: "many-line" },
  { operation: "same-line-append", sourceShape: "single-line" },
  { operation: "correlated-replacement", sourceShape: "many-line" },
] as const);

export interface BenchmarkSegmentUpdate {
  readonly id: string;
  readonly text: string;
}

export interface BenchmarkViewport {
  readonly width: number;
  readonly height: number;
}

export interface LineAppendFixture {
  readonly history: string;
  readonly updates: readonly BenchmarkSegmentUpdate[];
}

export interface SameLineAppendFixture {
  readonly growing: string;
  readonly updates: readonly string[];
}

export interface CorrelatedReplacementFixture {
  readonly history: string;
  readonly replacement: string;
  readonly updates: readonly string[];
}

export function generateUnchangedRepaintOperations(): readonly "repaint"[] {
  return Array.from(
    { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
    () => "repaint" as const,
  );
}

export function generateResizeOperations(): readonly BenchmarkViewport[] {
  return Array.from(
    { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
    (_, index) =>
      index % 2 === 0
        ? LARGE_TEXT_BENCHMARK_V1.resizedViewport
        : LARGE_TEXT_BENCHMARK_V1.viewport,
  );
}

export function generateScrollOperations(maxOffset: number): readonly number[] {
  if (!Number.isSafeInteger(maxOffset) || maxOffset < 0) {
    throw new RangeError(
      "Maximum scroll offset must be a safe non-negative integer.",
    );
  }
  return Array.from(
    { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
    (_, index) => (index % 2 === 0 ? Math.floor(maxOffset / 2) : maxOffset),
  );
}

export function generateBenchmarkLine(index: number): string {
  return `${String(index).padStart(8, "0")}|${"abcdefghij".repeat(16)}|0123456789|古|e\u0301|👩‍💻|🇺🇳|\t|\u0001\n`;
}

export function generateManyLineFixture(target: number): string {
  assertTarget(target, 1);
  const chunks: string[] = [];
  let length = 0;
  let index = 0;

  while (true) {
    const line = generateBenchmarkLine(index);
    if (length + line.length > target) break;
    chunks.push(line);
    length += line.length;
    index += 1;
  }

  const remaining = target - length;
  if (remaining > 0) {
    chunks.push(`${".".repeat(remaining - 1)}\n`);
  }
  return chunks.join("");
}

export function generateSingleLineFixture(target: number): string {
  const suffix = LARGE_TEXT_BENCHMARK_V1.singleLineSuffix;
  assertTarget(target, suffix.length);
  return `${"x".repeat(target - suffix.length)}${suffix}`;
}

export function generateLineAppendFixture(target: number): LineAppendFixture {
  return {
    history: generateManyLineFixture(target),
    updates: Array.from(
      { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
      (_, index) => ({
        id: `line-${String(index).padStart(3, "0")}`,
        text: generateBenchmarkLine(index),
      }),
    ),
  };
}

export function generateSameLineAppendFixture(
  target: number,
): SameLineAppendFixture {
  return {
    growing: generateSingleLineFixture(target),
    updates: Array.from(
      { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
      () => LARGE_TEXT_BENCHMARK_V1.sameLineDelta,
    ),
  };
}

export function generateCorrelatedReplacementFixture(
  target: number,
): CorrelatedReplacementFixture {
  const replacementCodeUnits = LARGE_TEXT_BENCHMARK_V1.replacementCodeUnits;
  assertTarget(target, replacementCodeUnits + 1);
  return {
    history: generateManyLineFixture(target - replacementCodeUnits),
    replacement: "A".repeat(replacementCodeUnits),
    updates: Array.from(
      { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
      (_, index) => (index % 2 === 0 ? "B" : "A").repeat(replacementCodeUnits),
    ),
  };
}

function assertTarget(target: number, minimum: number): void {
  if (!Number.isSafeInteger(target) || target < minimum) {
    throw new RangeError(
      `Fixture target must be a safe integer of at least ${minimum} UTF-16 code units.`,
    );
  }
}
