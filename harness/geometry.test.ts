import { describe, expect, it } from "vitest";
import { isInsideOrOnPolygon, polygonArea, segmentsCross } from "./geometry.ts";

const p = (x: number, y: number) => ({ x, y });
const squarePoints = [p(0, 0), p(0, 10), p(10, 10), p(10, 0)];

describe("segmentsCross", () => {
  it("is true for two segments crossing in their interiors", () => {
    expect(segmentsCross(p(0, 0), p(10, 10), p(0, 10), p(10, 0))).toBe(true);
  });

  it("is false for touching, shared endpoints, collinear overlap and zero-length segments", () => {
    expect(segmentsCross(p(0, 0), p(10, 0), p(5, 0), p(5, 10))).toBe(false);
    expect(segmentsCross(p(0, 0), p(10, 0), p(10, 0), p(10, 10))).toBe(false);
    expect(segmentsCross(p(0, 0), p(10, 0), p(5, 0), p(15, 0))).toBe(false);
    expect(segmentsCross(p(5, 5), p(5, 5), p(0, 0), p(10, 10))).toBe(false);
  });

  it("is false for disjoint segments", () => {
    expect(segmentsCross(p(0, 0), p(1, 1), p(5, 0), p(6, 1))).toBe(false);
  });
});

describe("isInsideOrOnPolygon", () => {
  it("counts inside and on-the-outline points as inside, outside points as outside", () => {
    expect(isInsideOrOnPolygon(p(5, 5), squarePoints, 1e-9)).toBe(true);
    expect(isInsideOrOnPolygon(p(0, 5), squarePoints, 1e-9)).toBe(true);
    expect(isInsideOrOnPolygon(p(10, 10), squarePoints, 1e-9)).toBe(true);
    expect(isInsideOrOnPolygon(p(10.01, 5), squarePoints, 1e-9)).toBe(false);
  });
});

describe("polygonArea", () => {
  it("is unsigned, whichever way the polygon winds", () => {
    expect(polygonArea(squarePoints)).toBe(100);
    expect(polygonArea([...squarePoints].reverse())).toBe(100);
  });
});
