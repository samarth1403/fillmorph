import { describe, expect, it } from "vitest";
import { canonicalViewBoxAttribute } from "./display.ts";
import { renderFrameGridPage } from "./frame-grid.ts";
import { DEFAULT_PROGRESS_STEPS, DENSE_PROGRESS_STEPS } from "./frames.ts";
import { naiveMorph } from "./morph-fn.ts";
import { REFERENCE_PAIRS } from "./pairs.ts";
import { runPair } from "./run-pair.ts";

describe("runPair + renderFrameGridPage on the stub MorphFn", () => {
  const runs = REFERENCE_PAIRS.map((pair) => runPair(pair, naiveMorph, DEFAULT_PROGRESS_STEPS));

  it("completes on the full reference pair set, running all three checks per pair", () => {
    expect(runs).toHaveLength(REFERENCE_PAIRS.length);
    for (const run of runs) {
      expect(run.frames.map((frame) => frame.progress)).toEqual(DEFAULT_PROGRESS_STEPS);
      expect(run.checks.map((check) => check.check)).toEqual([
        "self-intersection",
        "hole-monotonic",
        "containment",
      ]);
    }
  });

  it("catches the stub's bad output on at least one pair", () => {
    expect(runs.some((run) => !run.passed)).toBe(true);
  });

  it("produces one viewable grid section per pair, one canonical-frame SVG per frame", () => {
    const html = renderFrameGridPage(runs, "naiveMorph");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    for (const pair of REFERENCE_PAIRS) expect(html).toContain(pair.name);
    const svgCount = html.match(/<svg /g)?.length;
    expect(svgCount).toBe(REFERENCE_PAIRS.length * DEFAULT_PROGRESS_STEPS.length);
    expect(html.match(new RegExp(`viewBox="${canonicalViewBoxAttribute()}"`, "g"))?.length).toBe(
      svgCount,
    );
  });

  it("uses no external resources (dependency-free page)", () => {
    const html = renderFrameGridPage(runs, "naiveMorph");
    expect(html).not.toMatch(/<script|<link|src="http/);
  });

  it("marks frames implicated by a failure", () => {
    const failing = runs.filter((run) => !run.passed);
    expect(renderFrameGridPage(failing, "naiveMorph")).toContain('class="tile flagged"');
  });

  it("samples whichever progress steps it's given", () => {
    const [pair] = REFERENCE_PAIRS;
    if (pair === undefined) throw new Error("no reference pairs");
    expect(runPair(pair, naiveMorph, DENSE_PROGRESS_STEPS).frames).toHaveLength(11);
    expect(runPair(pair, naiveMorph, [0.5]).frames.map((frame) => frame.label)).toEqual(["p=0.5"]);
  });
});
