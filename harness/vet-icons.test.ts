import { describe, expect, it } from "vitest";
import { type FixtureName, loadFixture } from "./fixtures.ts";
import { naiveMorph } from "./morph-fn.ts";
import { vetIcons } from "./vet-icons.ts";

const source = (name: FixtureName) => ({ name, markup: loadFixture(name) });

describe("vetIcons", () => {
  it("passes a clean set, morphing every ordered pair", () => {
    const result = vetIcons(
      (["fa-solid-heart", "fa-regular-circle", "fa-solid-b"] as const).map(source),
    );
    expect(result.rejected).toEqual([]);
    expect(result.usable).toHaveLength(3);
    expect(result.pairCount).toBe(6);
    expect(result.failingPairs).toEqual([]);
  });

  it("rejects an icon nested deeper than one level, and one outside the contract", () => {
    const stroke =
      '<svg viewBox="0 0 24 24" fill="none" stroke="black"><path d="M2 2L22 22"/></svg>';
    const result = vetIcons([source("fa-solid-bullseye"), { name: "stroke", markup: stroke }]);
    expect(result.usable).toEqual([]);
    expect(result.rejected[0]).toEqual({
      name: "fa-solid-bullseye",
      reason: "nests 4 deep (at most 2)",
    });
    expect(result.rejected[1]?.reason).toMatch(/^FillmorphIncompatibleIconError: /);
    expect(result.pairCount).toBe(0);
  });

  it("reports a pair whose morph fails a check, by direction", () => {
    // Spec 03's naive stub self-intersects on this structurally different pair.
    const result = vetIcons(
      [source("fa-regular-circle-dot"), source("fa-solid-heart")],
      naiveMorph,
    );
    expect(result.failingPairs).toContainEqual({
      from: "fa-regular-circle-dot",
      to: "fa-solid-heart",
      checks: expect.arrayContaining(["self-intersection"]),
    });
  });
});
