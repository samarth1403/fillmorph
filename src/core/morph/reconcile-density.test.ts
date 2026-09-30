import { describe, expect, it } from "vitest";
import {
  MAX_SHARED_POINT_COUNT,
  MIN_SHARED_POINT_COUNT,
  sharedPointCount,
} from "./reconcile-density";

describe("sharedPointCount", () => {
  it("takes whichever side has more points", () => {
    expect(sharedPointCount(40, 87)).toBe(87);
    expect(sharedPointCount(87, 40)).toBe(87);
  });

  it("clamps to the floor and the ceiling", () => {
    expect(sharedPointCount(4, 3)).toBe(MIN_SHARED_POINT_COUNT);
    expect(sharedPointCount(5000, 3)).toBe(MAX_SHARED_POINT_COUNT);
  });
});
