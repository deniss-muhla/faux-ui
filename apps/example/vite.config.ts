import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@faux-ui/ui/dom",
        replacement: resolve(import.meta.dirname, "../../packages/ui/src/dom.ts"),
      },
      {
        find: "@faux-ui/ui/tui",
        replacement: resolve(import.meta.dirname, "../../packages/ui/src/tui.ts"),
      },
      {
        find: "@faux-ui/ui/testing",
        replacement: resolve(import.meta.dirname, "../../packages/ui/src/testing.ts"),
      },
      {
        find: "@faux-ui/ui/jsx-runtime",
        replacement: resolve(import.meta.dirname, "../../packages/ui/src/jsx-runtime.ts"),
      },
      {
        find: "@faux-ui/ui/jsx-dev-runtime",
        replacement: resolve(import.meta.dirname, "../../packages/ui/src/jsx-dev-runtime.ts"),
      },
      {
        find: "@faux-ui/ui",
        replacement: resolve(import.meta.dirname, "../../packages/ui/src/index.ts"),
      },
    ],
  },
  esbuild: { jsxImportSource: "@faux-ui/ui" },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
