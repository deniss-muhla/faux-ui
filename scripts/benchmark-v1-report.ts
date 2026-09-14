import {
  LARGE_TEXT_BENCHMARK_V1,
  LARGE_TEXT_BENCHMARK_V1_WARM_CASES,
  generateBenchmarkLine,
} from "../packages/ui/test/support/large-text-benchmark-v1.js";
import {
  bunVersionAtLeast,
  environmentMatches,
} from "./benchmark-v1-environment.js";
import {
  DEFAULT_MEASURED_RUNS,
  DEFAULT_WARMUP_RUNS,
  MINIMUM_BUN_VERSION,
  type BenchmarkOptions,
  type BenchmarkReport,
  type CounterCheck,
  type Environment,
  type LatencyAggregate,
  type ReferenceGate,
  type ReferencePreflight,
  type RenderWorkCounts,
  type SourceShape,
  type WarmMeasurement,
  type WarmOperation,
  type WorkerReport,
  type WorkDelta,
  type WorkSummary,
} from "./benchmark-v1-types.js";

const COLD_THRESHOLD_MILLISECONDS = 500;
const WARM_P95_THRESHOLD_MILLISECONDS = 50;
const EVENT_LOOP_DELAY_THRESHOLD_MILLISECONDS = 100;
const COUNTER_FRAME_LIMIT = 100;
const viewport = LARGE_TEXT_BENCHMARK_V1.viewport;
const counterNames = [
  "sourceCodeUnitsInspected",
  "linesIndexed",
  "graphemesPrepared",
  "cellSlotsRetained",
  "copiedGlyphPayloadCodeUnitsRetained",
  "cellsPainted",
  "entriesDisposed",
] as const;

export type BenchmarkRun = WorkerReport & { readonly runIndex: number };

export type CounterResult = {
  readonly operation: WarmOperation;
  readonly sourceShape: SourceShape;
  readonly fixtureSize: number;
  readonly work: WorkSummary;
  readonly disposal: RenderWorkCounts;
};

export function buildBenchmarkReport(
  benchmarkOptions: BenchmarkOptions,
  environment: Environment,
  preflight: ReferencePreflight,
  runs: readonly BenchmarkRun[],
): BenchmarkReport {
  const aggregates = aggregateRuns(runs);
  const deterministicCounters = aggregateCounters(runs);
  const referenceGate = evaluateReferenceGate(
    environment,
    preflight,
    benchmarkOptions,
    runs,
    aggregates,
    deterministicCounters,
  );

  return {
    benchmark: "large-text-benchmark-v1",
    fixtureVersion: LARGE_TEXT_BENCHMARK_V1.version,
    fixtureSizes:
      benchmarkOptions.onlySize === null
        ? LARGE_TEXT_BENCHMARK_V1.retainedSizes
        : [benchmarkOptions.onlySize],
    viewport: LARGE_TEXT_BENCHMARK_V1.viewport,
    resizedViewport: LARGE_TEXT_BENCHMARK_V1.resizedViewport,
    operationCount: LARGE_TEXT_BENCHMARK_V1.operationCount,
    environment,
    protocol: {
      warmupRuns: benchmarkOptions.warmupRuns,
      measuredRuns: benchmarkOptions.measuredRuns,
      freshProcessMeasurements: true,
      eventLoopDelayMeasurement: "zero-delay-timer",
      referenceProcedureRequested: benchmarkOptions.referenceRequested,
    },
    warmups: { count: benchmarkOptions.warmupRuns, recorded: false },
    runs,
    aggregates,
    deterministicCounters,
    referenceGate,
  };
}

