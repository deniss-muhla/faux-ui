import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { renderStatic } from "@faux-ui/ui/testing";

import { ExampleApp } from "../src/example-app.js";

describe("release-review fixture", () => {
  it("covers the serious three-pane authoring path", () => {
    const app = renderStatic(createElement(ExampleApp), {
      width: 100,
      height: 30,
    });
    const text = app.getText();

    expect(text).toContain("faux-ui release review");
    expect(text).toContain("Queue (8)");
    expect(text).toContain("RQ-1042");
    expect(text).toContain("Metadata");
    expect(text).toContain("Unicode");
    expect(text).toContain("ONLINE");
    expect(text).toContain("古");
    expect(text).toContain("👩‍💻");
    expect(app.getScene()).toMatchObject({ width: 100, height: 30 });
    expect(app.getLayout().root.children).toHaveLength(3);
    app.unmount();
  });

  it("routes compact actions through the shared controller", async () => {
    const app = renderStatic(createElement(ExampleApp), {
      width: 100,
      height: 30,
    });
    // Effects register app-level hotkeys after the initial commit.
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.keyDown({ key: "2" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(app.getText()).toContain("Approve: RQ-1042");
    app.unmount();
  });
});
