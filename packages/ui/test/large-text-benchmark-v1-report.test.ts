import { describe, expect, it } from "vitest";

import { parseOptions } from "../../../scripts/benchmark.js";
import { skippedReferencePreflight } from "../../../scripts/benchmark-v1-environment.js";
import type {
  BenchmarkOptions,
  Environment,
  ReferencePreflight,
  WorkerReport,
} from "../../../scripts/benchmark-v1-types.js";
import {
  buildBenchmarkReport,
  type BenchmarkRun,
} from "../../../scripts/benchmark-v1-report.js";
import {
  LARGE_TEXT_BENCHMARK_V1,
  LARGE_TEXT_BENCHMARK_V1_WARM_CASES,
} from "./support/large-text-benchmark-v1.js";

const SIZE = LARGE_TEXT_BENCHMARK_V1.retainedSizes[1];
const LOCKFILE_SHA256 = "a".repeat(64);
const refOptions: BenchmarkOptions = {
  worker: false,
  buildMode: "production",
  referenceRequested: true,
  preflightVerified: false,
  warmupRuns: 3,
  measuredRuns: 5,
  onlySize: null,
};

function referencePreflight(): ReferencePreflight {
  return {
    lockfilePath: "/benchmark/bun.lock",
    lockfileSha256: LOCKFILE_SHA256,
    frozenInstallExitCode: 0,
    frozenInstallSucceeded: true,
    error: null,
  };
}

function environment(overrides: Partial<Environment> = {}): Environment {
  return {
    bunVersion: "1.4.0",
    operatingSystem: "linux",
    osRelease: "7.2.4",
    architecture: "x64",
    processor: "Benchmark Processor",
    machineStatus: "physical",
    supportedOperatingSystem: true,
    lockedDependencies: true,
    lockfileSha256: LOCKFILE_SHA256,
    frozenInstallDryRun: true,
    buildMode: "production",
    ...overrides,
  };
}

function work() {
  return {
    cumulative: {
      sourceCodeUnitsInspected: 0,
      linesIndexed: 0,
      graphemesPrepared: 0,
      cellsPainted: 100,
      entriesDisposed: 0,
    },
    maximumPerFrame: {
      sourceCodeUnitsInspected: 0,
      linesIndexed: 0,
      graphemesPrepared: 0,
      cellSlotsRetained: 1_000,
      copiedGlyphPayloadCodeUnitsRetained: 1_000,
      cellsPainted: 100,
      entriesDisposed: 0,
    },
    finalRetained: {
      cellSlotsRetained: 1_000,
      copiedGlyphPayloadCodeUnitsRetained: 1_000,
    },
  };
}

function counters() {
  return {
    sourceCodeUnitsInspected: 0,
    linesIndexed: 0,
    graphemesPrepared: 0,
    cellSlotsRetained: 1_000,
    copiedGlyphPayloadCodeUnitsRetained: 1_000,
    cellsPainted: 100,
    entriesDisposed: 0,
  };
}

