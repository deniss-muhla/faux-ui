import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../src/components.js";
import { clientPointToCell } from "../src/internal/dom-scene.js";
import { consumeTerminalInput } from "../src/internal/tui-input.js";
import { renderStatic } from "../src/testing.js";

describe("DOM/TUI command parity", () => {
  it("produces the same scene and handler trace for one logical click", () => {
    const domPress = vi.fn();
    const tuiPress = vi.fn();
    const dom = renderStatic(
      createElement(Button, { label: "Run", padding: 0, onPress: domPress }),
      { width: 10, height: 1 },
    );
    const tui = renderStatic(
      createElement(Button, { label: "Run", padding: 0, onPress: tuiPress }),
      { width: 10, height: 1 },
    );

    const point = clientPointToCell(
      { left: 40, top: 20, width: 80, height: 16 },
      { width: 10, height: 1 },
      52,
      28,
    );
    if (point === null) throw new Error("DOM point should map into the scene.");
    dom.pointerDown({ ...point, button: 0 });
    dom.pointerUp({ ...point, button: 0 });

    const controls = consumeTerminalInput(
      "\u001b[<0;2;1M\u001b[<0;2;1m",
    ).controls;
    for (const control of controls) {
      if (control.type === "pointerDown") tui.pointerDown(control.input);
      if (control.type === "pointerUp") tui.pointerUp(control.input);
    }

    expect(domPress).toHaveBeenCalledTimes(1);
    expect(tuiPress).toHaveBeenCalledTimes(1);
    expect(tui.getEventTrace()).toEqual(dom.getEventTrace());
    expect(tui.getScene()).toEqual(dom.getScene());
    dom.unmount();
    tui.unmount();
  });
});
