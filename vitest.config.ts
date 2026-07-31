import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@faux-ui/ui/dom", replacement: resolve(import.meta.dirname, "packages/ui/src/dom.ts") },
      { find: "@faux-ui/ui/tui", replacement: resolve(import.meta.dirname, "packages/ui/src/tui.ts") },
      { find: "@faux-ui/ui/testing", replacement: resolve(import.meta.dirname, "packages/ui/src/testing.ts") },
      { find: "@faux-ui/ui/jsx-runtime", replacement: resolve(import.meta.dirname, "packages/ui/src/jsx-runtime.ts") },
      { find: "@faux-ui/ui/jsx-dev-runtime", replacement: resolve(import.meta.dirname, "packages/ui/src/jsx-dev-runtime.ts") },
      { find: "@faux-ui/ui", replacement: resolve(import.meta.dirname, "packages/ui/src/index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: [
      "packages/*/test/**/*.test.{ts,tsx}",
      "apps/*/test/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
