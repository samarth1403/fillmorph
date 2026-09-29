import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the per-subpath tsconfig `paths`, so tests import sibling subpaths from source.
    alias: [
      { find: /^fillmorph$/, replacement: "/src/core/index.ts" },
      { find: /^fillmorph\/dom$/, replacement: "/src/dom/index.ts" },
    ],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "harness/**/*.test.ts"],
  },
});
