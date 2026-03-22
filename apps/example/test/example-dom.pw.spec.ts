import { expect, test } from "@playwright/test";

test.describe("example-dom", () => {
  test("updates focus state and current lane through live interactions", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/");

    const backlogLane = page
      .locator('#surface [tabindex="0"]')
      .filter({ hasText: "Backlog" })
      .first();
    const actionRouterTask = page
      .locator('#surface [tabindex="0"]')
      .filter({ hasText: "Action router" })
      .first();
    const priorityToggle = page
      .locator('#surface [tabindex="0"]')
      .filter({ hasText: "Priority" })
      .first();

    await expect(page.getByText("Focused node")).toBeVisible();
    await expect(page.getByText("none", { exact: true })).toBeVisible();
    await expect(backlogLane).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByText(/^node\s+\d+$/)).toBeVisible();

    await backlogLane.focus();
    await page.keyboard.press("Enter");

    await expect(actionRouterTask).toBeVisible();
    await expect(page.getByText("Lane changed to Backlog.")).toBeVisible();

    await actionRouterTask.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Task focused: Action router.")).toBeVisible();

    await priorityToggle.focus();
    await page.keyboard.press(" ");
    await expect(page.getByText("Rush orbit", { exact: true })).toBeVisible();
    await expect(page.getByText("Priority mode is now rush.")).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByText(/^node\s+\d+$/)).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
