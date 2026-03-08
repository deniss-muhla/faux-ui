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
  resolveTerminalMouseSupport,
  supportsTerminalMouse,
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

  it("detects when terminal mouse tracking is supported", () => {
    expect(
      supportsTerminalMouse(
        { isTTY: true },
        { TERM: "xterm-256color" },
        "linux",
      ),
    ).toBe(true);

    expect(
      supportsTerminalMouse(
        { isTTY: true },
        { TERM: "dumb" },
        "linux",
      ),
    ).toBe(false);

    expect(
      supportsTerminalMouse(
        { isTTY: true },
        { TERM: "xterm-256color" },
        "win32",
      ),
    ).toBe(false);

    expect(
      supportsTerminalMouse(
        { isTTY: true },
        { TERM: "xterm-256color", WT_SESSION: "1" },
        "win32",
      ),
    ).toBe(true);
  });

  it("resolves mouse tracking sequences for supported terminals", () => {
    expect(
      resolveTerminalMouseSupport(
        { environment: { TERM: "xterm-256color" } },
        { isTTY: true },
        "linux",
      ),
    ).toEqual({
      enabled: true,
      mode: "move",
      enableSequence: "\u001b[?1000h\u001b[?1002h\u001b[?1003h\u001b[?1006h",
      disableSequence:
        "\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l",
    });

    expect(
      resolveTerminalMouseSupport(
        { environment: { TERM: "dumb" } },
        { isTTY: true },
        "linux",
      ),
    ).toBeNull();
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
      environment: { TERM: "xterm-256color" },
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

  it("skips mouse protocol toggles when the terminal does not support them", () => {
    const stdin = new MockInput();
    const stdout = new MockOutput();
    const root = createViewNode();
    const host = mountTerminalTuiHost(root, {
      io: { stdin, stdout },
      environment: { TERM: "dumb" },
    });

    host.start();
    host.stop();

    expect(stdout.writes.join("")).not.toContain("?1000h");
    expect(stdout.writes.join("")).not.toContain("?1000l");
  });

  it("does not synthesize a click after pointer drag motion", () => {
    const dispatched: string[] = [];
    const stdin = new MockInput();
    const stdout = new MockOutput();
    const root = createViewNode({ bindings: { click: "root-click" } });
    appendChild(
      root,
      createTextNode({ spec: { text: "drag", wrap: false, style: null } }),
    );

    const host = mountTerminalTuiHost(root, {
      io: { stdin, stdout },
      environment: { TERM: "xterm-256color" },
      onDispatch: ({ binding }) => {
        dispatched.push(binding);
      },
    });

    host.start();
    stdin.emit("data", "\u001b[<0;1;1M");
    stdin.emit("data", "\u001b[<32;2;1M");
    stdin.emit("data", "\u001b[<0;2;1m");

    expect(dispatched).toEqual(["mouseDown", "mouseMove", "mouseUp"]);
  });
});