export function aggregateRuns(
  runs: readonly BenchmarkRun[],
): BenchmarkReport["aggregates"] {
  const coldKeys = new Map<string, number[]>();
  const warmKeys = new Map<string, WarmMeasurement[]>();
  for (const run of runs) {
    for (const measurement of run.cold) {
      const key = measurementKey(
        measurement.sourceShape,
        measurement.fixtureSize,
        measurement.operation,
      );
      const samples = coldKeys.get(key) ?? [];
      samples.push(measurement.latencyMilliseconds);
      coldKeys.set(key, samples);
    }
    for (const measurement of run.warm) {
      const key = measurementKey(
        measurement.sourceShape,
        measurement.fixtureSize,
        measurement.operation,
      );
      const measurements = warmKeys.get(key) ?? [];
      measurements.push(measurement);
      warmKeys.set(key, measurements);
    }
  }

  const cold = [...coldKeys.entries()].map(([key, samples]) => {
    const { sourceShape, fixtureSize } = parseMeasurementKey(key);
    return {
      sourceShape,
      fixtureSize,
      samplesMilliseconds: samples,
      medianMilliseconds: percentile(samples, 0.5),
    };
  });
  cold.sort(compareMeasurement);

  const warm = [...warmKeys.entries()].map(([key, measurements]) => {
    const { sourceShape, fixtureSize, operation } = parseMeasurementKey(key);
    const latencies = measurements.flatMap(
      (measurement) => measurement.latencyMilliseconds,
    );
    return {
      operation: operation as WarmOperation,
      sourceShape,
      fixtureSize,
      samples: latencies.length,
      p95Milliseconds: percentile(latencies, 0.95),
      maximumMilliseconds: Math.max(...latencies, 0),
      maximumEventLoopDelayMilliseconds: Math.max(
        ...measurements.map(
          (measurement) => measurement.eventLoopDelay.maximumMilliseconds,
        ),
        0,
      ),
    };
  });
  warm.sort(compareMeasurement);
  return { cold, warm };
}

export function aggregateCounters(
  runs: readonly BenchmarkRun[],
): BenchmarkReport["deterministicCounters"] {
  const results: CounterResult[] = runs.flatMap((run) =>
    run.warm.map((measurement) => ({
      operation: measurement.operation,
      sourceShape: measurement.sourceShape,
      fixtureSize: measurement.fixtureSize,
      work: measurement.work,
      disposal: measurement.disposal,
    })),
  );
  const checks: CounterCheck[] = [];
  const retainedLimit = viewport.width * viewport.height * 3;

  checks.push(
    inventoryCheck(
      "unchanged-repaint-does-not-inspect-history",
      results.filter((result) => result.operation === "unchanged-repaint"),
      expectedSizes(),
      (matched) =>
        matched.every(
          (result) =>
            result.work.cumulative.sourceCodeUnitsInspected === 0 &&
            result.work.cumulative.linesIndexed === 0 &&
            result.work.cumulative.graphemesPrepared === 0,
        ),
    ),
  );

  checks.push(
    boundedUpdateCheck(
      "generated-line-append-is-history-independent",
      results.filter((result) => result.operation === "generated-line-append"),
      (result) => result.work.cumulative.sourceCodeUnitsInspected,
      generateBenchmarkLine(0).length *
        (viewport.height * 3 + 1) *
        COUNTER_FRAME_LIMIT,
    ),
  );
  checks.push(
    boundedUpdateCheck(
      "same-line-append-is-history-independent",
      results.filter((result) => result.operation === "same-line-append"),
      (result) => result.work.cumulative.sourceCodeUnitsInspected,
      LARGE_TEXT_BENCHMARK_V1.sameLineDelta.length *
        (viewport.width * 3 + 1) *
        COUNTER_FRAME_LIMIT,
    ),
  );

  checks.push(
    inventoryCheck(
      "each-warm-mount-disposes-one-text-entry",
      results,
      expectedSizes(),
      (matched) =>
        matched.every((result) => result.disposal.entriesDisposed === 1),
    ),
  );

  checks.push(
    inventoryCheck(
      "one-axis-prepared-window-is-bounded",
      results,
      expectedSizes(),
      (matched) =>
        matched.every(
          (result) =>
            result.work.maximumPerFrame.cellSlotsRetained <= retainedLimit &&
            result.work.maximumPerFrame.copiedGlyphPayloadCodeUnitsRetained <=
              retainedLimit,
        ),
    ),
  );

  return { checks, results };
}

