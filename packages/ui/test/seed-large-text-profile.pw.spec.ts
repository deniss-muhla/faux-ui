import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = process.env.SEED_LARGE_TEXT_PROFILE_OUTPUT;
const fauxRoot = resolve(import.meta.dirname, "../../..");
const fsUrl = (path: string): string => `/@fs${resolve(fauxRoot, path)}`;

test.describe("Seed large text profiling", () => {
  test.skip(
    outputPath === undefined,
    "Set SEED_LARGE_TEXT_PROFILE_OUTPUT to run profiling.",
  );

  test("records DOM projection for exact large-text fixtures", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/");
    const moduleUrls = {
      domUrl: fsUrl("packages/ui/src/dom.ts"),
      domSceneUrl: fsUrl("packages/ui/src/internal/dom-scene.ts"),
      fixtureUrl: fsUrl("packages/ui/test/support/large-text-benchmark-v1.ts"),
      uiUrl: fsUrl("packages/ui/src/index.ts"),
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await page.evaluate(async (urls) => {
          const reactUrl: string = "/@id/react";
          await Promise.all([
            import(reactUrl),
            import(urls.domUrl),
            import(urls.domSceneUrl),
            import(urls.fixtureUrl),
            import(urls.uiUrl),
          ]);
        }, moduleUrls);
        break;
      } catch (error) {
        if (
          attempt > 0 ||
          !String(error).includes("Execution context was destroyed")
        ) {
          throw error;
        }
        await page.waitForLoadState("networkidle");
      }
    }

    const result = await page.evaluate(async (urls) => {
      const reactUrl: string = "/@id/react";
      const react = await import(reactUrl);
      const createElement = react.createElement ?? react.default?.createElement;
      if (createElement === undefined)
        throw new Error("Missing React.createElement");
      const { render } = await import(urls.domUrl);
      const { DomSceneProjector } = await import(urls.domSceneUrl);
      const { LARGE_TEXT_BENCHMARK_V1, generateManyLineFixture } = await import(
        urls.fixtureUrl
      );
      const { Box, Columns, Rows, ScrollView, Text } = await import(urls.uiUrl);

      const updateCodeUnits = 64;
      const runId = "run-large-monitor-dom-profile";
      const sourceEvent = "profile.fixture";

      const blocksFromFixture = (value: string) => {
        const blocks = [];
        let start = 0;
        let sequence = 0;
        while (start < value.length) {
          const newline = value.indexOf("\n", start);
          const end = newline < 0 ? value.length : newline + 1;
          blocks.push({
            runId,
            blockId: `history-${sequence}`,
            firstSequence: sequence,
            lastSequence: sequence,
            text: value.slice(start, end),
          });
          start = end;
          sequence += 1;
        }
        return blocks;
      };
      const payloadCodeUnits = (state: {
        transcript: Array<{ text?: string }>;
      }) =>
        state.transcript.reduce(
          (total, block) => total + (block.text?.length ?? 0),
          0,
        );
      const transcriptText = (state: {
        transcript: Array<{ text?: string }>;
      }) =>
        state.transcript
          .map(
            (block) =>
              `[text] ${(block.text ?? "").replaceAll("\n", "\n       ")}`,
          )
          .join("\n");
      const monitor = (state: { transcript: Array<{ text?: string }> }) =>
        createElement(
          Rows,
          { tracks: [1, "1fr"] },
          createElement(
            Text,
            { style: { foreground: "muted" }, overflow: "ellipsis-end" },
            sourceEvent,
          ),
          createElement(
            Columns,
            { tracks: ["3fr", "2fr"], gap: 1 },
            createElement(
              Box,
              { border: true, title: " Pi chat ", padding: { x: 1 } },
              createElement(
                ScrollView,
                {
                  axis: "y",
                  followEnd: true,
                  focusable: true,
                  accessibleLabel: "Pi analysis chat",
                },
                createElement(
                  Text,
                  { overflow: "clip" },
                  transcriptText(state),
                ),
              ),
            ),
            createElement(
              Box,
              {
                border: true,
                title: " Provisional draft ",
                padding: { x: 1 },
              },
              createElement(
                ScrollView,
                {
                  axis: "y",
                  focusable: true,
                  accessibleLabel: "Provisional draft",
                },
                createElement(
                  Text,
                  { overflow: "clip" },
                  "Provisional artifacts · 0\n  • none\nStory progress (non-canonical) · 0\n  • none",
                ),
              ),
            ),
          ),
        );
      const results = [];

      for (const fixtureCodeUnits of LARGE_TEXT_BENCHMARK_V1.retainedSizes) {
        for (const profileCase of [
          "new-block-append",
          "correlated-block-update",
        ] as const) {
          const history = generateManyLineFixture(fixtureCodeUnits);
          let state = { transcript: blocksFromFixture(history) };
          const correlatedIndex = Math.floor(state.transcript.length / 2);
          const correlated = state.transcript[correlatedIndex];
          if (correlated === undefined)
            throw new Error("Missing history block.");
          const payloadCodeUnitsBeforeUpdate = payloadCodeUnits(state);

          document.body.replaceChildren();
          document.body.style.margin = "0";
          const handle = render(
            monitor(state),
            LARGE_TEXT_BENCHMARK_V1.viewport,
          );
          const started = performance.now();
          const delta = "z".repeat(updateCodeUnits);
          state = {
            transcript:
              profileCase === "new-block-append"
                ? [
                    ...state.transcript,
                    {
                      runId,
                      blockId: "appended-block",
                      firstSequence: state.transcript.length,
                      lastSequence: state.transcript.length,
                      text: delta,
                    },
                  ]
                : state.transcript.map((block, index) =>
                    index === correlatedIndex
                      ? { ...block, text: `${block.text ?? ""}${delta}` }
                      : block,
                  ),
          };
          handle.rerender(monitor(state));
          const browserWarmLatencyMilliseconds = performance.now() - started;

          const surface = document.createElement("div");
          document.body.append(surface);
          const projector = new DomSceneProjector(surface, {
            ariaLabel: "DOM projection profile",
            cellSize: { width: 8, height: 16 },
          });
          const projectionStarted = performance.now();
          const projectionWork = projector.updateScene(handle.getScene());
          const domProjectionMilliseconds =
            performance.now() - projectionStarted;
          const measuredPayloadCodeUnits = payloadCodeUnits(state);
          surface.remove();
          handle.unmount();

          if (payloadCodeUnitsBeforeUpdate !== fixtureCodeUnits) {
            throw new Error(
              `Profile history did not start at ${fixtureCodeUnits} code units.`,
            );
          }
          if (measuredPayloadCodeUnits !== fixtureCodeUnits + updateCodeUnits) {
            throw new Error("Profile update did not add the fixed-size delta.");
          }
          results.push({
            fixtureCodeUnits,
            case: profileCase,
            historyBlocksAfterUpdate: state.transcript.length,
            payloadCodeUnitsBeforeUpdate,
            payloadCodeUnitsAfterUpdate: measuredPayloadCodeUnits,
            browserWarmLatencyMilliseconds,
            domProjection: {
              milliseconds: domProjectionMilliseconds,
              shareOfWarmLatency:
                browserWarmLatencyMilliseconds === 0
                  ? 0
                  : domProjectionMilliseconds / browserWarmLatencyMilliseconds,
              work: projectionWork,
            },
          });
        }
      }

      return {
        profile: "seed-analysis-monitor-dom-projection-v1",
        fixtureVersion: LARGE_TEXT_BENCHMARK_V1.version,
        runtime: navigator.userAgent,
        viewport: LARGE_TEXT_BENCHMARK_V1.viewport,
        updateCodeUnits,
        cases: results,
      };
    }, moduleUrls);

    expect(result.cases).toHaveLength(6);
    expect(
      result.cases.every((entry) => entry.domProjection.work.cells === 3_600),
    ).toBe(true);
    if (outputPath === undefined)
      throw new Error("Missing profile output path.");
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  });
});
