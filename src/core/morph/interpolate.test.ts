import { describe, expect, it } from "vitest";
import type { Contour, Point } from "../contour";
import { parseIcon } from "../parse/parse-icon";
import {
  CUSTOM_BULLSEYE,
  CUSTOM_TWO_HOLES,
  FA_REGULAR_CIRCLE,
  FA_SOLID_BULLSEYE,
  FA_SOLID_CIRCLE,
  FA_SOLID_HEART,
} from "../parse/test-fixtures";
import { centroidOf } from "./centroid";
import {
  type ContourCorrespondence,
  correspondContours,
  interpolate,
} from "./interpolate";
import { contour, FA_REGULAR_HEART, rectangle } from "./test-helpers";

const ICONS = {
  solidHeart: parseIcon(FA_SOLID_HEART).contours,
  regularHeart: parseIcon(FA_REGULAR_HEART).contours,
  solidCircle: parseIcon(FA_SOLID_CIRCLE).contours,
  regularCircle: parseIcon(FA_REGULAR_CIRCLE).contours,
  twoHoles: parseIcon(CUSTOM_TWO_HOLES).contours,
  bullseye: parseIcon(CUSTOM_BULLSEYE).contours,
  faBullseye: parseIcon(FA_SOLID_BULLSEYE).contours,
};
const ALL_PAIRS = Object.values(ICONS).flatMap((from) =>
  Object.values(ICONS).map((to) => [from, to] as const),
);

const structureOf = (contours: readonly Contour[]) =>
  contours.map(({ id, parentId, isHole, depth }) => ({
    id,
    parentId,
    isHole,
    depth,
  }));

/** Whether `a` is `b` started at some other index. */
function isRotationOf(a: readonly Point[], b: readonly Point[]): boolean {
  if (a.length !== b.length) return false;
  return b.some((_, offset) =>
    a.every((point, index) => {
      const other = b[(index + offset) % b.length] as Point;
      return point.x === other.x && point.y === other.y;
    }),
  );
}