function evaluateReferenceGate(
  environment: Environment,
  preflight: ReferencePreflight,
  benchmarkOptions: BenchmarkOptions,
  runs: readonly BenchmarkRun[],
  aggregates: BenchmarkReport["aggregates"],
  counters: BenchmarkReport["deterministicCounters"],
): ReferenceGate {
  const inventory = validateInventory(runs);
  const evaluatedSizes = expectedSizes();
  const eligibility = {
    requested: benchmarkOptions.referenceRequested,
    bunVersionAtLeast1_4_0: bunVersionAtLeast(
      environment.bunVersion,
      MINIMUM_BUN_VERSION,
    ),
    physicalMachine: environment.machineStatus === "physical",
    supportedOperatingSystem: environment.supportedOperatingSystem,
    lockedDependencies:
      preflight.frozenInstallSucceeded && environment.lockedDependencies,
    productionBuild: environment.buildMode === "production",
    exactProtocol:
      benchmarkOptions.warmupRuns === DEFAULT_WARMUP_RUNS &&
      benchmarkOptions.measuredRuns === DEFAULT_MEASURED_RUNS,
    fullMatrix: inventory.passed,
    environmentMatches: runs.every((run) =>
      environmentMatches(run.environment, environment),
    ),
    lockfileMatches: runs.every(
      (run) =>
        run.environment.lockfileSha256 === environment.lockfileSha256 &&
        run.environment.frozenInstallDryRun === environment.frozenInstallDryRun,
    ),
    distinctWorkers:
      new Set(runs.map((run) => run.workerPid)).size === runs.length,
    runCountExact: runs.length === DEFAULT_MEASURED_RUNS,
  };
  const eligible = Object.values(eligibility).every(Boolean);
  const cold = aggregates.cold
    .filter((measurement) => measurement.fixtureSize === 667_633)
    .map((measurement) => ({
      sourceShape: measurement.sourceShape,
      fixtureSize: measurement.fixtureSize,
      medianMilliseconds: measurement.medianMilliseconds,
      passed: measurement.medianMilliseconds <= COLD_THRESHOLD_MILLISECONDS,
    }));
  const warmP95 = aggregates.warm.map((measurement) => ({
    operation: measurement.operation,
    sourceShape: measurement.sourceShape,
    fixtureSize: measurement.fixtureSize,
    p95Milliseconds: measurement.p95Milliseconds,
    passed: measurement.p95Milliseconds <= WARM_P95_THRESHOLD_MILLISECONDS,
  }));
  const maximumWarmEventLoopDelayMilliseconds = Math.max(
    ...aggregates.warm.map(
      (measurement) => measurement.maximumEventLoopDelayMilliseconds,
    ),
    0,
  );
  const countersPassed = counters.checks.every(
    (check) => check.status === "passed",
  );
  const coldEvaluated =
    cold.length === 2 &&
    new Set(cold.map((measurement) => measurement.sourceShape)).size === 2 &&
    cold.every((measurement) => measurement.passed);
  const warmEvaluated =
    warmP95.length ===
      LARGE_TEXT_BENCHMARK_V1_WARM_CASES.length * evaluatedSizes.length &&
    evaluatedSizes.every((fixtureSize) =>
      LARGE_TEXT_BENCHMARK_V1_WARM_CASES.every((warmCase) =>
        warmP95.some(
          (measurement) =>
            measurement.operation === warmCase.operation &&
            measurement.sourceShape === warmCase.sourceShape &&
            measurement.fixtureSize === fixtureSize,
        ),
      ),
    ) &&
    warmP95.every((measurement) => measurement.passed);
  const timingsPassed =
    coldEvaluated &&
    warmEvaluated &&
    maximumWarmEventLoopDelayMilliseconds <=
      EVENT_LOOP_DELAY_THRESHOLD_MILLISECONDS;
  const status = !benchmarkOptions.referenceRequested
    ? "diagnostic-only"
    : eligible && timingsPassed && countersPassed
      ? "passed"
      : "failed";

  return {
    status,
    eligible,
    eligibility,
    preflight,
    inventory,
    thresholds: {
      coldMedianMilliseconds: COLD_THRESHOLD_MILLISECONDS,
      warmP95Milliseconds: WARM_P95_THRESHOLD_MILLISECONDS,
      maximumWarmEventLoopDelayMilliseconds:
        EVENT_LOOP_DELAY_THRESHOLD_MILLISECONDS,
    },
    cold,
    warmP95,
    maximumWarmEventLoopDelayMilliseconds,
    warmEventLoopDelayPassed:
      maximumWarmEventLoopDelayMilliseconds <=
      EVENT_LOOP_DELAY_THRESHOLD_MILLISECONDS,
    countersPassed,
  };
}

