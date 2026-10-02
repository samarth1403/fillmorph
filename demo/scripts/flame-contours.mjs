// Prints the brand flame's outline (Font Awesome Free's solid "fire", the same file as in
// demo/icons/) as JSON, parsed by fillmorph's own `parseIcon` from the built package: canonical
// 0–100 frame, the 448×512 glyph centered in a square, exactly like favicon.svg's viewBox.
// Run through `pnpm demo:favicons`, which builds the package first.
import { readFileSync } from "node:fs";
import { parseIcon } from "fillmorph";

const markup = readFileSync(new URL("../icons/fa-solid-fire.svg", import.meta.url), "utf8");
const { contours } = parseIcon(markup);
process.stdout.write(
  JSON.stringify(
    contours.map((c) => ({ depth: c.depth, points: c.points.map((p) => [p.x, p.y]) })),
  ),
);
