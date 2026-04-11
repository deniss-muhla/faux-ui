import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "@faux-ui/render-tui";

import { ExampleApp } from "../src/example-app.js";

describe("example-tui visual regression", () => {
  it("renders the shared example through the TUI renderer consistently", () => {
    const mounted = render(createElement(ExampleApp), {
      io: createFakeTerminalIO(96, 18),
      exitOnCtrlC: false,
      enableMouse: false,
    });

    const frame = mounted.render().toString();
    mounted.unmount();

    expect(frame).toMatchSnapshot();
  });
});

function createFakeTerminalIO(columns: number, rows: number) {
  const dataListeners = new Set<(chunk: Buffer | string) => void>();
  const resizeListeners = new Set<() => void>();

  return {
    stdin: {
      isTTY: true,
      setRawMode() {},
      on(_event: "data", listener: (chunk: Buffer | string) => void) {
        dataListeners.add(listener);
        return listener;
      },
      off(_event: "data", listener: (chunk: Buffer | string) => void) {
        dataListeners.delete(listener);
        return listener;
      },
      resume() {},
      pause() {},
    },
    stdout: {
      isTTY: true,
      columns,
      rows,
      write() {
        return true;
      },
      on(_event: "resize", listener: () => void) {
        resizeListeners.add(listener);
        return listener;
      },
      off(_event: "resize", listener: () => void) {
        resizeListeners.delete(listener);
        return listener;
      },
    },
  };
}
