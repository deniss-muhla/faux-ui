import { existsSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createElement } from "react";

import {
  LARGE_TEXT_BENCHMARK_V1,
  LARGE_TEXT_BENCHMARK_V1_WARM_CASES,
  generateCorrelatedReplacementFixture,
  generateLineAppendFixture,
  generateManyLineFixture,
  generateResizeOperations,
  generateSameLineAppendFixture,
  generateScrollOperations,
  generateSingleLineFixture,
  generateUnchangedRepaintOperations,
} from "../packages/ui/test/support/large-text-benchmark-v1.js";
import type {
  BenchmarkOptions,
  BuildMode,
  ColdMeasurement,
  ReferencePreflight,
  RenderHandle,
  Runtime,
  SourceShape,
  WarmMeasurement,
  WorkerReport,
  WarmOperation,
  WorkDelta,
} from "./benchmark-v1-types.js";
import {
  aggregateLatencies,
  summarizeWork,
  workDelta,
} from "./benchmark-v1-report.js";
import {
  collectEnvironment,
  finiteMilliseconds,
  skippedReferencePreflight,
} from "./benchmark-v1-environment.js";

const viewport = LARGE_TEXT_BENCHMARK_V1.viewport;
const resizedViewport = LARGE_TEXT_BENCHMARK_V1.resizedViewport;

export async function runWorker(
  benchmarkOptions: BenchmarkOptions,
): Promise<WorkerReport> {
  const runtime = await loadRuntime(benchmarkOptions.buildMode);
  const sizes =
    benchmarkOptions.onlySize === null
      ? LARGE_TEXT_BENCHMARK_V1.retainedSizes
      : [benchmarkOptions.onlySize];
  const cold: ColdMeasurement[] = [];
  const warm: WarmMeasurement[] = [];

  for (const fixtureSize of sizes) {
    cold.push(measureCold(runtime, fixtureSize, "many-line"));
    cold.push(measureCold(runtime, fixtureSize, "single-line"));

    for (const warmCase of LARGE_TEXT_BENCHMARK_V1_WARM_CASES) {
      warm.push(
        await measureWarm(
          runtime,
          fixtureSize,
          warmCase.operation,
          warmCase.sourceShape,
        ),
      );
    }
  }

  return {
    workerPid: process.pid,
    environment: collectEnvironment(
      benchmarkOptions.buildMode,
      workerPreflight(benchmarkOptions),
    ),
    cold,
    warm,
  };
}

/**
 * A worker shares the orchestrator's frozen-install verdict instead of spawning
 * another install. The digest is still read in this process, so a lockfile that
 * changes between the preflight and a measurement fails the reference match.
 */
function workerPreflight(
  benchmarkOptions: BenchmarkOptions,
): ReferencePreflight {
  const preflight = skippedReferencePreflight();
  if (!benchmarkOptions.preflightVerified) return preflight;
  return {
    ...preflight,
    frozenInstallExitCode: 0,
    frozenInstallSucceeded: true,
  };
}

async function loadRuntime(buildMode: BuildMode): Promise<Runtime> {
  const packageRoot = buildMode === "production" ? "dist" : "src";
  const suffix = buildMode === "production" ? "js" : "ts";
  if (buildMode === "production") {
    const distUi = new URL("../packages/ui/dist/index.js", import.meta.url);
    const distTesting = new URL(
      "../packages/ui/dist/testing.js",
      import.meta.url,
    );
    if (
      !existsSync(fileURLToPath(distUi)) ||
      !existsSync(fileURLToPath(distTesting))
    ) {
      throw new Error(
        "Production benchmark mode requires a built Faux UI package.",
      );
    }
  }
  const ui = (await import(
    new URL(`../packages/ui/${packageRoot}/index.${suffix}`, import.meta.url)
      .href
  )) as Record<string, unknown>;
  const testing = (await import(
    new URL(`../packages/ui/${packageRoot}/testing.${suffix}`, import.meta.url)
      .href
  )) as Record<string, unknown>;

  const required = {
    Text: ui.Text,
    ScrollView: ui.ScrollView,
    appendTextSourceSegment: ui.appendTextSourceSegment,
    createTextSource: ui.createTextSource,
    extendTextSourceSegment: ui.extendTextSourceSegment,
    replaceTextSourceSegment: ui.replaceTextSourceSegment,
    renderStatic: testing.renderStatic,
  };
  for (const [name, value] of Object.entries(required)) {
    if (typeof value !== "function") {
      throw new Error(`Benchmark runtime export is missing: ${name}.`);
    }
  }
  return required as Runtime;
}

