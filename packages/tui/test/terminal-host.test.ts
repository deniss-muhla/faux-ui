import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
} from "../../core/src/index.js";
import {
  consumeTerminalInput,
  mountTerminalTuiHost,
  resolveTerminalConstraints,
} from "../src/index.js";

class MockInput extends EventEmitter {
  isTTY = true;
  rawMode = false;

  setRawMode(mode: boolean): void {
    this.rawMode = mode;
  }

  resume(): void {}

  pause(): void {}
}

class MockOutput extends EventEmitter {
  isTTY = true;
  columns = 10;
  rows = 1;
  writes: string[] = [];

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }
}

describe("terminal tui host", () => {
  it("parses keyboard, focus, and mouse escape sequences", () => {
    expect(consumeTerminalInput("\t\u001b[Z\u001b[Aa").controls).toEqual([
      { type: "focusNext" },
      { type: "focusPrevious" },
      { type: "keyDown", key: "ArrowUp" },
      { type: "keyDown", key: "a" },
    ]);

    expect(
      consumeTerminalInput("\u001b[<0;3;2M\u001b[<0;3;2m").controls,
    ).toEqual([
      { type: "pointerDown", point: { x: 2, y: 1 } },
      { type: "pointerUp", point: { x: 2, y: 1 } },
    ]);

    expect(consumeTerminalInput("\u001b[<65;1;1M").controls).toEqual([
      { type: "scroll", point: { x: 0, y: 0 }, delta: { x: 0, y: 1 } },
    ]);

    expect(consumeTerminalInput("\u001b[<0;1")).toEqual({
      controls: [],
      rest: "\u001b[<0;1",
    });
  });

  it("clamps terminal constraints to the available viewport", () => {
    expect(
      resolveTerminalConstraints(
        { maxWidth: 80, maxHeight: 24 },
        { columns: 40, rows: 12 },
      ),
    ).toEqual({ maxWidth: 40, maxHeight: 12 });

    expect(resolveTerminalConstraints({}, { columns: 20, rows: 5 })).toEqual({
      maxWidth: 20,
      maxHeight: 5,
    });
  });

  it("drives focus and scroll updates through terminal input", () => {
    const root = createViewNode({
      spec: { rows: ["auto", "auto"], scroll: "y" },
    });
    const focusable = createViewNode({ spec: { focusable: true } });
    appendChild(
      focusable,
      createTextNode({ spec: { text: "one", wrap: false, style: null } }),
    );
    appendChild(root, focusable);
    appendChild(
      root,
      createTextNode({ spec: { text: "two", wrap: false, style: null } }),
    );

    const stdin = new MockInput();
    const stdout = new MockOutput();
    const host = mountTerminalTuiHost(root, {
      constraints: { maxHeight: 1 },
      io: { stdin, stdout },
    });

    host.start();
    stdin.emit("data", "\t");
    stdin.emit("data", "\u001b[<65;1;1M");

    expect(host.getRuntime().getFocusedNodeId()).toBe(focusable.id);
    expect(host.getRuntime().getScrollOffset(root.id)).toEqual({ x: 0, y: 1 });
    expect(stdout.writes.join("")).toContain("\u001b[?1049h");

    host.stop();

    expect(stdin.rawMode).toBe(false);
    expect(stdout.writes.join("")).toContain("\u001b[?1049l");
  });
});
