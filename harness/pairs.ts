import type { FixtureName } from "./fixtures.ts";

/** One morph the harness grades: `from` → `to`, plus the third icon a playback run retargets to. */
export type ReferencePair = {
  /** Stable name used on the command line (`pnpm harness <name>`). */
  name: string;
  /** Which required case from spec 03 deliverable #3 this pair covers. */
  covers: string;
  from: FixtureName;
  to: FixtureName;
  /** Target of deliverable #7's scripted mid-flight interruption. */
  interruptTo: FixtureName;
};

/**
 * The reference pair set every geometry and timing spec is graded against (spec 03 deliverable
 * #3). All icons are real Font Awesome Free 6.7.2 files; see `fixtures.ts`.
 */
export const REFERENCE_PAIRS: readonly ReferencePair[] = [
  {
    name: "solid-heart-to-solid-circle",
    covers: "solid → solid, different icons",
    from: "fa-solid-heart",
    to: "fa-solid-circle",
    interruptTo: "fa-solid-b",
  },
  {
    name: "regular-heart-to-solid-heart",
    covers: "filled outline → solid, same icon (FA Regular → FA Solid)",
    from: "fa-regular-heart",
    to: "fa-solid-heart",
    interruptTo: "fa-regular-circle",
  },
  {
    name: "solid-circle-to-regular-circle",
    covers: "hole-count mismatch: 0 holes → 1 hole",
    from: "fa-solid-circle",
    to: "fa-regular-circle",
    interruptTo: "fa-solid-heart",
  },
  {
    name: "solid-b-to-solid-circle",
    covers: "hole-count mismatch: 2 sibling holes → 0 holes",
    from: "fa-solid-b",
    to: "fa-solid-circle",
    interruptTo: "fa-regular-heart",
  },
  {
    name: "regular-circle-dot-to-solid-heart",
    covers: "nested: depth 0/1/2 (outer, hole, inner dot) → solid",
    from: "fa-regular-circle-dot",
    to: "fa-solid-heart",
    interruptTo: "fa-solid-b",
  },
];

export function findPair(name: string): ReferencePair | undefined {
  return REFERENCE_PAIRS.find((pair) => pair.name === name);
}
