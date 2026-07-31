import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button, Column, Text } from "../src/index.js";
import { sceneToAnsi } from "../src/internal/ansi.js";
import { defaultPalette } from "../src/internal/palette.js";
import { consumeTerminalInput } from "../src/internal/tui-input.js";
import { render } from "../src/tui.js";

class FakeInput {
  isTTY = true;
  rawModes: boolean[] = [];
  resumed = 0;
  paused = 0;
  listeners = new Set<(chunk: Uint8Array | string) => void>();

  setRawMode(value: boolean): void {
    this.rawModes.push(value);
  }
  resume(): void {
    this.resumed += 1;
  }
  pause(): void {
    this.paused += 1;
  }
  on(_event: "data", listener: (chunk: Uint8Array | string) => void): void {
    this.listeners.add(listener);
  }
  off(_event: "data", listener: (chunk: Uint8Array | string) => void): void {
    this.listeners.delete(listener);
  }
  emit(chunk: string): void {
    for (const listener of this.listeners) listener(chunk);
  }
}

class FakeOutput {
  isTTY = true;
  columns = 12;
  rows = 3;
  writes: string[] = [];
  listeners = new Set<() => void>();

  write(chunk: string): void {
    this.writes.push(chunk);
  }
  on(_event: "resize", listener: () => void): void {
    this.listeners.add(listener);
  }
  off(_event: "resize", listener: () => void): void {
    this.listeners.delete(listener);
  }
}

describe("vNext TUI host", () => {
  it("mounts, activates through shared keys, and restores the terminal", () => {
    const input = new FakeInput();
    const output = new FakeOutput();
    const press = vi.fn();
    const handle = render(
      createElement(
        Column,
        { tracks: [1, 1, 1] },
        createElement(Text, null, "Actions"),
        createElement(Button, { label: "Run", padding: 0, onPress: press }),
        createElement(Text, null, "Ready"),
      ),
      { input, output, mouse: true },
    );

    expect(handle.isRunning()).toBe(true);
    expect(input.rawModes).toEqual([true]);
    expect(output.writes.join("")).toContain("\u001b[?1049h");
    expect(output.writes.join("")).toContain("Actions");

    input.emit("\t\r");
    expect(press).toHaveBeenCalledTimes(1);

    handle.unmount();
    expect(input.rawModes).toEqual([true, false]);
    expect(input.paused).toBe(1);
    expect(output.writes.join("")).toContain("\u001b[?1049l");
    expect(input.listeners.size).toBe(0);
  });

  it("restores terminal state when an event handler throws", () => {
    const input = new FakeInput();
    const output = new FakeOutput();
    const handle = render(
      createElement(Button, {
        label: "Explode",
        padding: 0,
        onPress: () => {
          throw new Error("boom");
        },
      }),
      { input, output, mouse: false, width: 12, height: 1 },
    );

    expect(() => input.emit("\t\r")).toThrow("boom");
    expect(handle.isRunning()).toBe(false);
    expect(input.rawModes).toEqual([true, false]);
  });

  it("parses split-safe keyboard and SGR mouse controls", () => {
    expect(consumeTerminalInput("\u001b[A\u001b[Zx").controls).toEqual([
      { type: "keyDown", input: { key: "ArrowUp" } },
      { type: "keyDown", input: { key: "Tab", shift: true } },
      { type: "keyDown", input: { key: "x" } },
    ]);
    expect(consumeTerminalInput("\u001b[<0;4;2M").controls).toEqual([
      {
        type: "pointerDown",
        input: {
          x: 3,
          y: 1,
          button: 0,
          buttons: 1,
          shift: false,
          alt: false,
          ctrl: false,
        },
      },
    ]);
    expect(consumeTerminalInput("\u001b[<65;4;2M").controls).toEqual([
      {
        type: "scroll",
        input: { x: 3, y: 1, deltaX: 0, deltaY: 1 },
      },
    ]);
  });

  it("serializes canonical scene styles as true color ANSI", () => {
    const input = new FakeInput();
    const output = new FakeOutput();
    const handle = render(createElement(Text, null, "古"), {
      input,
      output,
      alternateScreen: false,
      mouse: false,
      width: 2,
      height: 1,
    });
    const ansi = sceneToAnsi(handle.getScene(), defaultPalette);
    expect(ansi).toContain("38;2;");
    expect(ansi).toContain("48;2;");
    expect(ansi).toContain("古");
    expect(ansi.endsWith("\u001b[0m")).toBe(true);
    handle.unmount();
  });
});
