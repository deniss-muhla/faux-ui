import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@faux-ui/action": resolve(
        __dirname,
        "design-system/action/src/index.tsx",
      ),
      "@faux-ui/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@faux-ui/foundation": resolve(
        __dirname,
        "design-system/foundation/src/index.tsx",
      ),
      "@faux-ui/app": resolve(__dirname, "packages/app/src/index.ts"),
      "@faux-ui/devtools": resolve(__dirname, "packages/devtools/src/index.ts"),
      "@faux-ui/renderer": resolve(__dirname, "packages/renderer/src/index.ts"),
      "@faux-ui/render-dom": resolve(
        __dirname,
        "packages/render-dom/src/index.ts",
      ),
      "@faux-ui/render-inspect": resolve(
        __dirname,
        "packages/render-inspect/src/index.ts",
      ),
      "@faux-ui/schema": resolve(__dirname, "packages/schema/src/index.ts"),
      "@faux-ui/render-tui": resolve(
        __dirname,
        "packages/render-tui/src/index.ts",
      ),
      "@faux-ui/reconciler/jsx-runtime": resolve(
        __dirname,
        "packages/reconciler/src/jsx-runtime.ts",
      ),
      "@faux-ui/reconciler/jsx-dev-runtime": resolve(
        __dirname,
        "packages/reconciler/src/jsx-dev-runtime.ts",
      ),
      "@faux-ui/reconciler": resolve(
        __dirname,
        "packages/reconciler/src/index.ts",
      ),
      "@faux-ui/mcp": resolve(__dirname, "packages/mcp/src/index.ts"),
      "@faux-ui/surface": resolve(
        __dirname,
        "design-system/surface/src/index.tsx",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/*/test/**/*.test.ts",
      "design-system/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
    ],
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