function workerReport(
  workerPid: number,
  workerEnvironment: Environment,
): WorkerReport {
  const uniform = (index: number) => 10 + (index % 5);
  const cold = LARGE_TEXT_BENCHMARK_V1.retainedSizes.flatMap((fixtureSize) =>
    (["many-line", "single-line"] as const).map((sourceShape) => ({
      operation: "cold-index-and-first-frame" as const,
      sourceShape,
      fixtureSize,
      viewport: LARGE_TEXT_BENCHMARK_V1.viewport,
      operationCount: 1 as const,
      latencyMilliseconds: uniform(fixtureSize + sourceShape.length),
      work: counters(),
      disposal: { ...counters(), entriesDisposed: 1 },
    })),
  );
  const warm = LARGE_TEXT_BENCHMARK_V1.retainedSizes.flatMap((fixtureSize) =>
    LARGE_TEXT_BENCHMARK_V1_WARM_CASES.map((warmCase) => ({
      operation: warmCase.operation,
      sourceShape: warmCase.sourceShape,
      fixtureSize,
      viewport: LARGE_TEXT_BENCHMARK_V1.viewport,
      ...(warmCase.operation === "resize-and-return"
        ? { resizedViewport: LARGE_TEXT_BENCHMARK_V1.resizedViewport }
        : {}),
      operationCount: LARGE_TEXT_BENCHMARK_V1.operationCount,
      initialFixtureCodeUnits: fixtureSize,
      finalFixtureCodeUnits: fixtureSize,
      latencyMilliseconds: Array.from(
        { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
        (_, index) => uniform(index),
      ),
      eventLoopDelayMilliseconds: Array.from(
        { length: LARGE_TEXT_BENCHMARK_V1.operationCount },
        () => 1,
      ),
      latency: {
        medianMilliseconds: 12,
        p95Milliseconds: 14,
        maximumMilliseconds: 18,
      },
      eventLoopDelay: { maximumMilliseconds: 2 },
      work: work(),
      disposal: { ...counters(), entriesDisposed: 1 },
    })),
  );
  return { workerPid, environment: workerEnvironment, cold, warm };
}

function referenceRuns(
  count = refOptions.measuredRuns,
  workerEnvironment = environment(),
): BenchmarkRun[] {
  return Array.from({ length: count }, (_, index) => ({
    runIndex: index + 1,
    ...workerReport(1_000 + index, workerEnvironment),
  }));
}

describe("large-text-benchmark-v1 reference gate", () => {
  it("accepts the exact three-size protocol inventory", () => {
    const report = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      referenceRuns(),
    );

    expect(report.referenceGate.status).toBe("passed");
    expect(report.referenceGate.eligible).toBe(true);
    expect(report.referenceGate.eligibility).toMatchObject({
      requested: true,
      bunVersionAtLeast1_4_0: true,
      lockedDependencies: true,
      productionBuild: true,
      exactProtocol: true,
      fullMatrix: true,
      environmentMatches: true,
      lockfileMatches: true,
      distinctWorkers: true,
      runCountExact: true,
    });
    expect(report.referenceGate.inventory).toEqual({
      passed: true,
      problems: [],
    });
    expect(report.aggregates.cold).toHaveLength(
      LARGE_TEXT_BENCHMARK_V1.retainedSizes.length * 2,
    );
    expect(report.aggregates.warm).toHaveLength(
      LARGE_TEXT_BENCHMARK_V1.retainedSizes.length *
        LARGE_TEXT_BENCHMARK_V1_WARM_CASES.length,
    );
    expect(report.aggregates.cold[0]?.samplesMilliseconds).toHaveLength(5);
    expect(report.aggregates.warm[0]?.samples).toBe(500);
    expect(report.deterministicCounters.results).toHaveLength(
      refOptions.measuredRuns *
        LARGE_TEXT_BENCHMARK_V1.retainedSizes.length *
        LARGE_TEXT_BENCHMARK_V1_WARM_CASES.length,
    );
    expect(
      report.deterministicCounters.checks.map((check) => [
        check.name,
        check.status,
      ]),
    ).toEqual([
      ["unchanged-repaint-does-not-inspect-history", "passed"],
      ["generated-line-append-is-history-independent", "passed"],
      ["same-line-append-is-history-independent", "passed"],
      ["each-warm-mount-disposes-one-text-entry", "passed"],
      ["one-axis-prepared-window-is-bounded", "passed"],
    ]);
    expect(report.referenceGate.cold).toHaveLength(2);
    expect(report.referenceGate.warmP95).toHaveLength(
      LARGE_TEXT_BENCHMARK_V1.retainedSizes.length *
        LARGE_TEXT_BENCHMARK_V1_WARM_CASES.length,
    );
    expect(JSON.stringify(report)).not.toContain("A".repeat(4_096));
  });

  it("rejects a narrowed one-size matrix even when every size present is valid", () => {
    const report = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      referenceRuns().map((run) => ({
        ...run,
        cold: run.cold.filter(
          (measurement) => measurement.fixtureSize === SIZE,
        ),
        warm: run.warm.filter(
          (measurement) => measurement.fixtureSize === SIZE,
        ),
      })),
    );

    expect(report.referenceGate.status).toBe("failed");
    expect(report.referenceGate.eligibility.fullMatrix).toBe(false);
    expect(report.referenceGate.inventory.passed).toBe(false);
    expect(
      report.referenceGate.inventory.problems.some((problem) =>
        problem.includes("Missing cold measurement"),
      ),
    ).toBe(true);
    expect(
      report.referenceGate.inventory.problems.some((problem) =>
        problem.includes("Missing warm measurement"),
      ),
    ).toBe(true);
  });

  it("rejects duplicate matrix entries", () => {
    const runs: BenchmarkRun[] = referenceRuns(1, environment());
    const first = runs[0];
    if (first === undefined) throw new Error("Missing synthetic run.");
    runs.push({
      ...first,
      runIndex: 2,
      workerPid: 2_000,
      warm: [...first.warm, first.warm[0]!],
    });

    const report = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      runs,
    );

    expect(report.referenceGate.status).toBe("failed");
    expect(report.referenceGate.inventory.passed).toBe(false);
    expect(
      report.referenceGate.inventory.problems.some((problem) =>
        problem.includes("Duplicate warm measurement"),
      ),
    ).toBe(true);
  });

  it("rejects a wrong warm sample count", () => {
    const runs = referenceRuns().map((run) => ({
      ...run,
      warm: run.warm.map((measurement) => ({
        ...measurement,
        latencyMilliseconds: measurement.latencyMilliseconds.slice(0, 99),
      })),
    }));

    const report = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      runs,
    );

    expect(report.referenceGate.status).toBe("failed");
    expect(
      report.referenceGate.inventory.problems.every((problem) =>
        problem.includes("recorded 99 samples"),
      ),
    ).toBe(true);
  });

  it("rejects the wrong measured worker count and repeated processes", () => {
    const shortRun = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      referenceRuns(4),
    );
    expect(shortRun.referenceGate.status).toBe("failed");
    expect(shortRun.referenceGate.eligibility.runCountExact).toBe(false);
    expect(
      shortRun.referenceGate.inventory.problems.some((problem) =>
        problem.includes("Expected 5 measured runs, received 4"),
      ),
    ).toBe(true);

    const repeated = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      referenceRuns(5).map((run) => ({ ...run, workerPid: 4_242 })),
    );
    expect(repeated.referenceGate.status).toBe("failed");
    expect(repeated.referenceGate.eligibility.distinctWorkers).toBe(false);
  });

  it("rejects a worker whose environment differs from the orchestrator", () => {
    const orchestrator = environment();
    const mismatched = referenceRuns().map((run, index) =>
      index === 2
        ? {
            ...run,
            environment: { ...run.environment, architecture: "arm64" },
          }
        : run,
    );

    const report = buildBenchmarkReport(
      refOptions,
      orchestrator,
      referencePreflight(),
      mismatched,
    );

    expect(report.referenceGate.status).toBe("failed");
    expect(report.referenceGate.eligibility.environmentMatches).toBe(false);
    expect(report.referenceGate.eligibility.lockfileMatches).toBe(true);
    expect(report.referenceGate.eligibility.fullMatrix).toBe(true);
  });

  it("rejects a worker whose lockfile digest differs from the preflight", () => {
    const orchestrator = environment();
    const mismatched = referenceRuns(5).map((run, index) =>
      index === 2
        ? {
            ...run,
            environment: {
              ...run.environment,
              lockfileSha256: "b".repeat(64),
            },
          }
        : run,
    );

    const report = buildBenchmarkReport(
      refOptions,
      orchestrator,
      referencePreflight(),
      mismatched,
    );

    expect(report.referenceGate.status).toBe("failed");
    expect(report.referenceGate.eligibility.lockfileMatches).toBe(false);
    expect(report.referenceGate.eligibility.environmentMatches).toBe(true);
  });

  it("fails closed on an empty result set", () => {
    const report = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      [],
    );

    expect(report.referenceGate.status).toBe("failed");
    expect(report.referenceGate.eligible).toBe(false);
    expect(report.referenceGate.eligibility.fullMatrix).toBe(false);
    expect(report.referenceGate.inventory.passed).toBe(false);
    expect(report.referenceGate.countersPassed).toBe(false);
    expect(
      report.referenceGate.inventory.problems.some((problem) =>
        problem.includes("Expected 5 measured runs, received 0"),
      ),
    ).toBe(true);
    expect(
      report.deterministicCounters.checks.every(
        (check) => check.status === "failed",
      ),
    ).toBe(true);
  });

  it("fails closed when one fixture size is missing from the counters", () => {
    const runs = referenceRuns().map((run) => ({
      ...run,
      warm: run.warm.filter((measurement) => measurement.fixtureSize !== SIZE),
    }));

    const report = buildBenchmarkReport(
      refOptions,
      environment(),
      referencePreflight(),
      runs,
    );

    expect(report.referenceGate.countersPassed).toBe(false);
    expect(
      report.deterministicCounters.checks.some(
        (check) =>
          check.name === "unchanged-repaint-does-not-inspect-history" &&
          check.status === "failed",
      ),
    ).toBe(true);
  });

  it("rejects prerelease Bun, a virtual machine, and a non-production build", () => {
    const prerelease = buildBenchmarkReport(
      refOptions,
      environment({ bunVersion: "1.4.0-canary.1" }),
      referencePreflight(),
      referenceRuns(5, environment({ bunVersion: "1.4.0-canary.1" })),
    );
    expect(prerelease.referenceGate.status).toBe("failed");
    expect(prerelease.referenceGate.eligibility.bunVersionAtLeast1_4_0).toBe(
      false,
    );

    const virtual = buildBenchmarkReport(
      refOptions,
      environment({ machineStatus: "virtual" }),
      referencePreflight(),
      referenceRuns(5, environment({ machineStatus: "virtual" })),
    );
    expect(virtual.referenceGate.status).toBe("failed");
    expect(virtual.referenceGate.eligibility.physicalMachine).toBe(false);

    const sourceBuild = buildBenchmarkReport(
      { ...refOptions, buildMode: "source" },
      environment({ buildMode: "source" }),
      referencePreflight(),
      referenceRuns(5, environment({ buildMode: "source" })),
    );
    expect(sourceBuild.referenceGate.status).toBe("failed");
    expect(sourceBuild.referenceGate.eligibility.productionBuild).toBe(false);
  });

  it("rejects a reference run without a successful frozen install preflight", () => {
    const failedPreflight: ReferencePreflight = {
      lockfilePath: null,
      lockfileSha256: null,
      frozenInstallExitCode: 1,
      frozenInstallSucceeded: false,
      error: "failed to parse lockfile",
    };

    const report = buildBenchmarkReport(
      refOptions,
      environment({
        lockedDependencies: false,
        lockfileSha256: "unavailable",
        frozenInstallDryRun: false,
      }),
      failedPreflight,
      referenceRuns(
        5,
        environment({
          lockedDependencies: false,
          lockfileSha256: "unavailable",
          frozenInstallDryRun: false,
        }),
      ),
    );

    expect(report.referenceGate.status).toBe("failed");
    expect(report.referenceGate.eligibility.lockedDependencies).toBe(false);
    expect(report.referenceGate.preflight.error).toBe(
      "failed to parse lockfile",
    );
    expect(report.referenceGate.preflight.frozenInstallExitCode).toBe(1);
  });

  it("reports diagnostic-only status without a reference request", () => {
    const report = buildBenchmarkReport(
      { ...refOptions, referenceRequested: false },
      environment(),
      referencePreflight(),
      referenceRuns(),
    );

    expect(report.referenceGate.status).toBe("diagnostic-only");
    expect(report.referenceGate.eligibility.requested).toBe(false);
  });

  it("keeps a diagnostic-only-size run ineligible for a reference pass", () => {
    const report = buildBenchmarkReport(
      {
        ...refOptions,
        referenceRequested: false,
        onlySize: SIZE,
        warmupRuns: 0,
        measuredRuns: 1,
      },
      environment(),
      skippedReferencePreflight(),
      referenceRuns(1).map((run) => ({
        ...run,
        cold: run.cold.filter(
          (measurement) => measurement.fixtureSize === SIZE,
        ),
        warm: run.warm.filter(
          (measurement) => measurement.fixtureSize === SIZE,
        ),
      })),
    );

    expect(report.referenceGate.status).toBe("diagnostic-only");
    expect(report.referenceGate.eligibility.requested).toBe(false);
    expect(report.fixtureSizes).toEqual([SIZE]);
  });
});

