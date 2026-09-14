import type { ComponentType } from "react";
import type { LARGE_TEXT_BENCHMARK_V1 } from "../packages/ui/test/support/large-text-benchmark-v1.js";

export type BuildMode = "source" | "production";
export type SourceShape = "many-line" | "single-line";
export type ReferenceStatus = "diagnostic-only" | "passed" | "failed";

export const DEFAULT_WARMUP_RUNS = 3;
export const DEFAULT_MEASURED_RUNS = 5;
export const DEFAULT_BUILD_MODE: BuildMode = "source";
export const MINIMUM_BUN_VERSION = "1.4.0";

export type WarmOperation =
  | "unchanged-repaint"
  | "resize-and-return"
  | "vertical-scroll"
  | "horizontal-scroll"
  | "generated-line-append"
  | "same-line-append"
  | "correlated-replacement";

export type RenderWorkCounts = Readonly<{
  sourceCodeUnitsInspected: number;
  linesIndexed: number;
  graphemesPrepared: number;
  cellSlotsRetained: number;
  copiedGlyphPayloadCodeUnitsRetained: number;
  cellsPainted: number;
  entriesDisposed: number;
}>;

export type RenderHandle = {
  rerender(node: unknown): void;
  setSize(size: { width: number; height: number }): void;
  repaint(): void;
  clearWorkCounts(): void;
  getWorkCounts(): RenderWorkCounts;
  setScrollOffset(
    nodeId: number,
    offset: { readonly x: number; readonly y: number },
  ): boolean;
  getLayout(): {
    root: {
      nodeId: number;
      contentFrame: { width: number; height: number };
      contentSize: { width: number; height: number };
    };
  };
  unmount(): void;
};

export type Runtime = {
  Text: ComponentType<any>;
  ScrollView: ComponentType<any>;
  appendTextSourceSegment: (
    source: unknown,
    segment: { id: string; text: string },
  ) => unknown;
  createTextSource: (
    segments?: readonly { id: string; text: string }[],
  ) => unknown;
  extendTextSourceSegment: (
    source: unknown,
    id: string,
    delta: string,
  ) => unknown;
  replaceTextSourceSegment: (
    source: unknown,
    id: string,
    text: string,
  ) => unknown;
  renderStatic: (
    node: unknown,
    size: { width: number; height: number },
  ) => RenderHandle;
};

export type BenchmarkOptions = {
  readonly worker: boolean;
  readonly buildMode: BuildMode;
  readonly referenceRequested: boolean;
  readonly preflightVerified: boolean;
  readonly warmupRuns: number;
  readonly measuredRuns: number;
  readonly onlySize: number | null;
};

export type Environment = {
  readonly bunVersion: string;
  readonly operatingSystem: string;
  readonly osRelease: string;
  readonly architecture: string;
  readonly processor: string;
  readonly machineStatus: "physical" | "virtual" | "unknown";
  readonly supportedOperatingSystem: boolean;
  readonly lockedDependencies: boolean;
  readonly lockfileSha256: string;
  readonly frozenInstallDryRun: boolean;
  readonly buildMode: BuildMode;
};

/**
 * The reference preflight is deliberately separate from the worker environment.
 * `lockedDependencies` becomes true only after the frozen dry-run command
 * succeeds, so an operator must record a preceding successful
 * `bun install --frozen-lockfile` rather than lockfile existence alone.
 */
export type ReferencePreflight = {
  readonly lockfilePath: string | null;
  readonly lockfileSha256: string | null;
  readonly frozenInstallExitCode: number | null;
  readonly frozenInstallSucceeded: boolean;
  readonly error: string | null;
};

export type WorkDelta = RenderWorkCounts;

export type WorkSummary = {
  readonly cumulative: {
    readonly sourceCodeUnitsInspected: number;
    readonly linesIndexed: number;
    readonly graphemesPrepared: number;
    readonly cellsPainted: number;
    readonly entriesDisposed: number;
  };
  readonly maximumPerFrame: RenderWorkCounts;
  readonly finalRetained: {
    readonly cellSlotsRetained: number;
    readonly copiedGlyphPayloadCodeUnitsRetained: number;
  };
};

