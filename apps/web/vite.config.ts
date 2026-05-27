import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  test: {
    // Pure-function tests only — no browser, no DOM, no React rendering.
    // E2E lives in tests/e2e/ (Playwright); this covers lib utilities.
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", "tests/e2e"],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@chonburi/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    // deck.gl + maplibre are inherently large (~1 MB each gzipped to ~300 KB);
    // they're now split into stable vendor chunks so the warning is expected.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Stable vendor splits — these rarely change so they cache aggressively.
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@deck.gl") || id.includes("node_modules/@luma.gl") || id.includes("node_modules/@loaders.gl") || id.includes("node_modules/@probe.gl")) {
            return "vendor-deck";
          }
          if (id.includes("node_modules/maplibre-gl") || id.includes("node_modules/react-map-gl")) {
            return "vendor-map";
          }
        },
      },
    },
  },
});
