import { mkdirSync, writeFileSync } from "node:fs";
import { interpolate } from "fillmorph";
import { FIXTURE_NAMES, loadFixture } from "./fixtures.ts";
import { renderFrameGridPage } from "./frame-grid.ts";
import { DEFAULT_PROGRESS_STEPS, DENSE_PROGRESS_STEPS } from "./frames.ts";
import { findPair, REFERENCE_PAIRS, type ReferencePair } from "./pairs.ts";
import { renderPlaybackPage } from "./playback/playback-page.ts";
import { runPairPlayback } from "./playback/run-pair-playback.ts";
import { renderRoundTripPage, runRoundTrip } from "./round-trip.ts";
import { runPair } from "./run-pair.ts";

const USAGE = `Usage: pnpm harness [options] [<pair-name> ...]

Frame grid + geometry checks (deliverables #4–#6):
  <pair-name> ...     run the named reference pairs
  --all               run every reference pair
  --dense             sample 11 frames (0, 0.1, …, 1) instead of 5
  --steps a,b,c       sample these progress values instead

Other modes (can be combined with the above):
  --round-trip        spec 02's static round-trip check on every fixture
  --playback          real-time playback harness (deliverable #7) on the selected pairs
  --list              list the reference pairs

Pages are written to harness/output/. Exit code 1 if any check fails.

The frame grid's MorphFn is spec 04's interpolate. Playback runs spec 05's startMorph /
advanceMorph / retargetMorph, the same core functions fillmorph/dom's driver runs.`;

const OUTPUT_DIRECTORY = `${import.meta.dirname}/output`;

function writeOutput(fileName: string, html: string): string {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const path = `${OUTPUT_DIRECTORY}/${fileName}`;
  writeFileSync(path, html);
  return path;
}

function parseSteps(value: string | undefined): number[] {
  const parts = (value ?? "").split(",").map((part) => part.trim());
  const steps = parts.map(Number);
  if (parts.some((part) => part === "") || steps.some((step) => !Number.isFinite(step))) {
    throw new Error(`--steps needs comma-separated numbers, got "${value ?? ""}"`);
  }
  return steps;
}

function main(args: readonly string[]): number {
  if (args.length === 0 || args.includes("--help")) {
    console.log(USAGE);
    return args.length === 0 ? 1 : 0;
  }
  if (args.includes("--list")) {
    for (const pair of REFERENCE_PAIRS) console.log(`${pair.name}  (${pair.covers})`);
    return 0;
  }

  let progressSteps: readonly number[] = DEFAULT_PROGRESS_STEPS;
  const pairs: ReferencePair[] = [];
  let isRoundTrip = false;
  let isPlayback = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] as string;
    if (arg === "--all") pairs.push(...REFERENCE_PAIRS);
    else if (arg === "--dense") progressSteps = DENSE_PROGRESS_STEPS;
    else if (arg === "--steps") progressSteps = parseSteps(args[++index]);
    else if (arg === "--round-trip") isRoundTrip = true;
    else if (arg === "--playback") isPlayback = true;
    else {
      const pair = findPair(arg);
      if (pair === undefined) {
        console.error(`Unknown pair or option "${arg}". Run with --list to see pair names.`);
        return 1;
      }
      pairs.push(pair);
    }
  }
  const selected = [...new Set(pairs)];
  let isFailing = false;

  if (isRoundTrip) {
    const results = FIXTURE_NAMES.map((name) => runRoundTrip(name, loadFixture(name)));
    for (const result of results) {
      console.log(`${result.passed ? "PASS" : "FAIL"}  round-trip  ${result.name}`);
      for (const problem of result.problems) console.log(`      ${problem}`);
    }
    isFailing ||= results.some((result) => !result.passed);
    console.log(`→ ${writeOutput("round-trip.html", renderRoundTripPage(results))}`);
  }

  if (selected.length > 0) {
    const runs = selected.map((pair) => runPair(pair, interpolate, progressSteps));
    for (const run of runs) {
      const summary = run.checks
        .map((check) => `${check.check} ${check.passed ? "ok" : `FAIL(${check.failures.length})`}`)
        .join(", ");
      console.log(`${run.passed ? "PASS" : "FAIL"}  ${run.pair.name}: ${summary}`);
    }
    isFailing ||= runs.some((run) => !run.passed);
    console.log(
      `→ ${writeOutput("frame-grid.html", renderFrameGridPage(runs, "interpolate (spec 04)"))}`,
    );
  }

  if (isPlayback) {
    const playbackPairs = selected.length > 0 ? selected : REFERENCE_PAIRS;
    const sections = playbackPairs.map((pair) =>
      runPairPlayback(pair, {
        // fillmorph/dom's default config (not importable here: the harness grades core only).
        base: { stiffness: 170, damping: 26, mass: 1 },
      }),
    );
    for (const section of sections) {
      const summary = section.checks
        .map((check) => `${check.check} ${check.passed ? "ok" : `FAIL(${check.failures.length})`}`)
        .join(", ");
      const passed = section.checks.every((check) => check.passed);
      console.log(`${passed ? "PASS" : "FAIL"}  playback ${section.title}: ${summary}`);
      isFailing ||= !passed;
    }
    const lede =
      "Playback runs spec 05's startMorph / advanceMorph / retargetMorph — the same core code fillmorph/dom's createMorphDriver runs — on a simulated 60 Hz clock. " +
      "Each pair is interrupted mid-flight and retargeted to a third icon; the playback replays the recorded simulated frames.";
    console.log(`→ ${writeOutput("playback.html", renderPlaybackPage(sections, lede))}`);
  }

  return isFailing ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
