import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const demoRoot = new URL(".", import.meta.url).pathname;
const builtPackage = (entry: string): string =>
  new URL(`../dist/${entry}`, import.meta.url).pathname;

/**
 * The demo site (spec 08 #1, §1b): `pnpm demo:dev` serves it, `pnpm demo:build` writes the static
 * site to `demo/dist/` and `pnpm demo:preview` serves that build.
 *
 * `fillmorph`, `fillmorph/dom` and `fillmorph/react` resolve to the package's built `dist/` (each
 * script runs `tsup` first), never to `src/`: the site runs exactly what ships.
 */
export default defineConfig({
  root: demoRoot,
  // Relative asset URLs, so the build works from any path on the server.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^fillmorph$/, replacement: builtPackage("core/index.js") },
      { find: /^fillmorph\/dom$/, replacement: builtPackage("dom/index.js") },
      { find: /^fillmorph\/react$/, replacement: builtPackage("react/index.js") },
    ],
  },
  build: { outDir: "dist", emptyOutDir: true },
});
