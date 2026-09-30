import { defineConfig } from "tsup";

/**
 * Bundles the dev-only React check page (`pnpm dev:react`) into one classic script, so
 * `dev/react-check/index.html` opens straight from disk with no server.
 *
 * The `base` tsconfig has no `paths`, so `fillmorph/react` resolves through the package's
 * self-reference to the freshly built `dist/`: the page exercises what actually ships.
 */
export default defineConfig({
  entry: { "react-check": "dev/react-check/main.tsx" },
  format: ["iife"],
  platform: "browser",
  target: "es2022",
  outDir: "dev/output",
  clean: true,
  dts: false,
  tsconfig: "tsconfig.base.json",
  // Everything, React included, goes into the one script.
  noExternal: [/.*/],
  // The reference icons are imported as markup strings, straight from harness/fixtures/.
  loader: { ".svg": "text" },
  // React's development build, and fillmorph's dev-mode warnings.
  define: { "process.env.NODE_ENV": '"development"' },
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
