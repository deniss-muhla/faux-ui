import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Rows, Text, ThemeProvider } from "../src/index.js";
import { defaultPalette, mergePalette } from "../src/internal/palette.js";
import type { Cell, CellScene, ResolvedStyle } from "../src/internal/scene.js";
import { planTuiFrame, TuiFrameWriter } from "../src/internal/tui-frame.js";
import { render } from "../src/tui.js";
import {
  FakeTerminalInput,
  FakeTerminalOutput,
  expectedTerminalGrid,
} from "./support/fake-terminal.js";

const SIZE = { width: 16, height: 3 };

function view(middle: string): ReactNode {
  return createElement(
    Rows,
    { tracks: [1, 1, 1] },
    createElement(Text, null, "header"),
    createElement(Text, null, middle),
    createElement(Text, null, "footer"),
  );
}

function mountView(
  options: {
    readonly alternateScreen?: boolean;
    readonly explicitSize?: boolean;
  } = {},
) {
  const input = new FakeTerminalInput();
  const output = new FakeTerminalOutput(SIZE.width, SIZE.height);
  const handle = render(view("middle-1"), {
    input,
    output,
    alternateScreen: options.alternateScreen ?? false,
    mouse: false,
    ...(options.explicitSize === false
      ? {}
      : { width: SIZE.width, height: SIZE.height }),
  });
  return { input, output, handle };
}

function expectGrid(
  output: FakeTerminalOutput,
  scene: CellScene,
  palette = defaultPalette,
): void {
  expect(output.snapshot()).toEqual(expectedTerminalGrid(scene, palette));
}

describe("TUI ordinary refreshes", () => {
  it("writes only the changed row without clearing the screen", () => {
    const { output, handle } = mountView();
    expect(output.clears).toBe(1);
    const writesAfterStart = output.writes.length;

    handle.rerender(view("middle-2"));

    const updates = output.writes.slice(writesAfterStart);
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toContain("\u001b[2J");
    // Synchronized output is optional; ordinary terminals use plain row writes.
    expect(updates[0]).not.toContain("?2026");
    expect(updates[0]?.startsWith("\u001b[2;1H")).toBe(true);
    expect(output.clears).toBe(1);
    expect(output.text()[1]).toBe("middle-2".padEnd(SIZE.width));
    expectGrid(output, handle.getScene());
  });

  it("emits no redraw content for an identical scene", () => {
    const { output, handle } = mountView();
    handle.rerender(view("middle-1"));
    const firstRepaintScene = handle.getScene();
    const writesAfterRepaint = output.writes.length;

    handle.rerender(view("middle-1"));

    expect(handle.getScene()).not.toBe(firstRepaintScene);
    expect(output.writes.length).toBe(writesAfterRepaint);
    expect(output.clears).toBe(1);
  });

  it("clears stale trailing cells when a row shortens", () => {
    const { output, handle } = mountView();
    handle.rerender(view("middle-longer"));
    const writesAfterGrow = output.writes.length;

    handle.rerender(view("AB"));

    const updates = output.writes.slice(writesAfterGrow);
    expect(updates).toHaveLength(1);
    expect(output.clears).toBe(1);
    expect(output.text()[1]).toBe("AB".padEnd(SIZE.width));
    expectGrid(output, handle.getScene());
  });

  it("keeps combining text, wide glyphs, and continuation cells aligned", () => {
    const { output, handle } = mountView();
    handle.rerender(view("古e\u0301👩‍💻"));

    expect(output.clears).toBe(1);
    expectGrid(output, handle.getScene());
    const row = output.snapshot()[1] ?? [];
    expect(row[0]?.glyph).toBe("古");
    expect(row[1]?.continuation).toBe(true);
    const emoji = row.findIndex((cell) => cell.glyph === "👩‍💻");
    expect(emoji).toBeGreaterThan(0);
    expect(row[emoji + 1]?.continuation).toBe(true);

    handle.rerender(view("古古"));

    expect(output.clears).toBe(1);
    expectGrid(output, handle.getScene());
  });

  it("recovers with a full redraw after resize and resumes row updates", () => {
    const { output, handle } = mountView({ explicitSize: false });
    expect(output.clears).toBe(1);

    output.resize(12, 2);

    expect(output.clears).toBe(2);
    expectGrid(output, handle.getScene());
    const writesAfterResize = output.writes.length;

    handle.rerender(view("after-resize"));

    expect(output.clears).toBe(2);
    expect(output.writes.length).toBe(writesAfterResize + 1);
    expectGrid(output, handle.getScene());
  });

  it("repaints fully after a palette change and then diffs rows again", () => {
    const { output, handle } = mountView();
    const changed = { accent: "#ff00ff", bg: "#101010" };

    handle.rerender(
      createElement(ThemeProvider, { palette: changed }, view("middle-1")),
    );

    expect(output.clears).toBe(2);
    expectGrid(output, handle.getScene(), mergePalette(changed));
    const writesAfterPalette = output.writes.length;

    handle.rerender(
      createElement(ThemeProvider, { palette: changed }, view("middle-2")),
    );

    const updates = output.writes.slice(writesAfterPalette);
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toContain("\u001b[2J");
    expect(output.clears).toBe(2);
    expectGrid(output, handle.getScene(), mergePalette(changed));
  });

  it("repaints fully after stop and start", () => {
    const { output, handle } = mountView({ alternateScreen: true });
    const clearsAfterStart = output.clears;

    handle.stop();
    handle.start();

    expect(output.clears).toBe(clearsAfterStart + 1);
    expect(output.alternateScreen).toBe(true);
    expectGrid(output, handle.getScene());
  });

  it("restores the terminal and stops writing on unmount", () => {
    const { input, output, handle } = mountView({ alternateScreen: true });

    handle.unmount();
    const writesAfterUnmount = output.writes.length;
    handle.unmount();

    expect(output.writes.length).toBe(writesAfterUnmount);
    expect(handle.isRunning()).toBe(false);
    expect(output.autowrap).toBe(true);
    expect(output.cursorVisible).toBe(true);
    expect(output.alternateScreen).toBe(false);
    expect(input.listeners.size).toBe(0);
    expect(input.rawModes).toEqual([true, false]);
  });

  it("invalidates the retained projection when a frame write fails", () => {
    const { output, handle } = mountView({ explicitSize: false });
    expect(output.clears).toBe(1);

    output.failNextWrite("terminal write failed");
    expect(() => output.resize(14, 3)).toThrow("terminal write failed");

    expect(output.clears).toBe(1);
    expect(handle.isRunning()).toBe(true);

    handle.rerender(view("middle-1"));

    expect(output.clears).toBe(2);
    expectGrid(output, handle.getScene());
  });

  it("restores the terminal when the first frame write fails", () => {
    const input = new FakeTerminalInput();
    const output = new FakeTerminalOutput(SIZE.width, SIZE.height);
    output.failNextWriteContaining("\u001b[2J", "first frame failed");

    expect(() =>
      render(view("middle-1"), {
        input,
        output,
        alternateScreen: true,
        mouse: false,
        width: SIZE.width,
        height: SIZE.height,
      }),
    ).toThrow("first frame failed");

    expect(input.rawModes).toEqual([true, false]);
    expect(output.autowrap).toBe(true);
    expect(output.cursorVisible).toBe(true);
    expect(output.alternateScreen).toBe(false);
    expect(input.listeners.size).toBe(0);
  });
});

