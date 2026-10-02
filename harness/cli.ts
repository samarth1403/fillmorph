import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { interpolate, type SpringConfig } from "fillmorph";
import { FIXTURE_NAMES, loadFixture } from "./fixtures.ts";
import { renderFrameGridPage } from "./frame-grid.ts";
import { DEFAULT_PROGRESS_STEPS, DENSE_PROGRESS_STEPS } from "./frames.ts";
import { findPair, REFERENCE_PAIRS, type ReferencePair } from "./pairs.ts";
import { renderPlaybackPage } from "./playback/playback-page.ts";
import { runPairPlayback } from "./playback/run-pair-playback.ts";
import { renderRoundTripPage, runRoundTrip } from "./round-trip.ts";
import { runPair } from "./run-pair.ts";
import { vetIcons } from "./vet-icons.ts";

const USAGE = `Usage: pnpm harness [options] [<pair-name> ...]

Frame grid + geometry checks (deliverables #4–#6):
  <pair-name> ...     run the named reference pairs
  --all               run every reference pair
  --dense             sample 11 frames (0, 0.1, …, 1) instead of 5
  --steps a,b,c       sample these progress values instead

Other modes (can be combined with the above):
  --round-trip        spec 02's static round-trip check on every fixture
  --playback          real-time playback harness (deliverable #7) on the selected pairs
  --spring k,c,m      play back with this fixed stiffness,damping,mass instead of auto-tuning
                      from fillmorph/dom's default (e.g. an overshooting preset)
  --list              list the reference pairs
  --vet-icons <dir>   vet every .svg in <dir> as one icon set (spec 08's demo rule): each parses
                      within the contract, and every ordered pair passes the geometry checks;
                      repeat the option to vet several sets

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

function parseNumbers(option: string, value: string | undefined): number[] {
  const parts = (value ?? "").split(",").map((part) => part.trim());
  const steps = parts.map(Number);
  if (parts.some((part) => part === "") || steps.some((step) => !Number.isFinite(step))) {
    throw new Error(`${option} needs comma-separated numbers, got "${value ?? ""}"`);
  }
  return steps;
}

function parseSpring(value: string | undefined): SpringConfig {
  const [stiffness, damping, mass, ...rest] = parseNumbers("--spring", value);
  if (stiffness === undefined || damping === undefined || mass === undefined || rest.length > 0) {
    throw new Error(`--spring needs stiffness,damping,mass, got "${value ?? ""}"`);
  }
  return { stiffness, damping, mass };
}

/** `--vet-icons`: prints the verdict and returns whether the set is clean. */
function runIconVet(directory: string | undefined): boolean {
  if (directory === undefined) throw new Error("--vet-icons needs a directory");
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".svg"))
    .sort();
  const icons = files.map((file) => ({
    name: file.replace(/\.svg$/, ""),
    markup: readFileSync(`${directory}/${file}`, "utf8"),
  }));
  const result = vetIcons(icons);
  for (const { name, reason } of result.rejected) console.log(`REJECT  ${name}: ${reason}`);
  for (const pair of result.failingPairs.slice(0, 50)) {
    console.log(`FAIL    ${pair.from} → ${pair.to}: ${pair.checks.join(", ")}`);
  }
  if (result.failingPairs.length > 50) {
    console.log(`        … and ${result.failingPairs.length - 50} more failing pairs`);
  }
  const isClean = result.rejected.length === 0 && result.failingPairs.length === 0;
  console.log(
    `${isClean ? "PASS" : "FAIL"}  vet-icons ${directory}: ${icons.length} icons, ` +
      `${result.rejected.length} rejected, ${result.failingPairs.length} of ${result.pairCount} ordered pairs failing`,
  );
  return isClean;
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
  const vetDirectories: string[] = [];
  let fixedSpring: SpringConfig | null = null;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] as string;
    if (arg === "--all") pairs.push(...REFERENCE_PAIRS);
    else if (arg === "--dense") progressSteps = DENSE_PROGRESS_STEPS;
    else if (arg === "--steps") progressSteps = parseNumbers("--steps", args[++index]);
    else if (arg === "--round-trip") isRoundTrip = true;
    else if (arg === "--playback") isPlayback = true;
    else if (arg === "--vet-icons") vetDirectories.push(args[++index] ?? "");
    else if (arg === "--spring") fixedSpring = parseSpring(args[++index]);
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

  for (const directory of vetDirectories) isFailing ||= !runIconVet(directory || undefined);

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
      runPairPlayback(
        pair,
        fixedSpring === null
          ? // fillmorph/dom's default config (not importable here: the harness grades core only).
            { base: { stiffness: 170, damping: 26, mass: 1 } }
          : { base: fixedSpring, isAutoTuned: false },
      ),
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