describe("large-text-benchmark-v1 options", () => {
  it("defaults to the three-run diagnostic protocol", () => {
    expect(parseOptions([])).toEqual({
      worker: false,
      buildMode: "source",
      referenceRequested: false,
      preflightVerified: false,
      warmupRuns: 3,
      measuredRuns: 5,
      onlySize: null,
    });
  });

  it("accepts the recorded reference protocol without a size narrowing", () => {
    expect(
      parseOptions([
        "--reference",
        "--build-mode=production",
        "--warmups=3",
        "--runs=5",
      ]),
    ).toEqual({
      worker: false,
      buildMode: "production",
      referenceRequested: true,
      preflightVerified: false,
      warmupRuns: 3,
      measuredRuns: 5,
      onlySize: null,
    });
  });

  it("rejects --only-size combined with --reference", () => {
    expect(() => parseOptions(["--reference", `--only-size=${SIZE}`])).toThrow(
      /reference run must cover all three fixture sizes/u,
    );
  });

  it("keeps --only-size available for diagnostics", () => {
    expect(
      parseOptions([`--only-size=${SIZE}`, "--warmups=0", "--runs=1"]),
    ).toMatchObject({
      referenceRequested: false,
      warmupRuns: 0,
      measuredRuns: 1,
      onlySize: SIZE,
    });
  });

  it("rejects unspecified fixture sizes and malformed counts", () => {
    expect(() => parseOptions(["--only-size=12345"])).toThrow(
      /only-size must be one of the versioned fixture sizes/u,
    );
    expect(() => parseOptions(["--runs=-1"])).toThrow(/non-negative/u);
    expect(() => parseOptions(["--warmups=1.5"])).toThrow(/safe integer/u);
    expect(() => parseOptions(["--build-mode=fast"])).toThrow(
      /source or production/u,
    );
    expect(() => parseOptions(["--unknown=1"])).toThrow(
      /Unknown benchmark argument/u,
    );
    expect(() => parseOptions(["--unknown"])).toThrow(/Missing value/u);
  });
});
