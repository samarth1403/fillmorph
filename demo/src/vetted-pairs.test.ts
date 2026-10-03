import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fa6 from "react-icons/fa6";
import { describe, expect, it } from "vitest";
import { vetIcons } from "../../harness/vet-icons.ts";
import lockToggle from "./snippets/lock-toggle.tsx?raw";
import { UI_PAIRS } from "./ui-icons";

/** Spec 08 §1d: every icon pair the page morphs is vetted, inside the set or not. */
describe("icon pairs the page morphs outside the 164-icon set", () => {
  it.each(UI_PAIRS.map((pair) => [pair.name, pair] as const))(
    "the %s pair parses and morphs cleanly both ways",
    (_name, pair) => {
      expect(pair.icons).toHaveLength(2);
      const result = vetIcons(pair.icons);
      expect(result.rejected).toEqual([]);
      expect(result.pairCount).toBe(2);
      expect(result.failingPairs).toEqual([]);
    },
  );
});

/**
 * Spec 09's icon-input section morphs react-icons elements, not files: the pair is read from the
 * snippet's own source, so changing the icons there re-vets them here.
 */
describe("icon element pairs the page morphs", () => {
  it("the icon-input section's react-icons pair parses and morphs cleanly both ways", () => {
    const names = [...new Set([...lockToggle.matchAll(/<(Fa\w+)/g)].map((match) => match[1]))];
    expect(names).toHaveLength(2);
    const icons = names.map((name) => {
      const component = fa6[name as keyof typeof fa6];
      expect(component).toBeTypeOf("function");
      return { name: name ?? "", markup: renderToStaticMarkup(createElement(component)) };
    });
    const result = vetIcons(icons);
    expect(result.rejected).toEqual([]);
    expect(result.pairCount).toBe(2);
    expect(result.failingPairs).toEqual([]);
  });
});
