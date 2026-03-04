import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    headers: {
      // SharedArrayBuffer is required by both Emscripten LVGL and @wasmer/sdk.
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },

  // @wasmer/sdk ships pre-bundled ESM; exclude it from Vite's dep optimizer
  // to avoid double-bundling and Worker URL rewriting issues.
  optimizeDeps: {
    exclude: ["@wasmer/sdk"],
  },

  build: {
    // top-level await is used by @wasmer/sdk internally
    target: "esnext",
  },
});
