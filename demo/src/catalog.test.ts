import { parseIcon } from "fillmorph";
import { describe, expect, it } from "vitest";
import { ALL_ICONS, CATEGORIES, FILE_IDS, findIcon } from "./catalog";

describe("the demo icon set", () => {
  it("puts every file in demo/icons/ in exactly one tab, and nothing else", () => {
    const ids = ALL_ICONS.map((icon) => icon.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...FILE_IDS].sort());
    for (const category of CATEGORIES) expect(category.icons.length).toBeGreaterThan(0);
  });

  it.each(ALL_ICONS.map((icon) => [icon.id, icon] as const))(
    "%s parses within the compatibility contract, nested at most one level (depth ≤ 2)",
    (_id, icon) => {
      const { contours } = parseIcon(icon.markup);
      expect(contours.length).toBeGreaterThan(0);
      expect(Math.max(...contours.map((contour) => contour.depth))).toBeLessThanOrEqual(2);
    },
  );

  it("is verbatim Font Awesome Free markup, license comment included", () => {
    for (const icon of ALL_ICONS) {
      expect(icon.markup).toContain("Font Awesome Free 6.7.2");
      expect(icon.markup).toContain("CC BY 4.0");
    }
  });

  it("labels each icon's style from its Font Awesome file name", () => {
    expect(findIcon("fa-solid-heart")).toMatchObject({ style: "solid", label: "Heart" });
    expect(findIcon("fa-regular-heart").style).toBe("regular");
    expect(findIcon("fa-solid-b").label).toBe("Letter B");
    expect(() => findIcon("fa-solid-nope")).toThrow();
  });
});
