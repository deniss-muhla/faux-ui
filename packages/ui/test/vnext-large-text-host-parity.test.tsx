import { describe, expect, it } from "vitest";

import { defaultPalette } from "../src/internal/palette.js";
import { sceneToText } from "../src/internal/scene.js";
import { render as renderTui } from "../src/tui.js";
import { inspectTextSource, renderStatic } from "../src/testing.js";
import {
  LARGE_TEXT_HOST_PARITY_RESIZED_SIZE,
  LARGE_TEXT_HOST_PARITY_SIZE,
  appendLargeTextHostParitySegment,
  canonicalHostScene,
  createHostParityRecorder,
  createLargeTextHostParitySource,
  createLargeTextHostParityView,
  extendLargeTextHostParitySegment,
  replaceLargeTextHostParitySegment,
} from "./support/large-text-host-parity.js";
import {
  FakeTerminalInput,
  FakeTerminalOutput,
  expectedTerminalGrid,
} from "./support/fake-terminal.js";

describe("large text static and TUI parity", () => {
  it(
    "keeps the canonical scene, controller events, and terminal lifecycle equal",
    { timeout: 30_000 },
    () => {
      let source = createLargeTextHostParitySource();
      const staticRecorder = createHostParityRecorder();
      const tuiRecorder = createHostParityRecorder();
      const input = new FakeTerminalInput();
      const output = new FakeTerminalOutput(
        LARGE_TEXT_HOST_PARITY_SIZE.width,
        LARGE_TEXT_HOST_PARITY_SIZE.height,
      );
      const staticApp = renderStatic(
        createLargeTextHostParityView(source, staticRecorder),
        LARGE_TEXT_HOST_PARITY_SIZE,
      );
      const tui = renderTui(
        createLargeTextHostParityView(source, tuiRecorder),
        {
          input,
          output,
          mouse: true,
          width: LARGE_TEXT_HOST_PARITY_SIZE.width,
          height: LARGE_TEXT_HOST_PARITY_SIZE.height,
        },
      );

      let expectedClears = output.clears;
      const assertParity = (step: string, fullRedraw = false): void => {
        const staticScene = staticApp.getScene();
        const tuiScene = tui.getScene();
        expect(canonicalHostScene(tuiScene), step).toEqual(
          canonicalHostScene(staticScene),
        );
        expect(Object.keys(staticScene).sort(), step).toEqual([
          "cells",
          "height",
          "width",
        ]);
        expect(Object.keys(tuiScene).sort(), step).toEqual([
          "cells",
          "height",
          "width",
        ]);
        expect(tuiScene, step).toEqual(staticScene);
        expect(sceneToText(tuiScene), step).toBe(sceneToText(staticScene));
        expect(tuiRecorder.events, step).toEqual(staticRecorder.events);
        const rootId = staticApp.getLayout().root.nodeId;
        const textId = staticApp.getTextIndexes()[0]?.nodeId;
        if (textId === undefined) throw new Error("Expected one text index.");
        expect(staticApp.getEventTrace(), step).toEqual(
          staticRecorder.events.map((event) => ({
            type: event.type,
            targetId: event.target.kind === "text" ? textId : rootId,
            currentTargetId:
              event.currentTarget.kind === "text" ? textId : rootId,
          })),
        );
        expect(output.snapshot(), step).toEqual(
          expectedTerminalGrid(tuiScene, defaultPalette),
        );
        if (fullRedraw) expectedClears += 1;
        expect(output.clears, step).toBe(expectedClears);
      };

      try {
        expect(sourceTextLength(source)).toBe(667_633);
        assertParity("initial large source");

        staticApp.keyDown({ key: "Tab" });
        input.emit("\t");
        assertParity("focus through Tab");

        staticApp.keyDown({ key: "Home" });
        input.emit("\u001b[H");
        assertParity("home offset");

        staticApp.keyDown({ key: "ArrowRight" });
        input.emit("\u001b[C");
        assertParity("horizontal key scroll");

        staticApp.pointerMove({ x: 3, y: 3, button: 0, buttons: 1 });
        input.emit("\u001b[<32;4;4M");
        assertParity("pointer move");

        staticApp.pointerDown({ x: 3, y: 3, button: 0, buttons: 1 });
        input.emit("\u001b[<0;4;4M");
        assertParity("pointer down");

        staticApp.pointerUp({ x: 3, y: 3, button: 0, buttons: 0 });
        input.emit("\u001b[<0;4;4m");
        assertParity("pointer up");

        staticApp.scroll({ x: 3, y: 3, deltaX: 0, deltaY: 1 });
        input.emit("\u001b[<65;4;4M");
        assertParity("wheel scroll");

        staticApp.keyDown({ key: "End" });
        input.emit("\u001b[F");
        assertParity("deep two-axis offset");

        source = appendLargeTextHostParitySegment(source);
        staticApp.rerender(
          createLargeTextHostParityView(source, staticRecorder),
        );
        tui.rerender(createLargeTextHostParityView(source, tuiRecorder));
        assertParity("append source segment");

        source = extendLargeTextHostParitySegment(source);
        staticApp.rerender(
          createLargeTextHostParityView(source, staticRecorder),
        );
        tui.rerender(createLargeTextHostParityView(source, tuiRecorder));
        assertParity("extend source segment");

        source = replaceLargeTextHostParitySegment(source);
        staticApp.rerender(
          createLargeTextHostParityView(source, staticRecorder),
        );
        tui.rerender(createLargeTextHostParityView(source, tuiRecorder));
        assertParity("replace source segment");

        output.setDimensions(
          LARGE_TEXT_HOST_PARITY_RESIZED_SIZE.width,
          LARGE_TEXT_HOST_PARITY_RESIZED_SIZE.height,
        );
        staticApp.setSize(LARGE_TEXT_HOST_PARITY_RESIZED_SIZE);
        tui.setSize(LARGE_TEXT_HOST_PARITY_RESIZED_SIZE);
        assertParity("resize to 100 by 24", true);

        output.setDimensions(
          LARGE_TEXT_HOST_PARITY_SIZE.width,
          LARGE_TEXT_HOST_PARITY_SIZE.height,
        );
        staticApp.setSize(LARGE_TEXT_HOST_PARITY_SIZE);
        tui.setSize(LARGE_TEXT_HOST_PARITY_SIZE);
        assertParity("resize back to 120 by 30", true);

        staticApp.keyDown({ key: "Home" });
        input.emit("\u001b[H");
        assertParity("return to first offset");

        staticApp.keyDown({ key: "ArrowDown" });
        input.emit("\u001b[B");
        assertParity("vertical key scroll");

        staticApp.scroll({ x: 3, y: 3, deltaX: 0, deltaY: -1 });
        input.emit("\u001b[<64;4;4M");
        assertParity("reverse wheel scroll");

        staticApp.keyDown({ key: "End" });
        input.emit("\u001b[F");
        assertParity("final deep offset");

        staticApp.keyDown({ key: "ArrowUp" });
        input.emit("\u001b[A");
        assertParity("final Unicode line");

        // End returns a vertical log to the left edge, so reach the wide glyph
        // run at the end of the long lines with the horizontal key.
        for (let index = 0; index < 70; index += 1) {
          staticApp.keyDown({ key: "ArrowRight" });
          input.emit("\u001b[C");
        }
        assertParity("wide glyph column");

        const textNodeId = staticApp.getTextIndexes()[0]?.nodeId;
        if (textNodeId === undefined)
          throw new Error("Expected one text index.");
        expect(
          staticApp
            .getScene()
            .cells.some(
              (cell) => cell.continuation && cell.ownerId === textNodeId,
            ),
        ).toBe(true);
        expect(
          staticApp
            .getScene()
            .cells.some(
              (cell) =>
                cell.ownerId === textNodeId &&
                cell.style.bold &&
                cell.style.underline,
            ),
        ).toBe(true);
        expect(
          staticRecorder.events.some(
            (event) =>
              event.type === "scroll" &&
              event.offset !== undefined &&
              event.offset.x > 0 &&
              event.offset.y > 0,
          ),
        ).toBe(true);
      } finally {
        const writesBeforeUnmount = output.writes.length;
        tui.unmount();
        const writesAfterUnmount = output.writes.length;
        tui.unmount();
        expect(output.writes.length).toBe(writesAfterUnmount);
        expect(tui.isRunning()).toBe(false);
        expect(input.rawModes).toEqual([true, false]);
        expect(input.resumed).toBe(1);
        expect(input.paused).toBe(1);
        expect(input.listeners.size).toBe(0);
        expect(output.listeners.size).toBe(0);
        expect(writesBeforeUnmount).toBeGreaterThan(0);
        expect(output.writes.join("")).toContain("\u001b[?1049h");
        expect(output.writes.join("")).toContain("\u001b[?1000h");
        expect(output.writes.join("")).toContain("\u001b[?1000l");
        expect(output.writes.join("")).toContain("\u001b[?7h");
        expect(output.writes.join("")).toContain("\u001b[?25h");
        expect(output.writes.join("")).toContain("\u001b[?1049l");

        staticApp.unmount();
        const staticAfterUnmount = staticApp.getWorkCounts();
        staticApp.unmount();
        expect(staticApp.getWorkCounts()).toEqual(staticAfterUnmount);
        expect(staticAfterUnmount.entriesDisposed).toBe(1);
      }
    },
  );
});

function sourceTextLength(
  source: Parameters<typeof createLargeTextHostParityView>[0],
): number {
  return inspectTextSource(source).text.length;
}
