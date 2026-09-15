/**
 * Focused diagnostic for prepared-window reuse over the exact
 * 667,633-code-unit benchmark fixture. It reports per-movement source work and
 * retained-cell counters so a baseline build and a candidate build can be
 * compared with paired runs before overlap reuse is retained. It is not a
 * pass/fail gate and it never prints fixture text.
 */

import { existsSync } from "node:fs";
import { arch, cpus, platform, release } from "node:os";
import { fileURLToPath } from "node:url";
import { createElement } from "react";

import {
  generateManyLineFixture,
  generateSingleLineFixture,
} from "../packages/ui/test/support/large-text-benchmark-v1.js";

const FIXTURE_CODE_UNITS = 667_633;
const VIEWPORT = { width: 120, height: 30 } as const;
const MAXIMUM_MOVEMENT_STEPS = 100;
const MINIMUM_MOVEMENT_STEPS = 32;

type BuildMode = "source" | "production";
type SourceShape = "many-line" | "single-line";

const movementCases = [
  {
    name: "one-row-many-line",
    sourceShape: "many-line",
    axis: "y",
    direction: "row",
  },
  {
    name: "one-column-many-line",
    sourceShape: "many-line",
    axis: "both",
    direction: "column",
  },
  {
    name: "one-column-single-line",
    sourceShape: "single-line",
    axis: "x",
    direction: "column",
  },
] as const satisfies readonly {
  readonly name: string;
  readonly sourceShape: SourceShape;
  readonly axis: "x" | "y" | "both";
  readonly direction: "row" | "column";
}[];

interface Runtime {
  readonly Text: unknown;
  readonly ScrollView: unknown;
  readonly createTextSource: (
    segments: readonly { readonly id: string; readonly text: string }[],
  ) => unknown;
  readonly renderStatic: (node: unknown, size: MeasuredSize) => RenderHandle;
}

interface MeasuredSize {
  readonly width: number;
  readonly height: number;
}

interface LayoutExtent {
  readonly nodeId: number;
  readonly contentSize: MeasuredSize;
  readonly contentFrame: MeasuredSize;
}

interface RenderHandle {
  setScrollOffset(
    nodeId: number,
    offset: { readonly x: number; readonly y: number },
  ): boolean;
  getLayout(): { readonly root: LayoutExtent };
  getWorkCounts(): Record<WorkCounter, number>;
  clearWorkCounts(): void;
  unmount(): void;
}

type WorkCounter =
  | "sourceCodeUnitsInspected"
  | "metadataRecordsSearched"
  | "linesIndexed"
  | "graphemesPrepared"
  | "cellSlotsRetained"
  | "copiedGlyphPayloadCodeUnitsRetained"
  | "cellsPainted"
  | "entriesDisposed";

const stepCounters = [
  "sourceCodeUnitsInspected",
  "metadataRecordsSearched",
  "linesIndexed",
  "graphemesPrepared",
  "cellsPainted",
] as const satisfies readonly WorkCounter[];
const retainedCounters = [
  "cellSlotsRetained",
  "copiedGlyphPayloadCodeUnitsRetained",
] as const satisfies readonly WorkCounter[];

const buildMode = parseBuildMode(process.argv.slice(2));
const runtime = await loadRuntime(buildMode);
const cases = [];

for (const movement of movementCases) {
  cases.push(measureMovement(runtime, movement));
}

process.stdout.write(
  `${JSON.stringify(
    {
      protocol: "window-reuse-measurement-v1",
      recordedAt: new Date().toISOString(),
      buildMode,
      fixtureCodeUnits: FIXTURE_CODE_UNITS,
      viewport: VIEWPORT,
      maximumMovementSteps: MAXIMUM_MOVEMENT_STEPS,
      environment: {
        bunVersion: process.versions.bun ?? "unknown",
        operatingSystem: platform(),
        osRelease: release(),
        architecture: arch(),
        processor: cpus()[0]?.model ?? "unknown",
      },
      cases,
    },
    null,
    2,
  )}\n`,
);

