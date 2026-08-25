// `defineConfig` comes from vitest/config, not vite: the `test` block below is not part of Vite's
// own config type, so importing it from "vite" leaves this file unchecked.
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001"
    }
  },
  build: {
    outDir: "dist/client"
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    globals: true,
    // `.worktrees/` holds detached copies of old branches with their own `node_modules`. Collecting
    // their tests resolves a second React against this one and fails on a null dispatcher.
    exclude: [...configDefaults.exclude, "**/.worktrees/**"]
  }
});
