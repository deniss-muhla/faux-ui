/**
 * Focused diagnostic for interaction-only mount work over the exact
 * 667,633-code-unit benchmark fixture. It reports per-case indexing, layout,
 * and scene work plus warm latency for repeated scroll, focus, hover, and
 * explicit repaint so the current full path and a candidate build can be
 * compared with paired diagnostic runs when deciding whether to retain
 * mount-local invalidation priorities. It is not a pass/fail gate and it never
 * prints fixture text.
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
const TRANSCRIPT_ROWS = 28;
const CONTROL_ROWS = VIEWPORT.height - TRANSCRIPT_ROWS;
const OPERATION_COUNT = 100;
const SCROLL_START_FRACTION = 0.5;
const TRANSCRIPT_POINT = { x: 10, y: 5 } as const;
const CONTROL_POINT = { x: 1, y: TRANSCRIPT_ROWS + 1 } as const;

type BuildMode = "source" | "production";
type SourceShape = "many-line" | "single-line";

const interactionCases = [
  { name: "vertical-scroll", operation: "scroll", sourceShape: "many-line" },
  {
    name: "horizontal-scroll",
    operation: "scroll",
    sourceShape: "single-line",
  },
  { name: "focus-toggle", operation: "focus", sourceShape: "many-line" },
  { name: "hover-toggle", operation: "hover", sourceShape: "many-line" },
  { name: "explicit-repaint", operation: "repaint", sourceShape: "many-line" },
] as const satisfies readonly {
  readonly name: string;
  readonly operation: "scroll" | "focus" | "hover" | "repaint";
  readonly sourceShape: SourceShape;
}[];

interface Runtime {
  readonly Button: unknown;
  readonly Rows: unknown;
  readonly ScrollView: unknown;
  readonly Text: unknown;
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
  readonly children: readonly LayoutExtent[];
}

interface RenderHandle {
  scroll(input: {
    readonly x: number;
    readonly y: number;
    readonly deltaX: number;
    readonly deltaY: number;
  }): unknown;
  keyDown(input: { readonly key: string }): unknown;
  pointerMove(input: { readonly x: number; readonly y: number }): unknown;
  repaint(): void;
  getLayout(): { readonly root: LayoutExtent };
  getWorkCounts(): Record<WorkCounter, number>;
  getStageWorkCounts(): Record<RenderStage, Record<WorkCounter, number>>;
  getStageDurations(): {
    readonly indexingMilliseconds: number;
    readonly layoutMilliseconds: number;
    readonly sceneMilliseconds: number;
  };
  clearWorkCounts(): void;
  unmount(): void;
}

type RenderStage = "indexing" | "layout" | "scene";

type WorkCounter =
  | "sourceCodeUnitsInspected"
  | "metadataRecordsSearched"
  | "linesIndexed"
  | "graphemesPrepared"
  | "cellSlotsRetained"
  | "copiedGlyphPayloadCodeUnitsRetained"
  | "cellsPainted"
  | "entriesDisposed";

const workCounters = [
  "sourceCodeUnitsInspected",
  "metadataRecordsSearched",
  "linesIndexed",
  "graphemesPrepared",
  "cellsPainted",
  "entriesDisposed",
] as const satisfies readonly WorkCounter[];
const retainedCounters = [
  "cellSlotsRetained",
  "copiedGlyphPayloadCodeUnitsRetained",
] as const satisfies readonly WorkCounter[];
const renderStages = [
  "indexing",
  "layout",
  "scene",
] as const satisfies readonly RenderStage[];

const buildMode = parseBuildMode(process.argv.slice(2));
const runtime = await loadRuntime(buildMode);
const cases = [];

for (const interaction of interactionCases) {
  cases.push(measureInteraction(runtime, interaction));
}

process.stdout.write(
  `${JSON.stringify(
    {
      protocol: "interaction-invalidation-measurement-v1",
      recordedAt: new Date().toISOString(),
      buildMode,
      fixtureCodeUnits: FIXTURE_CODE_UNITS,
      viewport: VIEWPORT,
      operationCount: OPERATION_COUNT,
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
    Button: ui.Button,
    Rows: ui.Rows,
    ScrollView: ui.ScrollView,
    Text: ui.Text,
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

function measureInteraction(
  measured: Runtime,
  interaction: (typeof interactionCases)[number],
): unknown {
  const text =
    interaction.sourceShape === "many-line"
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
      measured.Rows,
      { tracks: [TRANSCRIPT_ROWS, CONTROL_ROWS] },
      createElement(
        measured.ScrollView,
        {
          axis: "both",
          focusable: true,
          accessibleLabel: "transcript",
        },
        createElement(measured.Text, { source }),
      ),
      createElement(measured.Button, {
        label: "Go",
        padding: 0,
        onPress: () => {},
      }),
    ),
    VIEWPORT,
  );

  try {
    const scrollRoot = app.getLayout().root.children[0];
    if (scrollRoot === undefined) {
      throw new Error("Measurement workload is missing its scroll view.");
    }
    const scrollExtent = {
      x: scrollRoot.contentSize.width - scrollRoot.contentFrame.width,
      y: scrollRoot.contentSize.height - scrollRoot.contentFrame.height,
    };
    const operation = interactionOperation(interaction, app, scrollExtent);

    app.clearWorkCounts();
    const latencies: number[] = [];
    for (let index = 0; index < OPERATION_COUNT; index += 1) {
      const startedAt = performance.now();
      operation(index);
      latencies.push(performance.now() - startedAt);
    }

    const work = app.getWorkCounts();
    const stageWork = app.getStageWorkCounts();
    const stageDurations = app.getStageDurations();
    return {
      name: interaction.name,
      operation: interaction.operation,
      sourceShape: interaction.sourceShape,
      operationCount: OPERATION_COUNT,
      scrollExtent,
      work: Object.fromEntries(workCounters.map((name) => [name, work[name]])),
      stages: Object.fromEntries(
        renderStages.map((stage) => [
          stage,
          {
            work: Object.fromEntries(
              workCounters.map((name) => [name, stageWork[stage][name]]),
            ),
            durationMilliseconds: stageDurations[`${stage}Milliseconds`],
          },
        ]),
      ),
      retained: Object.fromEntries(
        retainedCounters.map((name) => [name, work[name]]),
      ),
      latencyMilliseconds: summarize(latencies),
    };
  } finally {
    app.unmount();
  }
}

function interactionOperation(
  interaction: (typeof interactionCases)[number],
  app: RenderHandle,
  scrollExtent: { readonly x: number; readonly y: number },
): (index: number) => void {
  if (interaction.operation === "repaint") {
    return () => app.repaint();
  }
  if (interaction.operation === "focus") {
    return () => app.keyDown({ key: "Tab" });
  }
  if (interaction.operation === "hover") {
    return (index) =>
      app.pointerMove(index % 2 === 0 ? TRANSCRIPT_POINT : CONTROL_POINT);
  }

  const vertical = interaction.sourceShape === "many-line";
  const extent = vertical ? scrollExtent.y : scrollExtent.x;
  if (extent < OPERATION_COUNT) {
    throw new Error(`Scroll extent ${extent} cannot fit the operations.`);
  }
  const start = Math.floor(extent * SCROLL_START_FRACTION);
  app.scroll({
    ...TRANSCRIPT_POINT,
    deltaX: vertical ? 0 : start,
    deltaY: vertical ? start : 0,
  });
  return () =>
    app.scroll({
      ...TRANSCRIPT_POINT,
      deltaX: vertical ? 0 : 1,
      deltaY: vertical ? 1 : 0,
    });
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
