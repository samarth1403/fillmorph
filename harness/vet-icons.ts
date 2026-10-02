import { type Contour, interpolate, parseIcon } from "fillmorph";
import { DENSE_PROGRESS_STEPS, sampleFrames } from "./frames.ts";
import type { MorphFn } from "./morph-fn.ts";
import { runGeometryChecks } from "./run-pair.ts";

/** An icon to vet: a name to report it by, and its full SVG markup. */
export type IconSource = { name: string; markup: string };

export type IconVetResult = {
  /** Icons that parse within the contract and pass the checks on their own. */
  usable: string[];
  /** Icons left out before pairing, with why. */
  rejected: { name: string; reason: string }[];
  /** Ordered pairs whose morph failed a check, with the checks it failed. */
  failingPairs: { from: string; to: string; checks: string[] }[];
  /** How many ordered pairs were morphed. */
  pairCount: number;
};

/** Spec 02 guarantees one level of nesting: an outline, its holes, and shapes inside those. */
const MAX_DEPTH = 2;

/**
 * Vets an icon set the way spec 08 §1b #8 requires of the demo's: each icon must parse with
 * `parseIcon`, nest at most `MAX_DEPTH` deep and pass deliverable #5's geometry checks on its own;
 * then every **ordered** pair of usable icons is morphed at `progressSteps` and must pass all three
 * checks. A set is clean when nothing is rejected and no pair fails.
 */
export function vetIcons(
  icons: readonly IconSource[],
  morph: MorphFn = interpolate,
  progressSteps: readonly number[] = DENSE_PROGRESS_STEPS,
): IconVetResult {
  const parsed = new Map<string, Contour[]>();
  const rejected: IconVetResult["rejected"] = [];
  for (const icon of icons) {
    let contours: Contour[];
    try {
      contours = parseIcon(icon.markup).contours;
    } catch (error) {
      const kind = error instanceof Error ? error.constructor.name : "error";
      rejected.push({ name: icon.name, reason: `${kind}: ${String((error as Error).message)}` });
      continue;
    }
    const depth = Math.max(...contours.map((contour) => contour.depth));
    if (depth > MAX_DEPTH) {
      rejected.push({ name: icon.name, reason: `nests ${depth} deep (at most ${MAX_DEPTH})` });
      continue;
    }
    const still = runGeometryChecks([{ progress: 0, contours, label: icon.name }]);
    const failed = still.filter((check) => !check.passed).map((check) => check.check);
    if (failed.length > 0) {
      rejected.push({ name: icon.name, reason: `fails on its own: ${failed.join(", ")}` });
      continue;
    }
    parsed.set(icon.name, contours);
  }

  const failingPairs: IconVetResult["failingPairs"] = [];
  let pairCount = 0;
  for (const [from, fromContours] of parsed) {
    for (const [to, toContours] of parsed) {
      if (from === to) continue;
      pairCount++;
      const frames = sampleFrames(morph, fromContours, toContours, progressSteps);
      const checks = runGeometryChecks(frames)
        .filter((check) => !check.passed)
        .map((check) => check.check);
      if (checks.length > 0) failingPairs.push({ from, to, checks });
    }
  }
  return { usable: [...parsed.keys()], rejected, failingPairs, pairCount };
}
