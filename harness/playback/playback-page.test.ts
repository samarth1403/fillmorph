import { renderContours } from "fillmorph";
import { describe, expect, it } from "vitest";
import { canonicalViewBoxAttribute } from "../display.ts";
import { naiveMorph } from "../morph-fn.ts";
import { findPair, REFERENCE_PAIRS } from "../pairs.ts";
import { square } from "../test-shapes.ts";
import { renderPlaybackPage } from "./playback-page.ts";
import { runPairPlayback } from "./run-pair-playback.ts";
import { runPlayback } from "./runner.ts";
import { dampedStubStep } from "./stub-steps.ts";
import { checkTraceGeometry } from "./trace-geometry.ts";

function embeddedData(html: string, index: number): { frames: { t: number; d: string }[] } {
  const match = html.match(
    new RegExp(`<script type="application/json" id="playback-data-${index}">(.*?)</script>`, "s"),
  );
  if (match?.[1] === undefined) throw new Error("no embedded trace");
  return JSON.parse(match[1]);
}

describe("renderPlaybackPage", () => {
  const trace = runPlayback({
    step: dampedStubStep,
    config: { stiffness: 170, damping: 26, mass: 1 },
    morph: naiveMorph,
    from: [square("c0", null, 0, 30, 50, 10)],
    to: [square("c0", null, 0, 70, 50, 10)],
    duration: 1,
    interruption: { atTime: 0.2, to: [square("c0", null, 0, 50, 90, 10)] },
  });
  const html = renderPlaybackPage(
    [
      {
        title: "stub",
        subtitle: "stub trace",
        trace,
        checks: checkTraceGeometry(trace),
        tuning: null,
      },
    ],
    "stub",
  );

  it("embeds every recorded frame's path data and timestamp", () => {
    const data = embeddedData(html, 0);
    expect(data.frames.map((frame) => frame.t)).toEqual(trace.entries.map((entry) => entry.time));
    expect(data.frames.map((frame) => frame.d)).toEqual(
      trace.entries.map((entry) => renderContours(entry.contours)),
    );
  });

  it("replays with inline JavaScript only: no external scripts, stylesheets or network", () => {
    expect(html).not.toMatch(/<script[^>]+src=|<link|https?:\/\/(?!www\.w3\.org)/);
    expect(html).toContain("requestAnimationFrame");
  });

  it("draws in the canonical frame", () => {
    expect(html).toContain(`viewBox="${canonicalViewBoxAttribute()}"`);
  });
});

describe("runPairPlayback", () => {
  it("runs a reference pair end to end: auto-tune, interruption, and every check on the trace", () => {
    const pair = findPair("solid-heart-to-solid-circle") ?? REFERENCE_PAIRS[0];
    if (pair === undefined) throw new Error("no reference pairs");
    const section = runPairPlayback(pair, {
      step: dampedStubStep,
      morph: naiveMorph,
      base: { stiffness: 170, damping: 26, mass: 1 },
    });
    expect(section.trace.legs).toHaveLength(2);
    expect(section.checks.map((check) => check.check)).toEqual([
      "self-intersection",
      "hole-monotonic",
      "containment",
      "settling",
      "velocity-continuity",
    ]);
    expect(section.tuning?.config).not.toBeNull();
    expect(renderPlaybackPage([section], "stub")).toContain(pair.name);
  });
});
