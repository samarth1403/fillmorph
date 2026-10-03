import { describe, expect, it } from "vitest";
import { vetIcons } from "../../harness/vet-icons.ts";
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
