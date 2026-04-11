import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@faux-ui/action": resolve(
        __dirname,
        "../../design-system/action/src/index.tsx",
      ),
      "@faux-ui/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@faux-ui/foundation": resolve(
        __dirname,
        "../../design-system/foundation/src/index.tsx",
      ),
      "@faux-ui/app": resolve(__dirname, "../../packages/app/src/index.ts"),
      "@faux-ui/renderer": resolve(
        __dirname,
        "../../packages/renderer/src/index.ts",
      ),
      "@faux-ui/render-dom": resolve(
        __dirname,
        "../../packages/render-dom/src/index.ts",
      ),
      "@faux-ui/reconciler/jsx-runtime": resolve(
        __dirname,
        "../../packages/reconciler/src/jsx-runtime.ts",
      ),
      "@faux-ui/reconciler/jsx-dev-runtime": resolve(
        __dirname,
        "../../packages/reconciler/src/jsx-dev-runtime.ts",
      ),
      "@faux-ui/reconciler": resolve(
        __dirname,
        "../../packages/reconciler/src/index.ts",
      ),
      "@faux-ui/render-tui": resolve(
        __dirname,
        "../../packages/render-tui/src/index.ts",
      ),
      "@faux-ui/surface": resolve(
        __dirname,
        "../../design-system/surface/src/index.tsx",
      ),
    },
  },
  esbuild: {
    jsxImportSource: "@faux-ui/reconciler",
  },
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});
