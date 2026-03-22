import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@faux-ui/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@faux-ui/render-dom": resolve(
        __dirname,
        "../../packages/render-dom/src/index.ts",
      ),
      "@faux-ui/app": resolve(__dirname, "../../packages/app/src/index.ts"),
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
    },
  },
  esbuild: {
    jsxImportSource: "@faux-ui/reconciler",
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