export type WarmMeasurement = {
  readonly operation: WarmOperation;
  readonly sourceShape: SourceShape;
  readonly fixtureSize: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly resizedViewport?: {
    readonly width: number;
    readonly height: number;
  };
  readonly operationCount: number;
  readonly initialFixtureCodeUnits: number;
  readonly finalFixtureCodeUnits: number;
  readonly maximumOffset?: number;
  readonly latencyMilliseconds: readonly number[];
  readonly eventLoopDelayMilliseconds: readonly number[];
  readonly latency: LatencyAggregate;
  readonly eventLoopDelay: {
    readonly maximumMilliseconds: number;
  };
  readonly work: WorkSummary;
  readonly disposal: RenderWorkCounts;
};

export type ColdMeasurement = {
  readonly operation: "cold-index-and-first-frame";
  readonly sourceShape: SourceShape;
  readonly fixtureSize: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly operationCount: 1;
  readonly latencyMilliseconds: number;
  readonly work: RenderWorkCounts;
  readonly disposal: RenderWorkCounts;
};

export type LatencyAggregate = {
  readonly medianMilliseconds: number;
  readonly p95Milliseconds: number;
  readonly maximumMilliseconds: number;
};

export type WorkerReport = {
  readonly workerPid: number;
  readonly environment: Environment;
  readonly cold: readonly ColdMeasurement[];
  readonly warm: readonly WarmMeasurement[];
};

export type BenchmarkReport = {
  readonly benchmark: "large-text-benchmark-v1";
  readonly fixtureVersion: typeof LARGE_TEXT_BENCHMARK_V1.version;
  readonly fixtureSizes: readonly number[];
  readonly viewport: { readonly width: number; readonly height: number };
  readonly resizedViewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly operationCount: number;
  readonly environment: Environment;
  readonly protocol: {
    readonly warmupRuns: number;
    readonly measuredRuns: number;
    readonly freshProcessMeasurements: boolean;
    readonly eventLoopDelayMeasurement: "zero-delay-timer";
    readonly referenceProcedureRequested: boolean;
  };
  readonly warmups: {
    readonly count: number;
    readonly recorded: false;
  };
  readonly runs: readonly (WorkerReport & { readonly runIndex: number })[];
  readonly aggregates: {
    readonly cold: readonly {
      readonly sourceShape: SourceShape;
      readonly fixtureSize: number;
      readonly samplesMilliseconds: readonly number[];
      readonly medianMilliseconds: number;
    }[];
    readonly warm: readonly {
      readonly operation: WarmOperation;
      readonly sourceShape: SourceShape;
      readonly fixtureSize: number;
      readonly samples: number;
      readonly p95Milliseconds: number;
      readonly maximumMilliseconds: number;
      readonly maximumEventLoopDelayMilliseconds: number;
    }[];
  };
  readonly deterministicCounters: {
    readonly checks: readonly CounterCheck[];
    readonly results: readonly {
      readonly operation: WarmOperation;
      readonly sourceShape: SourceShape;
      readonly fixtureSize: number;
      readonly work: WorkSummary;
      readonly disposal: RenderWorkCounts;
    }[];
  };
  readonly referenceGate: ReferenceGate;
};

export type CounterCheck = {
  readonly name: string;
  readonly status: "passed" | "failed" | "not-evaluated";
  readonly details: Readonly<Record<string, number | string | boolean>>;
};

export type ReferenceGate = {
  readonly status: ReferenceStatus;
  readonly eligible: boolean;
  readonly eligibility: Readonly<Record<string, boolean>>;
  readonly preflight: ReferencePreflight;
  readonly inventory: {
    readonly passed: boolean;
    readonly problems: readonly string[];
  };
  readonly thresholds: {
    readonly coldMedianMilliseconds: number;
    readonly warmP95Milliseconds: number;
    readonly maximumWarmEventLoopDelayMilliseconds: number;
  };
  readonly cold: readonly {
    readonly sourceShape: SourceShape;
    readonly fixtureSize: number;
    readonly medianMilliseconds: number;
    readonly passed: boolean;
  }[];
  readonly warmP95: readonly {
    readonly operation: WarmOperation;
    readonly sourceShape: SourceShape;
    readonly fixtureSize: number;
    readonly p95Milliseconds: number;
    readonly passed: boolean;
  }[];
  readonly maximumWarmEventLoopDelayMilliseconds: number;
  readonly warmEventLoopDelayPassed: boolean;
  readonly countersPassed: boolean;
};