function validateInventory(
  runs: readonly BenchmarkRun[],
): ReferenceGate["inventory"] {
  const problems: string[] = [];
  const sizes = expectedSizes();
  const coldSeen = new Set<string>();
  const warmSeen = new Set<string>();
  if (runs.length !== DEFAULT_MEASURED_RUNS) {
    problems.push(
      `Expected ${DEFAULT_MEASURED_RUNS} measured runs, received ${runs.length}.`,
    );
  }
  for (const run of runs) {
    const runCold = new Set<string>();
    for (const measurement of run.cold) {
      const key = measurementKey(
        measurement.sourceShape,
        measurement.fixtureSize,
        measurement.operation,
      );
      if (runCold.has(key))
        problems.push(`Duplicate cold measurement: ${key}.`);
      runCold.add(key);
      coldSeen.add(key);
      if (!sizes.includes(measurement.fixtureSize)) {
        problems.push(
          `Unspecified cold fixture size: ${measurement.fixtureSize}.`,
        );
      }
      if (measurement.operationCount !== 1) {
        problems.push(
          `Cold measurement ${key} must run exactly one operation.`,
        );
      }
      if (measurement.disposal.entriesDisposed !== 1) {
        problems.push(
          `Cold measurement ${key} must dispose exactly one entry.`,
        );
      }
      if (
        measurement.viewport.width !== viewport.width ||
        measurement.viewport.height !== viewport.height
      ) {
        problems.push(`Cold measurement ${key} used an unexpected viewport.`);
      }
      if (measurement.latencyMilliseconds <= 0) {
        problems.push(`Cold measurement ${key} has no measured latency.`);
      }
    }
    const runWarm = new Set<string>();
    for (const measurement of run.warm) {
      const key = measurementKey(
        measurement.sourceShape,
        measurement.fixtureSize,
        measurement.operation,
      );
      if (runWarm.has(key))
        problems.push(`Duplicate warm measurement: ${key}.`);
      runWarm.add(key);
      warmSeen.add(key);
      if (!sizes.includes(measurement.fixtureSize)) {
        problems.push(
          `Unspecified warm fixture size: ${measurement.fixtureSize}.`,
        );
      }
      if (
        measurement.latencyMilliseconds.length !==
        LARGE_TEXT_BENCHMARK_V1.operationCount
      ) {
        problems.push(
          `Warm measurement ${key} recorded ${measurement.latencyMilliseconds.length} samples.`,
        );
      }
      if (
        measurement.operationCount !== LARGE_TEXT_BENCHMARK_V1.operationCount
      ) {
        problems.push(
          `Warm measurement ${key} declared ${measurement.operationCount} operations.`,
        );
      }
      if (measurement.initialFixtureCodeUnits !== measurement.fixtureSize) {
        problems.push(
          `Warm measurement ${key} started from the wrong fixture size.`,
        );
      }
      if (
        measurement.viewport.width !== viewport.width ||
        measurement.viewport.height !== viewport.height
      ) {
        problems.push(`Warm measurement ${key} used an unexpected viewport.`);
      }
      if (
        measurement.operation === "resize-and-return" &&
        (measurement.resizedViewport?.width !==
          LARGE_TEXT_BENCHMARK_V1.resizedViewport.width ||
          measurement.resizedViewport?.height !==
            LARGE_TEXT_BENCHMARK_V1.resizedViewport.height)
      ) {
        problems.push(
          `Warm measurement ${key} used an unexpected resized viewport.`,
        );
      }
      if (measurement.disposal.entriesDisposed !== 1) {
        problems.push(
          `Warm measurement ${key} must dispose exactly one entry.`,
        );
      }
    }
  }

  for (const fixtureSize of sizes) {
    for (const sourceShape of sourceShapes()) {
      const key = measurementKey(
        sourceShape,
        fixtureSize,
        "cold-index-and-first-frame",
      );
      if (!coldSeen.has(key))
        problems.push(`Missing cold measurement: ${key}.`);
    }
    for (const warmCase of LARGE_TEXT_BENCHMARK_V1_WARM_CASES) {
      const key = measurementKey(
        warmCase.sourceShape,
        fixtureSize,
        warmCase.operation,
      );
      if (!warmSeen.has(key))
        problems.push(`Missing warm measurement: ${key}.`);
    }
  }

  return { passed: problems.length === 0, problems };
}

