import { describe, expect, it } from "vitest";

import {
  executeDocumentText,
  run,
  shouldUseInteractiveTui,
} from "../src/index.js";

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
        constraints: {},
      },
    );

    expect(output).toBe("A  B  ");
  });

  it("auto-detects compact documents for layout inspection", () => {
    const output = executeDocumentText(
      JSON.stringify(["FUI", 1, ["V", { r: [1] }, [["T", "Hi"]]]]),
      {
        target: "dom",
        format: "auto",
        inspect: "layout",
        constraints: {},
      },
    );

    expect(output).toContain("[view 2x1");
    expect(output).toContain("[text 2x1");
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
        constraints: {},
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      kind: "text",
      textContent: "Hi",
      styles: {
        position: "absolute",
        width: "2px",
      },
    });
  });

  it("prints usage information for help", () => {
    const output = run(["--help"]);

    expect(output).toContain("Usage: exec-faux-ui");
    expect(output).toContain("target tui uses an interactive terminal host");
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
});
