import { type Contour, interpolate, parseIcon, type Point } from "fillmorph";
import { describe, expect, it } from "vitest";
import { loadFixture } from "./fixtures.ts";
import { distanceToSegment } from "./geometry.ts";
import { REFERENCE_PAIRS } from "./pairs.ts";

/**
 * The bound on how far a morph's first and last frames may stray from the parsed icons, in
 * canonical units (out of 100).
 *
 * Spec 07 pairs points by arc-length position at the union of both outlines' vertex fractions, so
 * every parsed vertex is kept at its exact coordinates and every added point is computed on a
 * parsed edge. The only error left is floating-point rounding on those added points, around 1e-14
 * here. 1e-9 leaves room for that and is still about seven orders of magnitude below spec 02's
 * per-contour flattening tolerance (0.001 × the contour's size, 0.013 units for the smallest
 * fixture contour), the error parsing already accepts. Any real corner cutting, such as uniform
 * resampling's (measured at up to 1.2 units on these fixtures), fails it.
 */
const ENDPOINT_BOUND = 1e-9;

function distanceToOutline(point: Point, polygon: readonly Point[]): number {
  return Math.min(
    ...polygon.map((a, index) =>
      distanceToSegment(point, a, polygon[(index + 1) % polygon.length] as Point),
    ),
  );
}

/** Symmetric: every point of each outline measured against the other outline. */
function deviation(output: readonly Point[], parsed: readonly Point[]): number {
  return Math.max(
    ...output.map((point) => distanceToOutline(point, parsed)),
    ...parsed.map((point) => distanceToOutline(point, output)),
  );
}

const contoursOf = (name: Parameters<typeof loadFixture>[0]): Contour[] =>
  parseIcon(loadFixture(name)).contours;

describe("endpoint frames match the parsed icons (spec 07 deliverable #2)", () => {
  // Every reference pair, plus each pair's playback retarget, as fresh morphs.
  const morphs = REFERENCE_PAIRS.flatMap((pair) => [
    [pair.from, pair.to],
    [pair.from, pair.interruptTo],
  ]) as [Parameters<typeof loadFixture>[0], Parameters<typeof loadFixture>[0]][];

  it.each(morphs)("%s → %s", (fromName, toName) => {
    const from = contoursOf(fromName);
    const to = contoursOf(toName);
    const first = interpolate(from, to, 0);
    const last = interpolate(from, to, 1);

    // Last frame: each `to` contour keeps its id.
    for (const target of to) {
      const output = last.find((contour) => contour.id === target.id) as Contour;
      expect(deviation(output.points, target.points)).toBeLessThanOrEqual(ENDPOINT_BOUND);
    }
    // First frame: output ids are `to`'s, but each output contour starts at its `from` partner's
    // point 0, exactly.
    for (const source of from) {
      const start = source.points[0] as Point;
      const output = first.find(
        (contour) => contour.points[0]?.x === start.x && contour.points[0]?.y === start.y,
      );
      expect(output).toBeDefined();
      expect(deviation((output as Contour).points, source.points)).toBeLessThanOrEqual(
        ENDPOINT_BOUND,
      );
    }
  });
});
