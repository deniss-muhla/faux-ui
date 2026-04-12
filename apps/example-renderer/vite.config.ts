import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@faux-ui/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@faux-ui/ui/jsx-runtime": resolve(
        __dirname,
        "../../packages/ui/src/jsx-runtime.ts",
      ),
      "@faux-ui/ui/jsx-dev-runtime": resolve(
        __dirname,
        "../../packages/ui/src/jsx-dev-runtime.ts",
      ),
      "@faux-ui/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@faux-ui/renderer": resolve(
        __dirname,
        "../../packages/renderer/src/index.ts",
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
    },
  },
  esbuild: {
    jsxImportSource: "@faux-ui/ui",
  },
  server: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
  },
});
