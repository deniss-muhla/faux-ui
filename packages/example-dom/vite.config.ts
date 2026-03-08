import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@faux-ui/core": resolve(__dirname, "../core/src/index.ts"),
      "@faux-ui/dom": resolve(__dirname, "../dom/src/index.ts"),
      "@faux-ui/reconciler": resolve(
        __dirname,
        "../reconciler/src/index.ts",
      ),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
});