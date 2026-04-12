import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: [
    "packages/render-dom/test/**/*.pw.spec.ts",
    "apps/example/test/**/*.pw.spec.ts",
    "apps/design-system-gallery/test/**/*.pw.spec.ts",
  ],
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    viewport: { width: 720, height: 540 },
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: [
    {
      command: "bun run --cwd apps/example dev:dom",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "bun run --cwd apps/design-system-gallery dev:dom",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