describe("interpolate - lerp math (deliverable #5)", () => {
  const from = [contour("a", null, 0, rectangle(0, 0, 10, 10))];
  const to = [contour("b", null, 0, rectangle(20, 40, 30, 10))];

  it("interpolates each paired point linearly", () => {
    const pairs = correspondContours(from, to);
    const [pair] = pairs;
    if (pair === undefined) throw new Error("expected one pair");
    for (const progress of [0, 0.25, 0.5, 0.9, 1]) {
      const [result] = interpolate(from, to, progress);
      result?.points.forEach((point, index) => {
        const start = pair.fromPoints[index] as Point;
        const end = pair.toPoints[index] as Point;
        expect(point.x).toBeCloseTo(start.x + (end.x - start.x) * progress, 12);
        expect(point.y).toBeCloseTo(start.y + (end.y - start.y) * progress, 12);
      });
    }
  });

  it("returns exactly the paired endpoints at progress 0 and 1", () => {
    const [pair] = correspondContours(from, to);
    expect(interpolate(from, to, 0)[0]?.points).toEqual(pair?.fromPoints);
    expect(interpolate(from, to, 1)[0]?.points).toEqual(pair?.toPoints);
  });

  it("extrapolates linearly outside 0…1", () => {
    const [pair] = correspondContours(from, to);
    const start = pair?.fromPoints[0] as Point;
    const end = pair?.toPoints[0] as Point;
    const point = interpolate(from, to, 1.5)[0]?.points[0] as Point;
    expect(point.x).toBeCloseTo(start.x + (end.x - start.x) * 1.5, 12);
  });

  it("rejects a non-finite progress", () => {
    expect(() => interpolate(from, to, Number.NaN)).toThrow(RangeError);
    expect(() => interpolate(from, to, Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });
});

describe("interpolate - endpoints on real icons", () => {
  it("reproduces every `to` outline at progress 1 and every `from` outline at progress 0", () => {
    for (const [from, to] of ALL_PAIRS) {
      const start = interpolate(from, to, 0);
      const end = interpolate(from, to, 1);
      for (const target of to) {
        const output = end.find((c) => c.id === target.id) as Contour;
        // Resampling only inserts points on edges, so every original vertex is present, in
        // cyclic order, at its exact position.
        const kept = output.points.filter((p) =>
          target.points.some((q) => q.x === p.x && q.y === p.y),
        );
        expect(isRotationOf(kept, target.points)).toBe(true);
      }
      for (const source of from) {
        const hasPoint = (p: Point) =>
          start.some((c) => c.points.some((q) => q.x === p.x && q.y === p.y));
        expect(source.points.every(hasPoint)).toBe(true);
      }
    }
  });

  it("starts each output contour at its `from` partner's own start (the rotation goes on `to`)", () => {
    const [outer] = interpolate(ICONS.regularHeart, ICONS.solidHeart, 0);
    expect(outer?.points[0]).toEqual(ICONS.regularHeart[0]?.points[0]);
  });
});

describe("interpolate - output tree", () => {
  it("is `to`'s tree plus the disappearing contours, the same at every progress", () => {
    for (const [from, to] of ALL_PAIRS) {
      const trees = [0, 0.3, 1].map((p) =>
        structureOf(interpolate(from, to, p)),
      );
      expect(trees[1]).toEqual(trees[0]);
      expect(trees[2]).toEqual(trees[0]);
      expect(trees[0]?.slice(0, to.length)).toEqual(structureOf(to));
    }
  });

  it("is coherent: unique ids, every parentId resolves one depth up, holes alternate", () => {
    for (const [from, to] of ALL_PAIRS) {
      const output = interpolate(from, to, 0.5);
      const byId = new Map(output.map((c) => [c.id, c]));
      expect(byId.size).toBe(output.length);
      for (const c of output) {
        expect(c.isHole).toBe(c.depth % 2 === 1);
        if (c.parentId === null) {
          expect(c.depth).toBe(0);
          continue;
        }
        const parent = byId.get(c.parentId);
        expect(parent?.depth).toBe(c.depth - 1);
      }
    }
  });

  it("renames a disappearing contour whose id `to` already uses, and keeps its parent link", () => {
    // Bullseye (c0 outer, c1 hole, c2 dot) → solid circle (c0): c1 and c2 disappear.
    const output = interpolate(ICONS.bullseye, ICONS.solidCircle, 0.5);
    expect(structureOf(output)).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
      { id: "c2", parentId: "c1", isHole: false, depth: 2 },
    ]);

    // Two holes → ring: one hole is matched, the other disappears inside the ring's outline.
    // FA Regular circle is drawn hole first, so its hole is c0 and its outline c1.
    const ring = interpolate(ICONS.twoHoles, ICONS.regularCircle, 0.5);
    const ids = ring.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ring.slice(2).map((c) => [c.isHole, c.parentId])).toEqual([
      [true, "c1"],
    ]);

    // "c1" disappears and collides with the ring outline's id, so it's suffixed.
    const suffixed = interpolate(
      [
        contour("x", null, 0, rectangle(0, 0, 50, 50)),
        contour("c9", "x", 1, rectangle(5, 5, 5, 5)),
        contour("c1", "x", 1, rectangle(30, 30, 5, 5)),
      ],
      ICONS.regularCircle,
      0.5,
    );
    expect(suffixed.map((c) => c.id)).toEqual(["c0", "c1", "c1~1"]);
  });

  it("accepts its own output back as `from` (a mid-flight snapshot)", () => {
    const snapshot = interpolate(ICONS.bullseye, ICONS.solidHeart, 0.4);
    const next = interpolate(snapshot, ICONS.twoHoles, 0);
    // At progress 0 the new leg is the snapshot's own geometry.
    for (const c of snapshot) {
      const out = next.find((o) =>
        o.points.some((p) => p.x === c.points[0]?.x && p.y === c.points[0]?.y),
      );
      expect(out).toBeDefined();
    }
    expect(() => interpolate(snapshot, ICONS.twoHoles, 0.5)).not.toThrow();
  });

  it("handles empty sides", () => {
    expect(interpolate([], [], 0.5)).toEqual([]);
    expect(interpolate([], ICONS.solidCircle, 1)[0]?.points).toHaveLength(
      ICONS.solidCircle[0]?.points.length as number,
    );
  });
});

