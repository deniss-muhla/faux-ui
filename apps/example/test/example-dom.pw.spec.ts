import { expect, test } from "@playwright/test";

test.describe("faux-ui DOM host", () => {
  test("mounts the release fixture without app CSS or per-cell elements", async ({
    page,
  }) => {
    await page.goto("/");
    const surface = page.locator("[data-faux-ui-surface]");
    await expect(surface).toHaveAttribute("role", "application");
    await expect(surface).toHaveAttribute("aria-label", "faux-ui release review");
    await expect(surface).toHaveCSS("width", "720px");
    await expect(surface).toHaveCSS("height", "528px");

    expect(await page.locator("[data-faux-ui-row]").count()).toBe(33);
    expect(await page.locator("[data-faux-ui-cell]").count()).toBe(0);
    expect(await page.locator("[data-faux-ui-run]").count()).toBeLessThan(500);
    expect(await page.locator('[role="button"]').count()).toBe(19);
    expect(
      await page.evaluate(() => ({
        bodyMargin: getComputedStyle(document.body).margin,
        bodyOverflow: getComputedStyle(document.body).overflow,
      })),
    ).toEqual({ bodyMargin: "0px", bodyOverflow: "hidden" });
  });

  test("shares keyboard, action, and pixel-to-cell behavior", async ({ page }) => {
    await page.goto("/");
    const surface = page.locator("[data-faux-ui-surface]");
    await surface.focus();
    await page.waitForTimeout(0);

    await page.keyboard.press("2");
    await expect(page.locator("[data-faux-ui-visual]")).toContainText(
      "Approve: RQ-1042",
    );

    const rect = await surface.boundingBox();
    if (rect === null) throw new Error("Missing faux-ui surface bounds.");
    // The second queue item occupies logical rows 6-7 in the 8x16 grid.
    await page.mouse.click(rect.x + 5 * 8 + 4, rect.y + 6 * 16 + 8);
    await expect(page.locator("[data-faux-ui-visual]")).toContainText(
      "RQ-1041",
    );

    await page.keyboard.press("Control+r");
    await expect(page.locator("[data-faux-ui-visual]")).toContainText(
      "Refreshed queue",
    );
  });

  test("recomputes explicit engine bounds when the viewport changes", async ({
    page,
  }) => {
    await page.goto("/");
    await page.setViewportSize({ width: 640, height: 400 });
    await expect(page.locator("[data-faux-ui-surface]")).toHaveCSS(
      "width",
      "640px",
    );
    await expect(page.locator("[data-faux-ui-surface]")).toHaveCSS(
      "height",
      "400px",
    );
    await expect(page.locator("[data-faux-ui-row]")).toHaveCount(25);
  });
});
