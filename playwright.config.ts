import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["packages/dom/test/**/*.pw.spec.ts"],
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    viewport: { width: 720, height: 540 },
  },
});
