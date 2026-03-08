import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@faux-ui/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@faux-ui/devtools": resolve(__dirname, "packages/devtools/src/index.ts"),
      "@faux-ui/dom": resolve(__dirname, "packages/dom/src/index.ts"),
      "@faux-ui/schema": resolve(__dirname, "packages/schema/src/index.ts"),
      "@faux-ui/tui": resolve(__dirname, "packages/tui/src/index.ts"),
      "@faux-ui/reconciler": resolve(
        __dirname,
        "packages/reconciler/src/index.ts",
      ),
      "@faux-ui/mcp": resolve(__dirname, "packages/mcp/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