describe("interpolate - graceful degradation (deliverable #2)", () => {
  const liveCentroid = (output: readonly Contour[], id: string): Point =>
    centroidOf((output.find((c) => c.id === id) as Contour).points);
  const pairOf = (from: Contour[], to: Contour[], id: string) =>
    correspondContours(from, to).find(
      (pair) => pair.id === id,
    ) as ContourCorrespondence;

  it("grows an appearing hole from its partnered parent's live centroid (0 holes → 1)", () => {
    const hole = ICONS.regularCircle.find((c) => c.isHole) as Contour;
    const outlineId = hole.parentId as string;
    const pair = pairOf(ICONS.solidCircle, ICONS.regularCircle, hole.id);
    expect(pair.anchor).toEqual({
      placeholderSide: "from",
      ancestorId: outlineId,
    });
    for (const progress of [0, 0.3, 0.6]) {
      const output = interpolate(
        ICONS.solidCircle,
        ICONS.regularCircle,
        progress,
      );
      const center = liveCentroid(output, outlineId);
      const grown = output.find((c) => c.id === hole.id) as Contour;
      grown.points.forEach((point, index) => {
        const end = pair.toPoints[index] as Point;
        expect(point.x).toBeCloseTo(
          center.x * (1 - progress) + end.x * progress,
          12,
        );
        expect(point.y).toBeCloseTo(
          center.y * (1 - progress) + end.y * progress,
          12,
        );
      });
    }
  });

  it("collapses a disappearing hole toward its partnered parent's live centroid", () => {
    const hole = ICONS.regularHeart.find((c) => c.isHole) as Contour;
    const pair = pairOf(ICONS.regularHeart, ICONS.solidHeart, hole.id);
    const outlineId = ICONS.solidHeart[0]?.id as string;
    expect(pair.anchor).toEqual({
      placeholderSide: "to",
      ancestorId: outlineId,
    });
    for (const progress of [0.5, 1]) {
      const output = interpolate(
        ICONS.regularHeart,
        ICONS.solidHeart,
        progress,
      );
      const center = liveCentroid(output, outlineId);
      const collapsing = output.find((c) => c.id === hole.id) as Contour;
      expect(collapsing.points).toHaveLength(pair.fromPoints.length);
      collapsing.points.forEach((point, index) => {
        const start = pair.fromPoints[index] as Point;
        expect(point.x).toBeCloseTo(
          start.x * (1 - progress) + center.x * progress,
          12,
        );
        expect(point.y).toBeCloseTo(
          start.y * (1 - progress) + center.y * progress,
          12,
        );
      });
    }
  });

  it("walks past an unmatched parent: a dot in a vanishing hole tracks the grandparent's live centroid", () => {
    // Outline → hole → dot on the left; a lone outline on the right. The outlines match, so the
    // hole (parent matched) and the dot (parent unmatched, grandparent matched) both anchor to
    // the moving outline, and collapse together onto its live centroid.
    const from = [
      contour("outline", null, 0, rectangle(0, 0, 40, 40)),
      contour("hole", "outline", 1, [...rectangle(5, 5, 30, 30)].reverse()),
      contour("dot", "hole", 2, rectangle(8, 25, 6, 6)),
    ];
    const to = [contour("target", null, 0, rectangle(50, 55, 40, 30))];
    const dotPair = pairOf(from, to, "dot");
    expect(dotPair.anchor).toEqual({
      placeholderSide: "to",
      ancestorId: "target",
    });
    expect(pairOf(from, to, "hole").anchor).toEqual({
      placeholderSide: "to",
      ancestorId: "target",
    });

    const centers: Point[] = [];
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      const output = interpolate(from, to, progress);
      const center = liveCentroid(output, "target");
      centers.push(center);
      const dot = output.find((c) => c.id === "dot") as Contour;
      dot.points.forEach((point, index) => {
        const start = dotPair.fromPoints[index] as Point;
        expect(point.x).toBeCloseTo(
          start.x * (1 - progress) + center.x * progress,
          12,
        );
        expect(point.y).toBeCloseTo(
          start.y * (1 - progress) + center.y * progress,
          12,
        );
      });
    }
    // The target point really moves with the outline, from (20, 20) toward (70, 70); it isn't
    // one value computed once.
    expect(centers.map((c) => c.x)).toEqual(
      [32.5, 45, 57.5, 70].map((x) => expect.closeTo(x, 9)),
    );
    expect(centers.map((c) => c.y)).toEqual(
      [32.5, 45, 57.5, 70].map((y) => expect.closeTo(y, 9)),
    );
    // Hole and dot end on the same point, the outline's final centroid.
    const end = interpolate(from, to, 1);
    for (const id of ["hole", "dot"]) {
      for (const point of (end.find((c) => c.id === id) as Contour).points) {
        expect(point.x).toBeCloseTo(70, 9);
        expect(point.y).toBeCloseTo(70, 9);
      }
    }
  });

  it("falls back to a contour's own fixed centroid when no ancestor has a partner", () => {
    // Two outlines → one: the right outline and its hole have no partnered ancestor.
    const from = [
      contour("left", null, 0, rectangle(0, 0, 30, 30)),
      contour("right", null, 0, rectangle(60, 0, 30, 30)),
      contour(
        "right-hole",
        "right",
        1,
        [...rectangle(62, 2, 10, 10)].reverse(),
      ),
    ];
    const to = [contour("t", null, 0, rectangle(10, 60, 30, 30))];
    const holePair = pairOf(from, to, "right-hole");
    expect(holePair.anchor).toBeNull();
    expect(pairOf(from, to, "right").anchor).toBeNull();
    for (const progress of [0.5, 1]) {
      const hole = interpolate(from, to, progress).find(
        (c) => c.id === "right-hole",
      ) as Contour;
      hole.points.forEach((point, index) => {
        const start = holePair.fromPoints[index] as Point;
        expect(point.x).toBeCloseTo(
          start.x * (1 - progress) + 67 * progress,
          12,
        );
        expect(point.y).toBeCloseTo(
          start.y * (1 - progress) + 7 * progress,
          12,
        );
      });
    }
  });

  it("leaves matched contours without an anchor", () => {
    for (const pair of correspondContours(
      ICONS.regularHeart,
      ICONS.solidHeart,
    )) {
      if (pair.id === ICONS.solidHeart[0]?.id) expect(pair.anchor).toBeNull();
    }
  });

  it("pairs equal-length point arrays with finite coordinates", () => {
    // That every vertex of both sides is among them is the endpoint test's job, above.
    for (const [from, to] of ALL_PAIRS) {
      for (const pair of correspondContours(from, to)) {
        expect(pair.toPoints).toHaveLength(pair.fromPoints.length);
      }
      for (const c of interpolate(from, to, 0.37)) {
        for (const p of c.points)
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });
});
