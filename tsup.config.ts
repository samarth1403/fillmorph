import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "dom/index": "src/dom/index.ts",
    "react/index": "src/react/index.ts",
  },
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  clean: true,
  tsconfig: "tsconfig.base.json",
  // The base tsconfig sets no `jsx`, so esbuild would default to classic `React.createElement`
  // calls with no `React` import; the automatic runtime imports `react/jsx-runtime` itself.
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
  dts: {
    compilerOptions: {
      // tsup's dts worker injects `baseUrl`, which TypeScript 6 flags as deprecated.
      ignoreDeprecations: "6.0",
      lib: ["ES2022", "DOM"],
      jsx: "react-jsx",
      // Without these, the package self-reference resolves to the previous build's dist/ types.
      paths: {
        fillmorph: ["./src/core/index.ts"],
        "fillmorph/dom": ["./src/dom/index.ts"],
      },
    },
  },
  // Subpaths import each other through the package's own public specifiers, so they must stay
  // external: bundling core into dom/react would duplicate it and break consumer tree-shaking.
  external: ["fillmorph", "fillmorph/dom", "react", /^react\//],
});
