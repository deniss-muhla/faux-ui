import { expect, test } from "@playwright/test";

test.describe("design-system-gallery", () => {
  test("renders the default gallery matrix consistently", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("http://127.0.0.1:4174/");

    await expect(page.getByText("faux-ui gallery")).toBeVisible();
    await expect(page.getByText("Primary action")).toBeVisible();
    await expect(page.getByText("Selected tile")).toBeVisible();
    await expect(page.locator("body")).toHaveScreenshot(
      "design-system-gallery.png",
    );

    expect(pageErrors).toEqual([]);
  });
});
