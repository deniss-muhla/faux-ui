import { EventEmitter } from "node:events";

import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  TEXT_TYPE,
  VIEW_TYPE,
  createStatefulApp,
} from "../../reconciler/src/index.js";
import {
  appendChild,
  createTextNode,
  createViewNode,
} from "../../core/src/index.js";
import {
  consumeTerminalInput,
  mountTerminalTuiHost,
  renderStatefulTuiApp,
  renderTui,
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
      {
        type: "pointerDown",
        point: { x: 2, y: 1 },
        pointer: {
          point: { x: 2, y: 1 },
          button: "primary",
          modifiers: {
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
          },
        },
      },
      {
        type: "pointerUp",
        point: { x: 2, y: 1 },
        pointer: {
          point: { x: 2, y: 1 },
          button: "primary",
          modifiers: {
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
          },
        },
      },
    ]);

    expect(consumeTerminalInput("\u001b[<65;1;1M").controls).toEqual([
      {
        type: "scroll",
        point: { x: 0, y: 0 },
        delta: { x: 0, y: 1 },
        pointer: {
          point: { x: 0, y: 0 },
          button: null,
          modifiers: {
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
          },
        },
      },
    ]);

    expect(consumeTerminalInput("\u001b[<20;4;3M").controls).toEqual([
      {
        type: "pointerDown",
        point: { x: 3, y: 2 },
        pointer: {
          point: { x: 3, y: 2 },
          button: "primary",
          modifiers: {
            altKey: false,
            ctrlKey: true,
            metaKey: false,
            shiftKey: true,
          },
        },
      },
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
      supportsTerminalMouse({ isTTY: true }, { TERM: "dumb" }, "linux"),
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
      disableSequence: "\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l",
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

  it("renders a TUI app through the one-call render helper", () => {
    const stdin = new MockInput();
    const stdout = new MockOutput();
    const mounted = renderTui(createElement(TEXT_TYPE, null, "A"), {
      io: { stdin, stdout },
      environment: { TERM: "dumb" },
    });

    expect(mounted.isRunning()).toBe(true);
    expect(mounted.render().toString()).toContain("A");

    mounted.update(createElement(TEXT_TYPE, null, "B"));

    expect(mounted.render().toString()).toContain("B");

    mounted.unmount();

    expect(mounted.isRunning()).toBe(false);
  });

  it("renders and updates a stateful TUI app through the renderer helper", () => {
    const stdin = new MockInput();
    const stdout = new MockOutput();
    const app = createStatefulApp({
      initialState: 0,
      initialViewState: { focusedNodeLabel: "none" },
      reduce(state: number, action: "increment") {
        return action === "increment" ? state + 1 : state;
      },
      render({ state, viewState }) {
        return createElement(
          VIEW_TYPE,
          { focusable: true, onClick: "increment" },
          createElement(
            TEXT_TYPE,
            null,
            `${String(state)}:${viewState.focusedNodeLabel}`,
          ),
        );
      },
    });

    const mounted = renderStatefulTuiApp({
      app,
      io: { stdin, stdout },
      environment: { TERM: "dumb" },
      mapAction(token) {
        return token === "increment" ? "increment" : undefined;
      },
    });

    stdin.emit("data", "\u001b[<0;1;1M\u001b[<0;1;1m");

    expect(app.getState()).toBe(1);
    expect(app.getViewState().focusedNodeLabel).not.toBe("none");
    expect(mounted.render().toString()).toContain("1:");

    mounted.unmount();
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

    expect(dispatched).toEqual([
      "mouseDown",
      "mouseMove",
      "dragStart",
      "drag",
      "mouseUp",
      "dragEnd",
    ]);
  });
});
