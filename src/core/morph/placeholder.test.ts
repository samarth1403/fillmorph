import { describe, expect, it } from "vitest";
import { collapsedPartner } from "./placeholder";
import { rectangle } from "./test-helpers";

describe("collapsedPartner", () => {
  it("puts one point per input point at the contour's own area centroid", () => {
    const points = rectangle(10, 20, 30, 40);
    const partner = collapsedPartner(points);
    expect(partner).toHaveLength(points.length);
    for (const point of partner) expect(point).toEqual({ x: 25, y: 40 });
  });

  it("returns fresh point objects and leaves the input untouched", () => {
    const points = rectangle(0, 0, 2, 2);
    const snapshot = points.map((point) => ({ ...point }));
    const partner = collapsedPartner(points);
    partner[0] = { x: -1, y: -1 };
    expect(partner[1]).not.toBe(partner[2]);
    expect(points).toEqual(snapshot);
  });
});
