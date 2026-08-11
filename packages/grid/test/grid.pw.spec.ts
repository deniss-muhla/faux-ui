import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const source = (path: string): string =>
  `/@fs/${resolve(import.meta.dirname, path)}`;

test("standalone Grid uses the public DOM host and shared interaction", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(
    async ({ domUrl, gridUrl, reactUrl, sceneUrl, uiUrl }) => {
      const { render } = await import(domUrl);
      const { Text } = await import(uiUrl);
      const { Grid, GridItem } = await import(gridUrl);
      const react = await import(reactUrl);
      const { sceneToText } = await import(sceneUrl);
      const createElement = react.createElement ?? react.default?.createElement;
      if (createElement === undefined) throw new Error("Missing React.createElement");

      document.body.replaceChildren();
      let presses = 0;
      const app = render(
        createElement(
          Grid,
          {
            columns: [4, "1fr"],
            rows: [1, 2],
            gap: { x: 1 },
          },
          createElement(
            GridItem,
            { row: 1, column: 1, columnSpan: 2 },
            createElement(Text, null, "Grid header"),
          ),
          createElement(
            GridItem,
            { row: 2, column: 1 },
            createElement(Text, null, "Left"),
          ),
          createElement(
            GridItem,
            {
              row: 2,
              column: 2,
              focusable: true,
              accessibleLabel: "Run grid action",
              onPress: () => {
                presses += 1;
              },
            },
            createElement(Text, null, "Run"),
          ),
        ),
        { width: 16, height: 3 },
      );
      app.element.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      );
      app.element.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      const text = sceneToText(app.getScene());
      const runNode = app.element.querySelector('[aria-label="Run grid action"]');
      app.unmount();
      return { text, presses, hasRunNode: runNode !== null };
    },
    {
      domUrl: source("../../ui/src/dom.ts"),
      gridUrl: source("../src/index.tsx"),
      reactUrl: "/@id/react",
      sceneUrl: source("../../ui/src/internal/scene.ts"),
      uiUrl: source("../../ui/src/index.ts"),
    },
  );

  expect(result.text).toBe("Grid header     \nLeft Run        \n                ");
  expect(result.presses).toBe(1);
  expect(result.hasRunNode).toBe(true);
});