function parseBuildMode(args: readonly string[]): BuildMode {
  let mode: BuildMode = "production";
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--build-mode") {
      const value = args[index + 1];
      if (value !== "source" && value !== "production") {
        throw new Error(`Unsupported build mode: ${String(value)}.`);
      }
      mode = value;
      index += 1;
    }
  }
  return mode;
}

async function loadRuntime(mode: BuildMode): Promise<Runtime> {
  const packageRoot = mode === "production" ? "dist" : "src";
  const suffix = mode === "production" ? "js" : "ts";
  if (mode === "production") {
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
        "Production measurement mode requires a built Faux UI package.",
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
    createTextSource: ui.createTextSource,
    renderStatic: testing.renderStatic,
  };
  for (const [name, value] of Object.entries(required)) {
    if (typeof value !== "function") {
      throw new Error(`Measurement runtime export is missing: ${name}.`);
    }
  }
  return required as Runtime;
}

function measureMovement(
  measured: Runtime,
  movement: (typeof movementCases)[number],
): unknown {
  const text =
    movement.sourceShape === "many-line"
      ? generateManyLineFixture(FIXTURE_CODE_UNITS)
      : generateSingleLineFixture(FIXTURE_CODE_UNITS);
  if (text.length !== FIXTURE_CODE_UNITS) {
    throw new Error(
      `Fixture must be exactly ${FIXTURE_CODE_UNITS} code units.`,
    );
  }

  const source = measured.createTextSource([{ id: "history", text }]);
  const app = measured.renderStatic(
    createElement(
      measured.ScrollView,
      { axis: movement.axis },
      createElement(measured.Text, { source }),
    ),
    VIEWPORT,
  );

  try {
    const layout = app.getLayout().root;
    const extent =
      movement.direction === "row"
        ? layout.contentSize.height - layout.contentFrame.height
        : layout.contentSize.width - layout.contentFrame.width;
    const steps = Math.min(MAXIMUM_MOVEMENT_STEPS, extent);
    if (steps < MINIMUM_MOVEMENT_STEPS) {
      throw new Error(`Scroll extent ${extent} cannot fit the steps.`);
    }
    const start = Math.floor((extent - steps) / 2);
    const offsetAt = (value: number) =>
      movement.direction === "row" ? { x: 0, y: value } : { x: value, y: 0 };
    app.setScrollOffset(layout.nodeId, offsetAt(start));
    app.clearWorkCounts();

    let previous = app.getWorkCounts();
    const measuredSteps: Record<string, number>[] = [];
    for (let index = 1; index <= steps; index += 1) {
      const startedAt = performance.now();
      app.setScrollOffset(layout.nodeId, offsetAt(start + index));
      const latencyMilliseconds = performance.now() - startedAt;
      const current = app.getWorkCounts();
      const step: Record<string, number> = { latencyMilliseconds };
      for (const counter of stepCounters) {
        step[counter] = current[counter] - previous[counter];
      }
      for (const counter of retainedCounters) step[counter] = current[counter];
      measuredSteps.push(step);
      previous = current;
    }

    return {
      name: movement.name,
      sourceShape: movement.sourceShape,
      axis: movement.axis,
      direction: movement.direction,
      startOffset: start,
      extent,
      steps,
      work: Object.fromEntries(
        stepCounters.map((counter) => [
          counter,
          summarize(measuredSteps.map((step) => step[counter] ?? 0)),
        ]),
      ),
      retained: Object.fromEntries(
        retainedCounters.map((counter) => [
          counter,
          summarize(measuredSteps.map((step) => step[counter] ?? 0)),
        ]),
      ),
      latencyMilliseconds: summarize(
        measuredSteps.map((step) => step.latencyMilliseconds ?? 0),
      ),
    };
  } finally {
    app.unmount();
  }
}

function summarize(values: readonly number[]): {
  readonly total: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly median: number;
  readonly p95: number;
} {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (quantile: number): number => {
    if (sorted.length === 0) return 0;
    const rank = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
    return sorted[rank] ?? 0;
  };
  return {
    total: values.reduce((sum, value) => sum + value, 0),
    minimum: sorted[0] ?? 0,
    maximum: sorted.at(-1) ?? 0,
    median: percentile(0.5),
    p95: percentile(0.95),
  };
}
