import { parseIcon } from "fillmorph";
import { describe, expect, it } from "vitest";
import { FIXTURE_NAMES, type FixtureName, loadFixture } from "./fixtures.ts";
import { findPair, REFERENCE_PAIRS } from "./pairs.ts";

function shape(name: FixtureName) {
  const { contours } = parseIcon(loadFixture(name));
  return {
    holes: contours.filter((contour) => contour.isHole).length,
    maxDepth: Math.max(...contours.map((contour) => contour.depth)),
  };
}

function pair(name: string) {
  const found = findPair(name);
  if (found === undefined) throw new Error(`no reference pair named ${name}`);
  return found;
}

describe("harness fixtures", () => {
  it.each(FIXTURE_NAMES)("%s is a real Font Awesome file that parseIcon accepts", (name) => {
    const svg = loadFixture(name);
    expect(svg).toContain("Font Awesome Free 6.7.2");
    expect(() => parseIcon(svg)).not.toThrow();
  });
});

describe("REFERENCE_PAIRS", () => {
  it("has unique names and a third, different icon to interrupt toward", () => {
    expect(new Set(REFERENCE_PAIRS.map((each) => each.name)).size).toBe(REFERENCE_PAIRS.length);
    for (const each of REFERENCE_PAIRS) {
      expect(each.from).not.toBe(each.to);
      expect([each.from, each.to]).not.toContain(each.interruptTo);
    }
  });

  it("covers solid → solid between different icons", () => {
    const { from, to } = pair("solid-heart-to-solid-circle");
    expect(from).not.toBe(to);
    expect(shape(from).holes).toBe(0);
    expect(shape(to).holes).toBe(0);
  });

  it("covers a filled (not stroked) outline → solid of the same icon", () => {
    const { from, to } = pair("regular-heart-to-solid-heart");
    expect([from, to]).toEqual(["fa-regular-heart", "fa-solid-heart"]);
    expect(shape(from)).toEqual({ holes: 1, maxDepth: 1 });
    expect(shape(to)).toEqual({ holes: 0, maxDepth: 0 });
  });

  it("covers 0 holes → 1 hole", () => {
    const { from, to } = pair("solid-circle-to-regular-circle");
    expect(shape(from).holes).toBe(0);
    expect(shape(to).holes).toBe(1);
  });

  it("covers 2 holes → 0 holes", () => {
    const { from, to } = pair("solid-b-to-solid-circle");
    expect(shape(from).holes).toBe(2);
    expect(shape(to).holes).toBe(0);
  });

  it("covers a depth 0/1/2 nested (bullseye-style) icon", () => {
    const { from } = pair("regular-circle-dot-to-solid-heart");
    expect(shape(from)).toEqual({ holes: 1, maxDepth: 2 });
  });
});
