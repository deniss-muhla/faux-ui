import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  executeDocumentText,
  mainWithIO,
  run,
  shouldUseInteractiveTui,
} from "../src/index.js";

class MockStdout {
  isTTY = false;
  columns = 80;
  rows = 24;
  output = "";

  write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }

  on(): void {}

  off(): void {}
}

class MockInput extends EventEmitter {
  isTTY = true;

  setRawMode(): void {}

  resume(): void {}

  pause(): void {}
}

class InteractiveStdout extends MockStdout {
  override isTTY = true;
}

const ROOT_CONSTRAINTS = { maxWidth: 8, maxHeight: 4 };

describe("exec-faux-ui", () => {
  it("renders readable documents to the TUI target", () => {
    const output = executeDocumentText(
      JSON.stringify({
        version: 1,
        root: {
          kind: "view",
          columns: [3, 3],
          children: [
            { kind: "text", text: "A" },
            { kind: "text", text: "B" },
          ],
        },
      }),
      {
        target: "tui",
        format: "auto",
        inspect: null,
        constraints: ROOT_CONSTRAINTS,
      },
    );

    expect(output).toBe("A  B    \n        \n        \n        ");
  });

  it("auto-detects compact documents for layout inspection", () => {
    const output = executeDocumentText(
      JSON.stringify(["FUI", 1, ["V", { r: [1] }, [["T", "Hi"]]]]),
      {
        target: "dom",
        format: "auto",
        inspect: "layout",
        constraints: ROOT_CONSTRAINTS,
      },
    );

    expect(output).toContain("[view 8x1");
    expect(output).toContain("[text 2x1");
  });

  it("prints the semantic binding tree for bindings inspection", () => {
    const output = executeDocumentText(
      JSON.stringify({
        version: 1,
        root: {
          kind: "view",
          bind: {
            click: "open-root",
            dragStart: "drag-root-start",
          },
          children: [
            {
              kind: "text",
              text: "Hi",
            },
          ],
        },
      }),
      {
        target: "dom",
        format: "readable",
        inspect: "bindings",
        constraints: ROOT_CONSTRAINTS,
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      kind: "view",
      bindings: {
        click: "open-root",
        dragStart: "drag-root-start",
      },
      children: [
        {
          kind: "text",
          bindings: {},
        },
      ],
    });
  });

  it("renders standalone HTML for DOM inspection", () => {
    const output = executeDocumentText(
      JSON.stringify({
        version: 1,
        root: {
          kind: "text",
          text: "Hi",
        },
      }),
      {
        target: "dom",
        format: "readable",
        inspect: "html",
        constraints: ROOT_CONSTRAINTS,
      },
    );

    expect(output).toContain("<!doctype html>");
    expect(output).toContain("faux-ui DOM snapshot");
    expect(output).toContain(">Hi<");
  });

  it("renders DOM target output as a JSON projection model", () => {
    const output = executeDocumentText(
      JSON.stringify({
        version: 1,
        root: {
          kind: "text",
          text: "Hi",
        },
      }),
      {
        target: "dom",
        format: "readable",
        inspect: null,
        constraints: ROOT_CONSTRAINTS,
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      kind: "text",
      textContent: "Hi",
      styles: {
        position: "absolute",
        width: "calc(var(--faux-ui-cell-width, 1ch) * 2)",
      },
    });
  });

  it("prints usage information for help", () => {
    const output = run(["--help"]);

    expect(output).toContain("Usage: exec-faux-ui");
    expect(output).toContain("target tui uses an interactive terminal host");
    expect(output).toContain(
      "inspect bindings prints the semantic binding tree",
    );
    expect(output).toContain("inspect html prints a standalone HTML snapshot");
  });

  it("chooses interactive TUI mode only when it is usable", () => {
    expect(
      shouldUseInteractiveTui(
        {
          target: "tui",
          inspect: null,
          mode: "auto",
        },
        {
          stdin: { isTTY: true },
          stdout: { isTTY: true },
        },
      ),
    ).toBe(true);

    expect(
      shouldUseInteractiveTui(
        {
          target: "tui",
          inspect: null,
          mode: "static",
        },
        {
          stdin: { isTTY: true },
          stdout: { isTTY: true },
        },
      ),
    ).toBe(false);

    expect(
      shouldUseInteractiveTui(
        {
          target: "tui",
          inspect: "layout",
          mode: "interactive",
        },
        {
          stdin: { isTTY: true },
          stdout: { isTTY: true },
        },
      ),
    ).toBe(false);
  });

  it("writes snapshots for static execution output", () => {
    const cwd = mkdtempSync(join(tmpdir(), "exec-faux-ui-"));
    const entryPath = join(cwd, "document.json");
    const snapshotPath = join(cwd, "snapshots", "layout.txt");
    writeFileSync(
      entryPath,
      JSON.stringify({
        version: 1,
        root: {
          kind: "text",
          text: "Hi",
        },
      }),
      "utf8",
    );

    const stdout = new MockStdout();
    const exitCode = mainWithIO(
      [entryPath, "--snapshot", snapshotPath, "--target", "dom"],
      {
        stdin: { isTTY: false, on() {}, off() {} },
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(readFileSync(snapshotPath, "utf8")).toContain('"textContent": "Hi"');
    expect(stdout.output).toContain('"textContent": "Hi"');
  });

  it("writes HTML snapshots for DOM inspection output", () => {
    const cwd = mkdtempSync(join(tmpdir(), "exec-faux-ui-html-"));
    const entryPath = join(cwd, "document.json");
    const snapshotPath = join(cwd, "snapshots", "document.html");
    writeFileSync(
      entryPath,
      JSON.stringify({
        version: 1,
        root: {
          kind: "text",
          text: "Hi",
        },
      }),
      "utf8",
    );

    const stdout = new MockStdout();
    const exitCode = mainWithIO(
      [
        entryPath,
        "--target",
        "dom",
        "--inspect",
        "html",
        "--snapshot",
        snapshotPath,
      ],
      {
        stdin: { isTTY: false, on() {}, off() {} },
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(readFileSync(snapshotPath, "utf8")).toContain("<!doctype html>");
    expect(stdout.output).toContain("faux-ui DOM snapshot");
  });

  it("writes interactive TUI dispatch events to a JSONL log", () => {
    const cwd = mkdtempSync(join(tmpdir(), "exec-faux-ui-events-"));
    const entryPath = join(cwd, "document.json");
    const eventLogPath = join(cwd, "events", "session.jsonl");
    writeFileSync(
      entryPath,
      JSON.stringify({
        version: 1,
        root: {
          kind: "view",
          bind: {
            mouseDown: "mouse-down-root",
            dragStart: "drag-start-root",
            drag: "drag-root",
            dragEnd: "drag-end-root",
          },
          children: [{ kind: "text", text: "AB" }],
        },
      }),
      "utf8",
    );

    const stdin = new MockInput();
    const stdout = new InteractiveStdout();
    const exitCode = mainWithIO(
      [
        entryPath,
        "--target",
        "tui",
        "--interactive",
        "--event-log",
        eventLogPath,
      ],
      {
        stdin,
        stdout,
      },
    );

    stdin.emit("data", "\u001b[<0;1;1M");
    stdin.emit("data", "\u001b[<32;2;1M");
    stdin.emit("data", "\u001b[<0;2;1m");
    stdin.emit("data", "\u0003");

    expect(exitCode).toBe(0);

    const events = readFileSync(eventLogPath, "utf8")
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));

    expect(events).toEqual([
      expect.objectContaining({
        binding: "mouseDown",
        pointer: expect.objectContaining({ button: "primary" }),
        actions: [{ token: "mouse-down-root", nodeId: expect.any(Number) }],
      }),
      expect.objectContaining({
        binding: "mouseMove",
      }),
      expect.objectContaining({
        binding: "dragStart",
        pointer: expect.objectContaining({ button: "primary" }),
        actions: [{ token: "drag-start-root", nodeId: expect.any(Number) }],
      }),
      expect.objectContaining({
        binding: "drag",
        actions: [{ token: "drag-root", nodeId: expect.any(Number) }],
      }),
      expect.objectContaining({
        binding: "mouseUp",
      }),
      expect.objectContaining({
        binding: "dragEnd",
        actions: [{ token: "drag-end-root", nodeId: expect.any(Number) }],
      }),
    ]);
  });
});
