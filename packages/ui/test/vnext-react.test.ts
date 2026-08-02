import { createElement, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  Button,
  Columns,
  Divider,
  Rows,
  Text,
  mergePalette,
} from "../src/components.js";
import { VERSION } from "../src/index.js";
import { SemanticMount } from "../src/internal/mount.js";
import { sceneToText } from "../src/internal/scene.js";

describe("vNext React authoring", () => {
  it("reports the package evidence version", () => {
    expect(VERSION).toBe("0.9.1");
  });

  it("validates one cross-host #RRGGBB palette contract", () => {
    expect(mergePalette({ accent: "#00ccee" }).accent).toBe("#00ccee");
    expect(() => mergePalette({ accent: "red" })).toThrow(/#RRGGBB/u);
  });

  it("reconciles public components into one deterministic scene", () => {
    const mount = new SemanticMount({ size: { width: 12, height: 3 } });
    mount.render(
      createElement(
        Columns,
        { tracks: [4, "1fr"], gap: 1 },
        createElement(Text, null, "left"),
        createElement(Text, { overflow: "ellipsis-end" }, "right panel"),
      ),
    );

    expect(sceneToText(mount.frame().scene)).toBe(
      ["left right …", "            ", "            "].join("\n"),
    );
    expect(mount.frame().root.kind).toBe("box");
    mount.unmount();
  });

  it("aligns Text through one x/y object", () => {
    const mount = new SemanticMount({ size: { width: 5, height: 2 } });
    mount.render(
      createElement(Text, { align: { x: "end", y: "end" } }, "x"),
    );
    expect(sceneToText(mount.frame().scene)).toBe("     \n    x");
    mount.unmount();

    const invalid = new SemanticMount({ size: { width: 1, height: 1 } });
    expect(() =>
      invalid.render(createElement(Text, { align: "end" as never }, "x"))
    ).toThrow(/align must be an object/u);
    invalid.unmount();
  });

  it("uses ordinary React state and dispatches one press", async () => {
    function Counter() {
      const [count, setCount] = useState(0);
      return createElement(
        Rows,
        { tracks: [1, 1] },
        createElement(Text, null, `Count: ${count}`),
        createElement(Button, {
          label: "Increment",
          padding: 0,
          onPress: () => setCount((value) => value + 1),
        }),
      );
    }

    const mount = new SemanticMount({ size: { width: 12, height: 2 } });
    mount.render(createElement(Counter));
    mount.pointerDown({ x: 1, y: 1, button: 0 });
    mount.pointerUp({ x: 1, y: 1, button: 0 });
    // React's concurrent renderer may commit on a following task.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sceneToText(mount.frame().scene)).toBe("Count: 1    \nIncrement   ");
    mount.unmount();
  });

  it("fills Divider from its allocated frame and disables inert buttons", () => {
    const press = vi.fn();
    const divider = new SemanticMount({ size: { width: 5, height: 2 } });
    divider.render(createElement(Divider));
    expect(sceneToText(divider.frame().scene)).toBe("─────\n─────");
    divider.unmount();

    const button = new SemanticMount({ size: { width: 8, height: 1 } });
    button.render(
      createElement(Button, {
        label: "Nope",
        disabled: true,
        padding: 0,
        onPress: press,
      }),
    );
    button.keyDown({ key: "Tab" });
    button.pointerDown({ x: 1, y: 0, button: 0 });
    button.pointerUp({ x: 1, y: 0, button: 0 });
    expect(button.controller().snapshot().focusedId).toBeNull();
    expect(press).not.toHaveBeenCalled();
    button.unmount();
  });

  it("rejects raw strings outside Text", () => {
    const mount = new SemanticMount({ size: { width: 5, height: 1 } });
    expect(() => mount.render(createElement(Columns, null, "invalid"))).toThrow(
      /must be inside <Text>/,
    );
    mount.unmount();
  });
});
