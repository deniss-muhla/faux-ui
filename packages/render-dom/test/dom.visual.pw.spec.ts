import { expect, test } from "@playwright/test";

import { appendChild, createViewNode } from "../../core/src/index.js";
import { renderToDomModel, type DomRenderNode } from "../src/index.js";

const ROOT_CONSTRAINTS = { maxWidth: 12, maxHeight: 8 };

test.describe("dom visual regression", () => {
  test("renders track layout and scroll clipping consistently", async ({
    page,
  }) => {
    const root = createViewNode({
      spec: {
        rows: [4, 4],
        columns: [6, 6],
        style: { background: "bg" },
      },
    });
    const topLeft = createViewNode({
      spec: { style: { background: "accent" } },
    });
    const topRight = createViewNode({
      spec: { style: { background: "warning" } },
    });
    const scroller = createViewNode({
      spec: {
        rows: [2, 2, 2],
        scroll: "y",
        style: { background: "bgAlt" },
      },
    });
    const bottomRight = createViewNode({
      spec: { style: { background: "selection" } },
    });
    appendChild(
      scroller,
      createViewNode({ spec: { style: { background: "success" } } }),
    );
    appendChild(
      scroller,
      createViewNode({ spec: { style: { background: "danger" } } }),
    );
    appendChild(
      scroller,
      createViewNode({ spec: { style: { background: "focus" } } }),
    );
    appendChild(root, topLeft);
    appendChild(root, topRight);
    appendChild(root, scroller);
    appendChild(root, bottomRight);

    const model = renderToDomModel(root, {
      constraints: ROOT_CONSTRAINTS,
      measureText: () => ({ width: 0, height: 0 }),
      scrollOffsets: new Map([[scroller.id, { x: 0, y: 1 }]]),
    });

    await page.setContent(renderFixture(model));

    await expect(page.locator("#fixture")).toHaveScreenshot(
      "dom-layout-scroll.png",
    );
  });

  test("renders hover and focus projections consistently", async ({ page }) => {
    const root = createViewNode({
      spec: {
        rows: [4],
        columns: [6, 6],
        style: { background: "bg" },
      },
    });
    const hovered = createViewNode({
      spec: {
        focusable: true,
        style: { background: "bgAlt" },
        styleHover: { background: "accent" },
      },
    });
    const focused = createViewNode({
      spec: {
        focusable: true,
        style: { background: "muted" },
        styleFocus: { background: "focus" },
      },
    });
    appendChild(root, hovered);
    appendChild(root, focused);

    const model = renderToDomModel(root, {
      constraints: ROOT_CONSTRAINTS,
      measureText: () => ({ width: 0, height: 0 }),
      hoveredNodeIds: new Set([hovered.id]),
      focusedNodeId: focused.id,
    });

    await page.setContent(renderFixture(model));

    await expect(page.locator("#fixture")).toHaveScreenshot(
      "dom-hover-focus.png",
    );
  });
});

function renderFixture(model: DomRenderNode): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --faux-ui-color-fg: #1c1a18;
        --faux-ui-color-muted: #786c61;
        --faux-ui-color-accent: #efb64d;
        --faux-ui-color-success: #4e9f6d;
        --faux-ui-color-warning: #d97a2b;
        --faux-ui-color-danger: #c75243;
        --faux-ui-color-bg: #f5efe3;
        --faux-ui-color-bgAlt: #ded4c3;
        --faux-ui-color-border: #a1927f;
        --faux-ui-color-focus: #2c5f8a;
        --faux-ui-color-selection: #7aa6c2;
        --faux-ui-color-inverse: #fffdf8;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, #fff8eb 0, #fff8eb 18%, transparent 18%),
          linear-gradient(180deg, #efe5d4 0%, #e3d6bf 100%);
        font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
      }

      #fixture {
        position: relative;
        width: ${model.styles.width ?? "0px"};
        height: ${model.styles.height ?? "0px"};
        overflow: hidden;
        transform: scale(24);
        transform-origin: top left;
        image-rendering: pixelated;
        box-shadow: 0 18px 40px rgba(72, 52, 25, 0.18);
      }
    </style>
  </head>
  <body>
    <div id="fixture">${renderNode(model)}</div>
  </body>
</html>`;
}

function renderNode(node: DomRenderNode): string {
  const style = Object.entries(node.styles)
    .map(([name, value]) => `${toKebabCase(name)}:${value}`)
    .join(";");

  if (node.kind === "text") {
    return `<${node.tag} style="${escapeAttribute(style)}">${escapeHtml(
      node.textContent ?? "",
    )}</${node.tag}>`;
  }

  const children = node.children.map((child) => renderNode(child)).join("");
  return `<${node.tag} style="${escapeAttribute(style)}">${children}</${node.tag}>`;
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
