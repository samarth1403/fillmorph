export type CheckName =
  | "self-intersection"
  | "hole-monotonic"
  | "containment"
  | "settling"
  | "velocity-continuity"
  | "position-continuity";

/** One thing a check found wrong. */
export type CheckFailure = {
  /** Indices (into the checked frame sequence) of the frames this failure is about. */
  frameIndices: number[];
  /** The contour at fault, when there is one. */
  contourId: string | null;
  message: string;
};

/** The outcome of one automated pass/fail gate. */
export type CheckResult = {
  check: CheckName;
  passed: boolean;
  failures: CheckFailure[];
  /** Informational lines that aren't failures (e.g. what a check deliberately didn't gate). */
  notes: string[];
};

export function checkResult(
  check: CheckName,
  failures: CheckFailure[],
  notes: string[] = [],
): CheckResult {
  return { check, passed: failures.length === 0, failures, notes };
}