function measureCold(
  runtime: Runtime,
  fixtureSize: number,
  sourceShape: SourceShape,
): ColdMeasurement {
  const source = createInitialSource(runtime, fixtureSize, sourceShape);
  const started = performance.now();
  const app = renderFixture(
    runtime,
    source,
    scrollAxisFor(sourceShape, "cold"),
    viewport,
  );
  const latencyMilliseconds = performance.now() - started;
  const work = app.getWorkCounts();
  app.unmount();
  const disposal = app.getWorkCounts();
  return {
    operation: "cold-index-and-first-frame",
    sourceShape,
    fixtureSize,
    viewport,
    operationCount: 1,
    latencyMilliseconds,
    work,
    disposal,
  };
}

async function measureWarm(
  runtime: Runtime,
  fixtureSize: number,
  operation: WarmOperation,
  sourceShape: SourceShape,
): Promise<WarmMeasurement> {
  const setup = setupWarmCase(runtime, fixtureSize, operation, sourceShape);
  const app = setup.app;
  app.clearWorkCounts();
  let previousWork = app.getWorkCounts();
  const latencies: number[] = [];
  const eventLoopDelays: number[] = [];
  const frameWorks: WorkDelta[] = [];
  const delayMonitor = monitorEventLoopDelay({ resolution: 10 });
  delayMonitor.enable();

  try {
    for (
      let index = 0;
      index < LARGE_TEXT_BENCHMARK_V1.operationCount;
      index += 1
    ) {
      // Schedule before the synchronous frame so the timer observes loop blockage.
      const scheduledAt = performance.now();
      const delay = new Promise<number>((resolve) => {
        setTimeout(() => resolve(performance.now() - scheduledAt), 0);
      });
      const started = performance.now();
      setup.apply(index);
      latencies.push(performance.now() - started);
      eventLoopDelays.push(await delay);
      const nextWork = app.getWorkCounts();
      frameWorks.push(workDelta(previousWork, nextWork));
      previousWork = nextWork;
    }
  } finally {
    delayMonitor.disable();
  }

  const histogramMaximum = finiteMilliseconds(delayMonitor.max);
  const maximumEventLoopDelay = Math.max(
    ...eventLoopDelays,
    histogramMaximum,
    0,
  );
  const work = summarizeWork(frameWorks);
  const finalFixtureCodeUnits = setup.currentFixtureCodeUnits();
  app.unmount();
  const disposal = app.getWorkCounts();
  return {
    operation,
    sourceShape,
    fixtureSize,
    viewport,
    ...(operation === "resize-and-return" ? { resizedViewport } : {}),
    operationCount: LARGE_TEXT_BENCHMARK_V1.operationCount,
    initialFixtureCodeUnits: setup.initialFixtureCodeUnits,
    finalFixtureCodeUnits,
    ...(setup.maximumOffset === undefined
      ? {}
      : { maximumOffset: setup.maximumOffset }),
    latencyMilliseconds: latencies,
    eventLoopDelayMilliseconds: eventLoopDelays,
    latency: aggregateLatencies(latencies),
    eventLoopDelay: { maximumMilliseconds: maximumEventLoopDelay },
    work,
    disposal,
  };
}

type WarmCaseSetup = {
  readonly app: RenderHandle;
  readonly apply: (index: number) => void;
  readonly initialFixtureCodeUnits: number;
  readonly currentFixtureCodeUnits: () => number;
  readonly maximumOffset?: number | undefined;
};

