import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const src = (name: string): string =>
  `/@fs/${resolve(import.meta.dirname, `../src/internal/${name}.ts`)}`;

test.describe("vNext DOM scene spike", () => {
  test("groups rows into style runs and maps real pixels to cells", async ({
    page,
  }) => {
    await page.goto("/");
    const result = await page.evaluate(
      async ({ domUrl, layoutUrl, modelUrl, sceneUrl }) => {
        const { DomSceneProjector, clientPointToCell } = await import(domUrl);
        const { computeLayout } = await import(layoutUrl);
        const { createBoxNode, createTextNode, replaceChildren } = await import(
          modelUrl
        );
        const { paintScene } = await import(sceneUrl);

        document.body.replaceChildren();
        document.body.style.margin = "0";
        const root = createBoxNode(1, {
          border: true,
          accessibleLabel: "Review queue",
        });
        const action = createBoxNode(2, {
          focusable: true,
          onPress: () => {},
          accessibleLabel: "Approve",
          styleFocus: { background: "focus" },
        });
        const label = createTextNode(3, { text: "A古é👩‍💻" });
        replaceChildren(action, [label]);
        replaceChildren(root, [action]);

        const layout = computeLayout(root, { width: 20, height: 4 });
        const scene = paintScene(root, layout, { focusedId: 2 });
        const surface = document.createElement("div");
        surface.style.position = "absolute";
        surface.style.left = "37px";
        surface.style.top = "29px";
        document.body.append(surface);

        const projector = new DomSceneProjector(surface, {
          ariaLabel: "Review queue",
          cellSize: { width: 8, height: 16 },
        });
        const stats = projector.updateScene(scene);
        projector.updateAccessibility(root, 2);

        const rect = surface.getBoundingClientRect();
        const point = clientPointToCell(
          rect,
          { width: scene.width, height: scene.height },
          rect.left + 8 * 7 + 4,
          rect.top + 16 * 2 + 8,
        );
        const rowElements = [...surface.querySelectorAll<HTMLElement>("[data-faux-ui-row]")];
        const runElements = [...surface.querySelectorAll<HTMLElement>("[data-faux-ui-run]")];
        const fittedWidthErrors = runElements.map((run) => {
          const width = Number(run.dataset.fauxUiRun?.split(":")[2] ?? 0) * 8;
          const text = run.querySelector<HTMLElement>("[data-faux-ui-text]");
          return Math.abs((text?.getBoundingClientRect().width ?? 0) - width);
        });
        const firstRowRun = rowElements[0]?.querySelector<HTMLElement>("[data-faux-ui-run]");
        const secondRowRuns = [
          ...(rowElements[1]?.querySelectorAll<HTMLElement>("[data-faux-ui-run]") ?? []),
        ];
        const firstRect = firstRowRun?.getBoundingClientRect();
        const secondRect = secondRowRuns[0]?.getBoundingClientRect();
        const thirdRect = secondRowRuns[1]?.getBoundingClientRect();

        surface.style.transformOrigin = "left top";
        surface.style.transform = "scale(0.9)";
        projector.updateScene(scene);
        const scaledFittedWidthErrors = [
          ...surface.querySelectorAll<HTMLElement>("[data-faux-ui-run]"),
        ].map((run) => {
          const width = Number(run.dataset.fauxUiRun?.split(":")[2] ?? 0) * 8 * 0.9;
          const text = run.querySelector<HTMLElement>("[data-faux-ui-text]");
          return Math.abs((text?.getBoundingClientRect().width ?? 0) - width);
        });
        surface.style.transform = "";

        return {
          stats,
          point,
          role: surface.getAttribute("role"),
          label: surface.getAttribute("aria-label"),
          activeDescendant: surface.getAttribute("aria-activedescendant"),
          tabIndex: surface.tabIndex,
          rowElements: rowElements.length,
          runElements: runElements.length,
          cellElements: surface.querySelectorAll("[data-faux-ui-cell]").length,
          maxFittedWidthError: Math.max(...fittedWidthErrors),
          maxScaledFittedWidthError: Math.max(...scaledFittedWidthErrors),
          verticalOverlap:
            firstRect === undefined || secondRect === undefined
              ? 0
              : firstRect.bottom - secondRect.top,
          horizontalOverlap:
            secondRect === undefined || thirdRect === undefined
              ? 0
              : secondRect.right - thirdRect.left,
          buttonRole: surface
            .querySelector('[data-faux-ui-accessibility] [role="button"]')
            ?.getAttribute("role"),
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        };
      },
      {
        domUrl: src("dom-scene"),
        layoutUrl: src("layout"),
        modelUrl: src("model"),
        sceneUrl: src("scene"),
      },
    );

    expect(result.stats.cells).toBe(80);
    expect(result.stats.rows).toBe(4);
    expect(result.stats.runs).toBeLessThan(20);
    expect(result.rowElements).toBe(4);
    expect(result.runElements).toBe(result.stats.runs);
    expect(result.cellElements).toBe(0);
    expect(result.maxFittedWidthError).toBeLessThan(0.05);
    expect(result.maxScaledFittedWidthError).toBeLessThan(0.05);
    expect(result.verticalOverlap).toBeGreaterThanOrEqual(1);
    expect(result.horizontalOverlap).toBeGreaterThanOrEqual(1);
    expect(result.point).toEqual({ x: 7, y: 2 });
    expect(result.rect).toEqual({ left: 37, top: 29, width: 160, height: 64 });
    expect(result).toMatchObject({
      role: "application",
      label: "Review queue",
      tabIndex: 0,
      buttonRole: "button",
    });
    expect(result.activeDescendant).toMatch(/^faux-ui-\d+-a11y-2$/u);
  });

  test("cleans up failed and successful DOM mounts", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(
      async ({ componentsUrl, domUrl }) => {
        const reactUrl: string = "/@id/react";
        const react = await import(reactUrl);
        const createElement = react.createElement ?? react.default?.createElement;
        if (createElement === undefined) throw new Error("Missing React.createElement");
        const { Row, Text } = await import(componentsUrl);
        const { render } = await import(domUrl);
        document.body.replaceChildren();
        document.body.setAttribute("style", "color: rgb(1, 2, 3)");
        const original = document.body.getAttribute("style");
        let failure = "";
        try {
          render(createElement(Row, null, "raw text"), {
            width: 8,
            height: 1,
          });
        } catch (error) {
          failure = String(error);
        }
        const afterFailure = {
          surfaces: document.querySelectorAll("[data-faux-ui-surface]").length,
          style: document.body.getAttribute("style"),
        };
        const handle = render(createElement(Text, null, "ok"), {
          width: 8,
          height: 1,
        });
        const mounted = document.querySelectorAll("[data-faux-ui-surface]").length;
        handle.unmount();
        return {
          original,
          failure,
          afterFailure,
          mounted,
          afterUnmount: {
            surfaces: document.querySelectorAll("[data-faux-ui-surface]").length,
            style: document.body.getAttribute("style"),
          },
        };
      },
      { componentsUrl: src("../components"), domUrl: src("../dom") },
    );

    expect(result.failure).toContain("must be inside <Text>");
    expect(result.afterFailure).toEqual({ surfaces: 0, style: result.original });
    expect(result.mounted).toBe(1);
    expect(result.afterUnmount).toEqual({ surfaces: 0, style: result.original });
  });
});