export function summarizeWork(frames: readonly WorkDelta[]): WorkSummary {
  const cumulative = {
    sourceCodeUnitsInspected: 0,
    linesIndexed: 0,
    graphemesPrepared: 0,
    cellsPainted: 0,
    entriesDisposed: 0,
  };
  const maximumPerFrame = emptyWork();
  for (const frame of frames) {
    cumulative.sourceCodeUnitsInspected += frame.sourceCodeUnitsInspected;
    cumulative.linesIndexed += frame.linesIndexed;
    cumulative.graphemesPrepared += frame.graphemesPrepared;
    cumulative.cellsPainted += frame.cellsPainted;
    cumulative.entriesDisposed += frame.entriesDisposed;
    for (const name of counterNames) {
      maximumPerFrame[name] = Math.max(maximumPerFrame[name], frame[name]);
    }
  }
  const last = frames.at(-1) ?? emptyWork();
  return {
    cumulative,
    maximumPerFrame,
    finalRetained: {
      cellSlotsRetained: last.cellSlotsRetained,
      copiedGlyphPayloadCodeUnitsRetained:
        last.copiedGlyphPayloadCodeUnitsRetained,
    },
  };
}

export function workDelta(
  previous: RenderWorkCounts,
  next: RenderWorkCounts,
): WorkDelta {
  return {
    sourceCodeUnitsInspected:
      next.sourceCodeUnitsInspected - previous.sourceCodeUnitsInspected,
    linesIndexed: next.linesIndexed - previous.linesIndexed,
    graphemesPrepared: next.graphemesPrepared - previous.graphemesPrepared,
    cellSlotsRetained: next.cellSlotsRetained,
    copiedGlyphPayloadCodeUnitsRetained:
      next.copiedGlyphPayloadCodeUnitsRetained,
    cellsPainted: next.cellsPainted - previous.cellsPainted,
    entriesDisposed: next.entriesDisposed - previous.entriesDisposed,
  };
}

type MutableWorkCounts = {
  -readonly [Name in keyof RenderWorkCounts]: RenderWorkCounts[Name];
};

