import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate vitest config — avoids the @vitejs/plugin-react type conflict that
// arises when vitest/config's bundled vite and the project's vite have
// different @types/node versions. Tests are pure Node (no DOM/React), so the
// react plugin is not needed here. The full vite config (with react plugin)
// lives in vite.config.ts and is used only for the build.
export default defineConfig({
  test: {
    // Pure-function tests only — no browser, no DOM, no React rendering.
    // E2E lives in tests/e2e/ (Playwright); this covers lib utilities.
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", "tests/e2e"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@chonburi/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
