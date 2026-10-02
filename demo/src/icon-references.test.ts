import { describe, expect, it } from "vitest";
import { ALL_ICONS } from "./catalog";
import { UI_PAIRS } from "./ui-icons";

/** Every demo source file, as text (tests excluded: they may name icons on purpose to fail). */
const SOURCES = import.meta.glob<string>(["./**/*.{ts,tsx}", "!./**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const known = new Set([
  ...ALL_ICONS.map((icon) => icon.id),
  ...UI_PAIRS.flatMap((pair) =>
    pair.icons.map((icon) => icon.name.slice(icon.name.lastIndexOf("/") + 1, -".svg".length)),
  ),
]);

/**
 * Spec 08's rule that every morphing icon is vetted, enforced at the source: an icon id written
 * anywhere in the demo that isn't in the 164-icon set or a UI pair would throw when its module
 * loads (as `fa-regular-image` once did in the hero), so it fails here instead of on the page.
 */
describe("icon ids referenced in the demo's source", () => {
  it.each(Object.entries(SOURCES))("%s names only vetted icons", (_path, source) => {
    const ids = [...source.matchAll(/"(fa-(?:solid|regular)-[a-z0-9-]+)"/g)].map(
      (match) => match[1],
    );
    expect(ids.filter((id) => id !== undefined && !known.has(id))).toEqual([]);
  });
});
