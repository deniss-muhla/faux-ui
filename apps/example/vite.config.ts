import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@faux-ui/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@faux-ui/dom": resolve(__dirname, "../../packages/dom/src/index.ts"),
      "@faux-ui/reconciler": resolve(
        __dirname,
        "../../packages/reconciler/src/index.ts",
      ),
      "@faux-ui/tui": resolve(__dirname, "../../packages/tui/src/index.ts"),
    },
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