describe("TUI frame planning", () => {
  it("ignores semantic ownership and reports unchanged scenes", () => {
    const previous = { scene: buildScene(["abcdef"]), palette: defaultPalette };
    expect(
      planTuiFrame(previous, buildScene(["abcdef"], 99), defaultPalette),
    ).toBe("");
  });

  it("emits positioned rows for changed visible cells or styles", () => {
    const previous = { scene: buildScene(["abcdef"]), palette: defaultPalette };
    const update = planTuiFrame(
      previous,
      buildScene(["abcXef"], 99),
      defaultPalette,
    );
    expect(update.startsWith("\u001b[1;1H")).toBe(true);
    expect(update).toContain("abcXef");
    expect(update).not.toContain("\u001b[2J");
    expect(update.endsWith("\u001b[0m")).toBe(true);

    const styled = buildScene(["abcdef"], 0, { bold: true });
    const styleUpdate = planTuiFrame(
      { scene: buildScene(["abcdef"]), palette: defaultPalette },
      styled,
      defaultPalette,
    );
    expect(styleUpdate).toContain("\u001b[1;1H");
    expect(styleUpdate).toContain("abc");
  });

  it("redraws fully after size or palette changes", () => {
    const previous = { scene: buildScene(["abcdef"]), palette: defaultPalette };
    expect(
      planTuiFrame(previous, buildScene(["abc"]), defaultPalette),
    ).toContain("\u001b[2J");
    expect(
      planTuiFrame(
        previous,
        buildScene(["abcdef"]),
        mergePalette({ bg: "#101010" }),
      ),
    ).toContain("\u001b[2J");
  });

  it("commits the previous projection only after a successful write", () => {
    let failures = 0;
    const writes: string[] = [];
    const writer = new TuiFrameWriter({
      write(chunk: string) {
        if (failures > 0) {
          failures -= 1;
          throw new Error("sink failed");
        }
        writes.push(chunk);
      },
    });
    const first = buildScene(["abcdef"]);
    const changed = buildScene(["abcXef"]);

    writer.write(first, defaultPalette);
    expect(writes).toHaveLength(1);

    failures = 1;
    expect(() => writer.write(changed, defaultPalette)).toThrow("sink failed");
    expect(writes).toHaveLength(1);

    writer.write(changed, defaultPalette);
    expect(writes).toHaveLength(2);
    expect(writes[1]).toContain("\u001b[2J");

    writer.write(changed, defaultPalette);
    expect(writes).toHaveLength(2);
  });
});

const DEFAULT_STYLE: ResolvedStyle = {
  foreground: "fg",
  background: "bg",
  bold: false,
  dim: false,
  inverse: false,
  underline: false,
};

function buildScene(
  rows: readonly string[],
  ownerId = 0,
  style: Partial<ResolvedStyle> = {},
): CellScene {
  const width = Math.max(...rows.map((row) => row.length));
  const resolved: ResolvedStyle = { ...DEFAULT_STYLE, ...style };
  const cells: Cell[] = [];
  for (const row of rows) {
    for (let x = 0; x < width; x += 1) {
      const glyph = row[x] ?? " ";
      cells.push({ glyph, continuation: false, style: resolved, ownerId });
    }
  }
  return { width, height: rows.length, cells };
}