function setupWarmCase(
  runtime: Runtime,
  fixtureSize: number,
  operation: WarmOperation,
  sourceShape: SourceShape,
): WarmCaseSetup {
  const replacementFixture =
    operation === "correlated-replacement"
      ? generateCorrelatedReplacementFixture(fixtureSize)
      : null;
  let source =
    replacementFixture === null
      ? createInitialSource(runtime, fixtureSize, sourceShape)
      : runtime.createTextSource([
          { id: "history", text: replacementFixture.history },
          { id: "replacement", text: replacementFixture.replacement },
        ]);
  const axis = scrollAxisFor(sourceShape, operation);
  const app = renderFixture(runtime, source, axis, viewport);
  const layoutRoot = app.getLayout().root;
  const maximumOffset =
    operation === "vertical-scroll" || operation === "horizontal-scroll"
      ? Math.max(
          0,
          axis === "x"
            ? layoutRoot.contentSize.width - layoutRoot.contentFrame.width
            : layoutRoot.contentSize.height - layoutRoot.contentFrame.height,
        )
      : undefined;
  const initialFixtureCodeUnits = fixtureSize;

  if (operation === "unchanged-repaint") {
    const operations = generateUnchangedRepaintOperations();
    return {
      app,
      initialFixtureCodeUnits,
      currentFixtureCodeUnits: () => fixtureSize,
      apply: (index) => {
        if (operations[index] !== "repaint") {
          throw new Error("Missing unchanged repaint operation.");
        }
        app.repaint();
      },
    };
  }

  if (operation === "resize-and-return") {
    const operations = generateResizeOperations();
    return {
      app,
      initialFixtureCodeUnits,
      currentFixtureCodeUnits: () => fixtureSize,
      apply: (index) => app.setSize(operations[index] ?? viewport),
    };
  }

  if (operation === "vertical-scroll" || operation === "horizontal-scroll") {
    const offsets = generateScrollOperations(maximumOffset ?? 0);
    return {
      app,
      initialFixtureCodeUnits,
      currentFixtureCodeUnits: () => fixtureSize,
      maximumOffset,
      apply: (index) => {
        const offset = offsets[index] ?? 0;
        app.setScrollOffset(
          layoutRoot.nodeId,
          axis === "x" ? { x: offset, y: 0 } : { x: 0, y: offset },
        );
      },
    };
  }

  if (operation === "generated-line-append") {
    const fixture = generateLineAppendFixture(fixtureSize);
    return {
      app,
      initialFixtureCodeUnits,
      currentFixtureCodeUnits: () =>
        fixtureSize +
        fixture.updates.reduce((sum, update) => sum + update.text.length, 0),
      apply: (index) => {
        const update = fixture.updates[index];
        if (update === undefined)
          throw new Error("Missing generated line update.");
        source = runtime.appendTextSourceSegment(source, update);
        app.rerender(renderFixtureNode(runtime, source, axis));
      },
    };
  }

  if (operation === "same-line-append") {
    const fixture = generateSameLineAppendFixture(fixtureSize);
    return {
      app,
      initialFixtureCodeUnits,
      currentFixtureCodeUnits: () =>
        fixtureSize + fixture.updates.length * fixture.updates[0]!.length,
      apply: (index) => {
        const delta = fixture.updates[index];
        if (delta === undefined) throw new Error("Missing same-line update.");
        source = runtime.extendTextSourceSegment(source, "growing", delta);
        app.rerender(renderFixtureNode(runtime, source, axis));
      },
    };
  }

  const fixture = replacementFixture;
  if (fixture === null) throw new Error("Missing replacement fixture.");
  return {
    app,
    initialFixtureCodeUnits,
    currentFixtureCodeUnits: () => fixtureSize,
    apply: (index) => {
      const replacement = fixture.updates[index];
      if (replacement === undefined)
        throw new Error("Missing replacement update.");
      source = runtime.replaceTextSourceSegment(
        source,
        "replacement",
        replacement,
      );
      app.rerender(renderFixtureNode(runtime, source, axis));
    },
  };
}

function renderFixture(
  runtime: Runtime,
  source: unknown,
  axis: "x" | "y",
  size: { width: number; height: number },
): RenderHandle {
  return runtime.renderStatic(renderFixtureNode(runtime, source, axis), size);
}

function renderFixtureNode(
  runtime: Runtime,
  source: unknown,
  axis: "x" | "y",
): unknown {
  return createElement(
    runtime.ScrollView,
    { axis },
    createElement(runtime.Text, { source }),
  );
}

function createInitialSource(
  runtime: Runtime,
  fixtureSize: number,
  sourceShape: SourceShape,
): unknown {
  const text =
    sourceShape === "many-line"
      ? generateManyLineFixture(fixtureSize)
      : generateSingleLineFixture(fixtureSize);
  return runtime.createTextSource([
    { id: sourceShape === "many-line" ? "history" : "growing", text },
  ]);
}

function scrollAxisFor(
  sourceShape: SourceShape,
  operation: WarmOperation | "cold",
): "x" | "y" {
  if (operation === "horizontal-scroll") return "x";
  if (operation === "same-line-append") return "x";
  if (operation === "cold" && sourceShape === "single-line") return "x";
  return "y";
}
