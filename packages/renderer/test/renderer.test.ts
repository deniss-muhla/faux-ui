import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { mountRendererApp, selectRenderer } from "../src/index.js";

describe("renderer contract", () => {
  it("selects a renderer by name or environment detection", () => {
    const dom = {
      name: "dom",
      detect: () => false,
      render: () => ({ kind: "dom" }),
    };
    const tui = {
      name: "tui",
      detect: () => true,
      render: () => ({ kind: "tui" }),
    };

    expect(selectRenderer([dom, tui]).name).toBe("tui");
    expect(selectRenderer([dom, tui], "dom").name).toBe("dom");
    expect(selectRenderer([dom, tui], tui).name).toBe("tui");
  });

  it("mounts a renderer app and routes commits through the adapter", () => {
    const events: string[] = [];
    const mounted = mountRendererApp(
      createElement("view" as never),
      { label: "initial" },
      {
        targetName: "fake",
        mount(root, options) {
          events.push(`mount:${options.label}:${root.kind}`);
          return { rootKind: root.kind };
        },
        update(handle, root, options) {
          events.push(
            `update:${handle.rootKind}:${root.kind}:${options?.label ?? "commit"}`,
          );
        },
        rerender() {
          events.push("rerender");
          return "ok";
        },
        unmount() {
          events.push("unmount");
        },
      },
    );

    mounted.update(createElement("text" as never, undefined, "next"));
    mounted.update(undefined, { label: "patched" });

    expect(mounted.rerender()).toBe("ok");
    mounted.unmount();

    expect(events).toEqual([
      "mount:initial:view",
      "update:view:text:commit",
      "update:view:text:patched",
      "rerender",
      "unmount",
    ]);
  });
});
