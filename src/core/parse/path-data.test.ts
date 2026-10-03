import { describe, expect, it } from "vitest";
import { PathDataSyntaxError, parsePathData } from "./path-data";

describe("parsePathData - commands", () => {
  it("resolves absolute and relative lines, H and V into absolute line segments", () => {
    const [subpath] = parsePathData("M10 10 L20 10 l0 10 H5 h-2 V3 v1 Z");
    expect(subpath?.start).toEqual({ x: 10, y: 10 });
    expect(subpath?.segments.map((segment) => segment.to)).toEqual([
      { x: 20, y: 10 },
      { x: 20, y: 20 },
      { x: 5, y: 20 },
      { x: 3, y: 20 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ]);
    expect(subpath?.hasClosePath).toBe(true);
  });

  it("treats extra coordinate pairs after a move-to as line-tos", () => {
    const [subpath] = parsePathData("m1 1 2 0 0 2z");
    expect(subpath?.start).toEqual({ x: 1, y: 1 });
    expect(subpath?.segments).toEqual([
      { kind: "line", to: { x: 3, y: 1 } },
      { kind: "line", to: { x: 3, y: 3 } },
    ]);
  });

  it("repeats a command for each additional parameter group", () => {
    const [subpath] = parsePathData("M0 0 C1 1 2 2 3 3 4 4 5 5 6 6Z");
    expect(subpath?.segments).toHaveLength(2);
    expect(subpath?.segments[1]).toEqual({
      kind: "cubic",
      ctrl1: { x: 4, y: 4 },
      ctrl2: { x: 5, y: 5 },
      to: { x: 6, y: 6 },
    });
  });

  it("reflects the previous cubic control point for S, and uses the current point otherwise", () => {
    const [afterCubic] = parsePathData("M0 0 C0 10 10 10 10 0 S20 -10 20 0Z");
    expect(afterCubic?.segments[1]).toMatchObject({
      kind: "cubic",
      ctrl1: { x: 10, y: -10 },
    });
    const [alone] = parsePathData("M0 0 S20 -10 20 0Z");
    expect(alone?.segments[0]).toMatchObject({
      kind: "cubic",
      ctrl1: { x: 0, y: 0 },
    });
  });

  it("reflects the previous quadratic control point for T, chaining through T itself", () => {
    const [subpath] = parsePathData("M0 0 Q5 10 10 0 T20 0 T30 0Z");
    expect(subpath?.segments[1]).toMatchObject({
      kind: "quadratic",
      ctrl: { x: 15, y: -10 },
    });
    expect(subpath?.segments[2]).toMatchObject({
      kind: "quadratic",
      ctrl: { x: 25, y: 10 },
    });
  });

  it("parses arcs, including compact flags with no separators", () => {
    const [subpath] = parsePathData("M0 0a5 5 0 1010 0Z");
    expect(subpath?.segments[0]).toEqual({
      kind: "arc",
      rx: 5,
      ry: 5,
      xAxisRotation: 0,
      isLargeArc: true,
      isSweep: false,
      to: { x: 10, y: 0 },
    });
  });

  it("takes the absolute value of negative arc radii, per the SVG spec", () => {
    const [subpath] = parsePathData("M0 0A-5 -3 0 0 1 10 0Z");
    expect(subpath?.segments[0]).toMatchObject({ rx: 5, ry: 3 });
  });
});

describe("parsePathData - number syntax", () => {
  it("handles compressed numbers: '.5.5', '1-2', and exponents", () => {
    const [subpath] = parsePathData("M.5.5L1-2L1e1,2E-1Z");
    expect(subpath?.start).toEqual({ x: 0.5, y: 0.5 });
    expect(subpath?.segments.map((segment) => segment.to)).toEqual([
      { x: 1, y: -2 },
      { x: 10, y: 0.2 },
    ]);
  });

  it("allows commas and any whitespace between parameters", () => {
    expect(parsePathData("M 1 , 2\n\tL3,4 Z")[0]?.segments[0]?.to).toEqual({
      x: 3,
      y: 4,
    });
  });
});

describe("parsePathData - subpaths", () => {
  it("starts a new subpath at each move-to, relative to the closed subpath's start", () => {
    const subpaths = parsePathData("M10 10 h5 v5 z m2 2 h1 v1 z");
    expect(subpaths).toHaveLength(2);
    expect(subpaths[1]?.start).toEqual({ x: 12, y: 12 });
  });

  it("starts a new subpath at the closed one's start when a drawing command follows Z", () => {
    const subpaths = parsePathData("M10 10 h5 v5 z l-5 0 0 -5 z");
    expect(subpaths).toHaveLength(2);
    expect(subpaths[1]?.start).toEqual({ x: 10, y: 10 });
    expect(subpaths[1]?.segments[0]?.to).toEqual({ x: 5, y: 10 });
  });

  it("records whether each subpath ended with Z", () => {
    expect(
      parsePathData("M0 0 L1 0 L1 1 M5 5 L6 5 L6 6 Z").map(
        (s) => s.hasClosePath,
      ),
    ).toEqual([false, true]);
  });

  it("drops a lone move-to that draws nothing", () => {
    expect(parsePathData("M0 0 M1 1 L2 1 L2 2 Z")).toHaveLength(1);
  });

  it("keeps 'M x y Z' as an empty closed subpath, so it can be rejected as degenerate", () => {
    expect(parsePathData("M3 3 Z")).toEqual([
      { start: { x: 3, y: 3 }, segments: [], hasClosePath: true },
    ]);
  });
});

describe("parsePathData - malformed input", () => {
  const malformed: [string, string][] = [
    ["empty data", "   "],
    ["data not starting with a move-to", "L0 0 Z"],
    ["data starting with a number", "0 0 L1 1"],
    ["an unknown command", "M0 0 X1 1"],
    ["a command with too few parameters", "M0 0 L1"],
    ["a cubic missing a coordinate", "M0 0 C1 1 2 2 3 Z"],
    ["an arc flag that isn't 0 or 1", "M0 0 A5 5 0 2 0 10 0"],
    ["a stray character", "M0 0 L1 1 # Z"],
    ["a doubled comma", "M0,,0"],
    ["a number after Z", "M0 0 L1 0 L1 1 Z 5"],
    ["a number that overflows", "M0 0 L1e999 0"],
    ["a comma right after a command letter", "M,0 0"],
  ];

  it.each(malformed)("throws PathDataSyntaxError for %s", (_label, d) => {
    expect(() => parsePathData(d)).toThrow(PathDataSyntaxError);
  });

  it("reports the character offset of the problem", () => {
    try {
      parsePathData("M0 0 L1 1 # Z");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PathDataSyntaxError);
      expect((error as PathDataSyntaxError).offset).toBe(10);
    }
  });
});