function emptyWork(): MutableWorkCounts {
  return {
    sourceCodeUnitsInspected: 0,
    linesIndexed: 0,
    graphemesPrepared: 0,
    cellSlotsRetained: 0,
    copiedGlyphPayloadCodeUnitsRetained: 0,
    cellsPainted: 0,
    entriesDisposed: 0,
  };
}

export function aggregateLatencies(
  values: readonly number[],
): LatencyAggregate {
  return {
    medianMilliseconds: percentile(values, 0.5),
    p95Milliseconds: percentile(values, 0.95),
    maximumMilliseconds: Math.max(...values, 0),
  };
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[rank] ?? 0;
}

function boundedUpdateCheck(
  name: string,
  results: readonly CounterResult[],
  value: (result: CounterResult) => number,
  limit: number,
): CounterCheck {
  const sizes = expectedSizes();
  const complete = sizes.every((fixtureSize) =>
    results.some((result) => result.fixtureSize === fixtureSize),
  );
  if (!complete) {
    return {
      name,
      status: "failed",
      details: {
        maximumCumulativeSourceCodeUnitsInspected: 0,
        allowedMaximum: limit,
        fixtureSizesCompared: new Set(
          results.map((result) => result.fixtureSize),
        ).size,
        measurementsCompared: results.length,
      },
    };
  }
  const maximum = Math.max(...results.map(value), 0);
  return {
    name,
    status: maximum <= limit ? "passed" : "failed",
    details: {
      maximumCumulativeSourceCodeUnitsInspected: maximum,
      allowedMaximum: limit,
      fixtureSizesCompared: new Set(results.map((result) => result.fixtureSize))
        .size,
      measurementsCompared: results.length,
    },
  };
}

function inventoryCheck(
  name: string,
  results: readonly CounterResult[],
  sizes: readonly number[],
  predicate: (matched: readonly CounterResult[]) => boolean,
): CounterCheck {
  const matched = results.filter((result) =>
    sizes.includes(result.fixtureSize),
  );
  const complete = sizes.every((fixtureSize) =>
    matched.some((result) => result.fixtureSize === fixtureSize),
  );
  const expectedMeasurements = sizes.length;
  const completeCount = new Set(matched.map((result) => result.fixtureSize))
    .size;
  const passed = complete && predicate(matched);
  return {
    name,
    status: passed ? "passed" : "failed",
    details: {
      fixtureSizesCompared: completeCount,
      expectedFixtureSizes: expectedMeasurements,
      measurementsCompared: matched.length,
    },
  };
}

function expectedSizes(): readonly number[] {
  return LARGE_TEXT_BENCHMARK_V1.retainedSizes;
}

function sourceShapes(): readonly SourceShape[] {
  return ["many-line", "single-line"];
}

function measurementKey(
  sourceShape: SourceShape,
  fixtureSize: number,
  operation: string,
): string {
  return `${sourceShape}|${fixtureSize}|${operation}`;
}

function parseMeasurementKey(key: string): {
  readonly sourceShape: SourceShape;
  readonly fixtureSize: number;
  readonly operation: string;
} {
  const [sourceShape, fixtureSize, operation] = key.split("|");
  if (
    (sourceShape !== "many-line" && sourceShape !== "single-line") ||
    fixtureSize === undefined ||
    operation === undefined
  ) {
    throw new Error("Invalid benchmark measurement key.");
  }
  return {
    sourceShape,
    fixtureSize: Number(fixtureSize),
    operation,
  };
}

function compareMeasurement(
  left: {
    readonly sourceShape: SourceShape;
    readonly fixtureSize: number;
    readonly operation?: string;
  },
  right: {
    readonly sourceShape: SourceShape;
    readonly fixtureSize: number;
    readonly operation?: string;
  },
): number {
  return (
    left.fixtureSize - right.fixtureSize ||
    left.sourceShape.localeCompare(right.sourceShape) ||
    (left.operation ?? "").localeCompare(right.operation ?? "")
  );
}
