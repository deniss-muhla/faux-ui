import { describe, expect, it } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
} from "../../core/src/index.js";
import { mountDomRoot } from "../src/runtime.js";
import { FakeDocument } from "./support/fake-dom.js";

describe("dom runtime pointer coordinates", () => {
  it("measures pointer input from the rendered root origin", () => {
    const root = createViewNode({ spec: { rows: [1, 1, 1] } });
    const backlog = createViewNode({ spec: { focusable: true } });
    const active = createViewNode({ spec: { focusable: true } });
    const shipped = createViewNode({ spec: { focusable: true } });

    appendChild(
      backlog,
      createTextNode({ spec: { text: "Backlog", wrap: false, style: null } }),
    );
    appendChild(
      active,
      createTextNode({ spec: { text: "Active", wrap: false, style: null } }),
    );
    appendChild(
      shipped,
      createTextNode({ spec: { text: "Shipped", wrap: false, style: null } }),
    );

    appendChild(root, backlog);
    appendChild(root, active);
    appendChild(root, shipped);

    const document = new FakeDocument();
    const container = document.createElement("div");
    container.setBoundingClientRect(100, 200);
    container.setChildBoundingOrigin(118, 236);

    const mounted = mountDomRoot(root, {
      container,
      document,
      constraints: { maxHeight: 3 },
      measureText: ({ text }) => ({ width: text.length, height: 1 }),
    });

    container.emit("mousedown", { clientX: 118, clientY: 236 });

    expect(mounted.getFocusedNodeId()).toBe(backlog.id);
  });
});
