import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Relative asset paths so the built bundle works when opened directly or
  // served from any subpath, not just a domain root.
  base: "./",
  // Inline JS + CSS into a single index.html so the build runs straight from
  // a file:// double-click (external ES-module scripts are CORS-blocked there).
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
