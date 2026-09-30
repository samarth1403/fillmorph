import { describe, expect, it } from "vitest";
import type { Contour } from "../contour";
import { parseIcon } from "../parse/parse-icon";
import { CUSTOM_BULLSEYE, CUSTOM_TWO_HOLES, FA_SOLID_CIRCLE } from "../parse/test-fixtures";
import { matchContours } from "./match-contours";
import { contour, rectangle } from "./test-helpers";

const ids = (pairs: { from: Contour; to: Contour }[]): string[] =>
  pairs.map((pair) => `${pair.from.id}>${pair.to.id}`);

describe("matchContours", () => {
  it("pairs siblings by centroid x, whatever their array order", () => {
    const from = [
      contour("f0", null, 0, rectangle(60, 0, 10, 10)),
      contour("f1", null, 0, rectangle(0, 0, 10, 10)),
      contour("f2", null, 0, rectangle(30, 0, 10, 10)),
    ];
    const to = [
      contour("t0", null, 0, rectangle(5, 50, 10, 10)),
      contour("t1", null, 0, rectangle(70, 50, 10, 10)),
      contour("t2", null, 0, rectangle(40, 50, 10, 10)),
    ];
    expect(ids(matchContours(from, to).matched)).toEqual(["f1>t0", "f2>t2", "f0>t1"]);
  });

  it("breaks centroid-x ties by centroid y, then by array order", () => {
    const from = [
      contour("low", null, 0, rectangle(0, 60, 10, 10)),
      contour("high", null, 0, rectangle(0, 0, 10, 10)),
    ];
    const to = [
      contour("a", null, 0, rectangle(0, 0, 10, 10)),
      contour("b", null, 0, rectangle(0, 0, 10, 10)),
    ];
    expect(ids(matchContours(from, to).matched)).toEqual(["high>a", "low>b"]);
  });

  it("matches children only within matched parents", () => {
    const from = [
      contour("L", null, 0, rectangle(0, 0, 40, 40)),
      contour("L-hole", "L", 1, rectangle(10, 10, 10, 10)),
      contour("R", null, 0, rectangle(50, 0, 40, 40)),
      contour("R-hole", "R", 1, rectangle(60, 10, 10, 10)),
    ];
    // `l` has no hole and `r` has two. Matching all holes by one global centroid order would pair
    // L's hole with r's left hole; per parent, L's hole has no partner and disappears.
    const to = [
      contour("r", null, 0, rectangle(50, 0, 40, 40)),
      contour("r-left", "r", 1, rectangle(52, 10, 5, 5)),
      contour("r-right", "r", 1, rectangle(80, 10, 5, 5)),
      contour("l", null, 0, rectangle(0, 0, 40, 40)),
    ];
    const result = matchContours(from, to);
    expect(ids(result.matched)).toEqual(["L>l", "R>r", "R-hole>r-left"]);
    expect(result.unmatchedFrom.map((c) => c.id)).toEqual(["L-hole"]);
    expect(result.unmatchedTo.map((c) => c.id)).toEqual(["r-right"]);
  });

  it("flags the extra siblings on the longer side as unmatched (two holes → none)", () => {
    const b = parseIcon(CUSTOM_TWO_HOLES).contours;
    const circle = parseIcon(FA_SOLID_CIRCLE).contours;
    const result = matchContours(b, circle);
    expect(result.matched).toHaveLength(1);
    expect(result.unmatchedFrom.map((c) => c.isHole)).toEqual([true, true]);
    expect(result.unmatchedTo).toEqual([]);

    const reverse = matchContours(circle, b);
    expect(reverse.unmatchedTo.map((c) => c.isHole)).toEqual([true, true]);
    expect(reverse.unmatchedFrom).toEqual([]);
  });

  it("hands every descendant of an unmatched contour to degradation too (depth 0/1/2 → 0)", () => {
    const bullseye = parseIcon(CUSTOM_BULLSEYE).contours;
    const circle = parseIcon(FA_SOLID_CIRCLE).contours;
    const result = matchContours(bullseye, circle);
    expect(result.matched).toHaveLength(1);
    expect(result.unmatchedFrom.map((c) => c.depth).sort()).toEqual([1, 2]);
  });

  it("places every input contour in exactly one list", () => {
    const from = parseIcon(CUSTOM_BULLSEYE).contours;
    const to = parseIcon(CUSTOM_TWO_HOLES).contours;
    const result = matchContours(from, to);
    const fromSeen = [...result.matched.map((p) => p.from), ...result.unmatchedFrom];
    const toSeen = [...result.matched.map((p) => p.to), ...result.unmatchedTo];
    expect(fromSeen.map((c) => c.id).sort()).toEqual(from.map((c) => c.id).sort());
    expect(toSeen.map((c) => c.id).sort()).toEqual(to.map((c) => c.id).sort());
  });

  it("matches nothing and loses nothing when one side is empty", () => {
    const circle = parseIcon(FA_SOLID_CIRCLE).contours;
    expect(matchContours([], circle)).toEqual({
      matched: [],
      unmatchedFrom: [],
      unmatchedTo: circle,
    });
    expect(matchContours([], [])).toEqual({ matched: [], unmatchedFrom: [], unmatchedTo: [] });
  });

  it("rejects duplicate ids, a dangling parentId, a parent cycle, and an empty contour", () => {
    const square = rectangle(0, 0, 10, 10);
    const ok = [contour("a", null, 0, square)];
    expect(() =>
      matchContours([contour("a", null, 0, square), contour("a", null, 0, square)], ok),
    ).toThrow(/share the id "a"/);
    expect(() => matchContours(ok, [contour("h", "missing", 1, square)])).toThrow(
      /names parent "missing"/,
    );
    expect(() =>
      matchContours(ok, [contour("x", "y", 1, square), contour("y", "x", 1, square)]),
    ).toThrow(TypeError);
    expect(() => matchContours([contour("e", null, 0, [])], ok)).toThrow(/has no points/);
  });
});
