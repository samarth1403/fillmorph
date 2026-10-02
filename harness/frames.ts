import type { Contour } from "fillmorph";
import { formatNumber } from "./geometry.ts";
import type { MorphFn } from "./morph-fn.ts";

/** One rendered moment of a morph, as the geometry checks see it. */
export type Frame = {
  progress: number;
  contours: Contour[];
  /** How reports refer to this frame, e.g. `p=0.25` or `t=0.250s p=0.41 (leg 2)`. */
  label: string;
  /**
   * Playback only: the frame comes after its leg arrived (spring first reached 1), so spec 05
   * draws it as the leg's target, popped, whatever its position. Ordered after the morph's own
   * frames, and a hole may leave the sequence there.
   */
  isOnTarget?: boolean;
};

/** The quick-pass default: 5 frames. */
export const DEFAULT_PROGRESS_STEPS: readonly number[] = [0, 0.25, 0.5, 0.75, 1];

/** The close-scrutiny set: 11 frames at 0.1 steps. */
export const DENSE_PROGRESS_STEPS: readonly number[] = Array.from(
  { length: 11 },
  (_, index) => index / 10,
);

/** Evaluates `morph` at each progress value, in the order given. */
export function sampleFrames(
  morph: MorphFn,
  from: Contour[],
  to: Contour[],
  progressSteps: readonly number[],
): Frame[] {
  return progressSteps.map((progress) => ({
    progress,
    contours: morph(from, to, progress),
    label: `p=${formatNumber(progress)}`,
  }));
}
