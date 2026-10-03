import { describe, expect, it } from "vitest";
import { ICON_INPUT_SNIPPETS, SNIPPETS } from ".";

/** The snippet folder's SVG files, which the snippets import, and the vetted originals. */
const SNIPPET_SVGS = import.meta.glob<string>("./*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});
const VETTED = import.meta.glob<string>("../../icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Each snippet SVG is a verbatim copy of a vetted icon under a reader-friendly name. */
const ORIGINALS: Record<string, string> = {
  "./heart-outline.svg": "../../icons/fa-regular-heart.svg",
  "./heart-solid.svg": "../../icons/fa-solid-heart.svg",
  "./volume-low.svg": "../../icons/fa-solid-volume-low.svg",
  "./volume-xmark.svg": "../../icons/fa-solid-volume-xmark.svg",
};

const SHOWN = [
  ...SNIPPETS.map((snippet) => [snippet.file, snippet.code] as const),
  ...Object.values(ICON_INPUT_SNIPPETS).map((snippet) => [snippet.file, snippet.code] as const),
];

describe("the code listings the page shows", () => {
  it.each(SHOWN)("%s imports every .svg with ?raw, in the code itself", (_file, code) => {
    const svgImports = [...code.matchAll(/^import .* from "([^"]*\.svg[^"]*)";/gm)].map(
      (match) => match[1],
    );
    for (const path of svgImports) expect(path).toMatch(/\.svg\?raw$/);
  });

  it("the Get started examples show their ?raw imports (they used to hide them in another file)", () => {
    for (const snippet of SNIPPETS) {
      expect(snippet.code).toMatch(/^import heartOutline from "\.\/heart-outline\.svg\?raw";/m);
    }
  });
});

describe("the SVG files the snippets import", () => {
  it.each(Object.keys(SNIPPET_SVGS))("%s is a byte-identical copy of a vetted icon", (path) => {
    const original = ORIGINALS[path];
    expect(original).toBeDefined();
    expect(SNIPPET_SVGS[path]).toBe(VETTED[original ?? ""]);
  });
});
