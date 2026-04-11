import { describe, expect, it } from "vitest";

import {
  appendChild,
  createTextNode,
  createViewNode,
} from "../../core/src/index.js";
import { renderToFrameBuffer } from "../src/index.js";

describe("tui visual regression", () => {
  it("captures a stable framebuffer snapshot", () => {
    const root = createViewNode({ spec: { columns: [4, 4] } });
    appendChild(
      root,
      createTextNode({ spec: { text: "left", wrap: false, style: null } }),
    );
    appendChild(
      root,
      createTextNode({ spec: { text: "R", wrap: false, style: null } }),
    );

    const buffer = renderToFrameBuffer(root, {
      constraints: { maxWidth: 8, maxHeight: 4 },
    });

    expect(buffer.toString()).toMatchInlineSnapshot(
      `"leftR   \n        \n        \n        "`,
    );
  });
});
