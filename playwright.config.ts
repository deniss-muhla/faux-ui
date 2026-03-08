import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: [
    "packages/dom/test/**/*.pw.spec.ts",
    "packages/example-dom/test/**/*.pw.spec.ts",
  ],
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    viewport: { width: 720, height: 540 },
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: {
    command:
      "bun run --cwd packages/example-dom dev --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
