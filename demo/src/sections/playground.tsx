import {
  type Contour,
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  FillmorphParseError,
  interpolate,
  parseIcon,
  type SpringConfig,
} from "fillmorph";
import {
  type CSSProperties,
  type ReactElement,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { checkContainment } from "../../../harness/checks/containment.ts";
import { checkHoleMonotonic } from "../../../harness/checks/hole-monotonic.ts";
import { checkSelfIntersection } from "../../../harness/checks/self-intersection.ts";
import { DENSE_PROGRESS_STEPS, sampleFrames } from "../../../harness/frames.ts";
import { CATEGORIES, type DemoIcon, findIcon } from "../catalog";
import { generateReactComponent, generateVanillaScript } from "../codegen";
import { highlight } from "../highlight";
import { Morph } from "../morph";
import { matchingPreset, SPRING_PRESETS, SPRING_SLIDERS } from "../presets";
import { StaticIcon } from "../static-icon";
import { CopyButton } from "./copy-command";
import { FrameworkMark, JS_MARK, REACT_MARK } from "./framework-mark";

/** What the stage shows before the first click, so it's never blank. */
const DEFAULT_ICON_ID = "fa-solid-heart";
/** The paste tool's starting pair: a vetted pair, so it opens on a clean morph. */
const DEFAULT_FROM = findIcon("fa-regular-heart").markup;
const DEFAULT_TO = findIcon("fa-solid-heart").markup;
/** Generous for an icon; past this a paste is almost certainly not one, and parsing would stall typing. */
const MAX_PASTE_LENGTH = 100_000;

type Mode = "set" | "custom";
type Binding = "react" | "vanilla";

/** The paste tool's output tabs: React and Vanilla JS, each with its mark (§1f #3). */
const BINDINGS: readonly { id: Binding; label: string; file: string; mark: string }[] = [
  { id: "react", label: "React", file: "MorphingIcon.tsx", mark: REACT_MARK },
  { id: "vanilla", label: "Vanilla JS", file: "morph.ts", mark: JS_MARK },
];

function describe(icon: DemoIcon): string {
  return `${icon.label}, ${icon.style}`;
}

/**
 * Presets plus one compact slider per spring field (§1c #4), under the morph in the left column
 * for both modes (§1e #5).
 */
const SpringControls = ({
  spring,
  onChange,
}: {
  spring: SpringConfig;
  onChange: (next: SpringConfig) => void;
}): ReactElement => {
  const activePreset = matchingPreset(spring);
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <fieldset className="flex w-fit rounded-full bg-neutral-100 p-1 dark:bg-white/[0.06]">
        <legend className="sr-only">Spring preset</legend>
        {SPRING_PRESETS.map((candidate) => (
          <button
            key={candidate.name}
            type="button"
            aria-pressed={candidate.name === activePreset?.name}
            onClick={() => onChange(candidate.config)}
            className="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:text-neutral-900 aria-pressed:bg-orange-500 aria-pressed:text-neutral-950 aria-pressed:shadow-sm dark:text-neutral-400 dark:hover:text-white dark:aria-pressed:text-neutral-950"
          >
            {candidate.label}
          </button>
        ))}
      </fieldset>
      <fieldset className="grid w-full gap-2.5">
        <legend className="sr-only">Spring parameters</legend>
        {SPRING_SLIDERS.map((slider) => (
          <label key={slider.key} className="block">
            <span className="flex items-baseline justify-between text-[11px] leading-none">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {slider.label}
              </span>
              <span className="font-mono text-neutral-500 tabular-nums">{spring[slider.key]}</span>
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={spring[slider.key]}
              onChange={(event) => {
                // Rounded to the step, so floating-point drift can't hide a matching preset.
                const value = Math.round(Number(event.target.value) / slider.step) * slider.step;
                onChange({ ...spring, [slider.key]: Number(value.toFixed(2)) });
              }}
              className="range mt-1.5"
              // The filled share of the track, which the thin custom track draws itself (styles.css).
              style={
                {
                  "--fill": `${((spring[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%`,
                } as CSSProperties
              }
            />
          </label>
        ))}
      </fieldset>
    </div>
  );
};

/** Every category stacked in one vertically scrolling list (§1d reverses §1b #6's tabs). */
const IconPicker = ({
  currentId,
  onPick,
}: {
  currentId: string;
  onPick: (icon: DemoIcon) => void;
}): ReactElement => {
  return (
    <div className="max-h-[30rem] overflow-y-auto overscroll-contain px-3 pb-2 sm:px-4">
      {CATEGORIES.map((category) => (
        <section key={category.name} aria-label={category.name}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-white/95 px-2 py-2.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase backdrop-blur dark:bg-neutral-900/95">
            {category.name}
            <span className="text-neutral-300 tabular-nums dark:text-neutral-600">
              {category.icons.length}
            </span>
          </h3>
          {/* Padded clear of the sticky label above, so a selected tile's ring is never under it. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5 px-1 pt-1.5 pb-4">
            {category.icons.map((icon) => (
              <button
                key={icon.id}
                type="button"
                aria-pressed={icon.id === currentId}
                aria-label={describe(icon)}
                title={describe(icon)}
                onClick={() => onPick(icon)}
                className="grid aspect-square cursor-pointer place-items-center rounded-2xl text-neutral-600 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-950 aria-pressed:bg-orange-50 aria-pressed:text-orange-600 aria-pressed:ring-[1.5px] aria-pressed:ring-orange-500 aria-pressed:ring-inset dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white dark:aria-pressed:bg-orange-500/15 dark:aria-pressed:text-orange-300 dark:aria-pressed:ring-orange-400"
              >
                <StaticIcon markup={icon.markup} className="size-6" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

type PastedIcon = { contours: Contour[]; error: null } | { contours: null; error: string };

/** Parses pasted markup with the library's own `parseIcon`, turning any rejection into a message. */
function parsePasted(markup: string): PastedIcon {
  if (markup.trim() === "") return { contours: null, error: "Paste an <svg> icon here." };
  if (markup.length > MAX_PASTE_LENGTH) {
    return { contours: null, error: "That's over 100 KB, too large for an icon." };
  }
  try {
    return { contours: parseIcon(markup).contours, error: null };
  } catch (error) {
    // Class names don't survive minification, so each rejection kind is named here.
    const kind =
      error instanceof FillmorphMarkupError
        ? "Not valid SVG markup"
        : error instanceof FillmorphIncompatibleIconError
          ? "Outside fillmorph's icon contract"
          : error instanceof FillmorphParseError
            ? "Couldn't read the path data"
            : "Couldn't parse this icon";
    const message = error instanceof Error ? error.message : String(error);
    return { contours: null, error: `${kind}: ${message}` };
  }
}

/**
 * Spec 03's geometry checks over 11 frames of the pasted pair, both ways: the same test every icon
 * in the curated set passed. A failure isn't an error, just the known limitation, stated plainly.
 */
function hasArtifacts(a: Contour[], b: Contour[]): boolean {
  return [
    [a, b],
    [b, a],
  ].some(([from, to]) => {
    const frames = sampleFrames(
      interpolate,
      from as Contour[],
      to as Contour[],
      DENSE_PROGRESS_STEPS,
    );
    return [
      checkSelfIntersection(frames),
      checkHoleMonotonic(frames),
      checkContainment(frames),
    ].some((check) => !check.passed);
  });
}

const PasteField = ({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
}): ReactElement => {
  return (
    <div className="flex min-h-0 flex-col">
      <label htmlFor={id} className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : `${id}-error`}
        rows={5}
        className="mt-1.5 block min-h-40 w-full flex-1 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-800 outline-none focus:border-orange-400 aria-invalid:border-red-400 dark:border-white/10 dark:bg-black/30 dark:text-neutral-200 dark:aria-invalid:border-red-400/70"
      />
      {error !== null && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Spec 08's playground (§1d #4): the morph on the left (40%), controls and either the curated
 * picker or the paste-your-own tool on the right (60%).
 *
 * - **Icon set:** a click morphs current → clicked, and the clicked icon becomes current; a click
 *   mid-morph is just a new `icon` prop, which `<FillMorph>` turns into a retarget.
 * - **Your own SVGs:** two pasted icons morph back and forth under the same spring, with live,
 *   copyable code (React or Vanilla JS) for exactly what's on screen.
 *
 * Both modes put the morph and its spring controls on the left (40%) and the picker or paste
 * fields on the right (60%, §1e #5).
 *
 * The spring is live: a slider change is a new `springConfig`, which `<FillMorph>` applies by
 * rebuilding its driver from the shape on screen. A preset shows as active only while the sliders
 * match it exactly.
 */
export const Playground = (): ReactElement => {
  const [mode, setMode] = useState<Mode>("set");
  const [spring, setSpring] = useState<SpringConfig>(
    () => (SPRING_PRESETS[0] as (typeof SPRING_PRESETS)[number]).config,
  );
  const [currentId, setCurrentId] = useState(DEFAULT_ICON_ID);
  const [hasPicked, setHasPicked] = useState(false);
  const current = findIcon(currentId);

  const [fromText, setFromText] = useState(DEFAULT_FROM);
  const [toText, setToText] = useState(DEFAULT_TO);
  const [isOnTo, setIsOnTo] = useState(false);
  // Parsing a large paste on every keystroke would stall typing; React lets it trail behind.
  const deferredFrom = useDeferredValue(fromText);
  const deferredTo = useDeferredValue(toText);
  const fromParsed = useMemo(() => parsePasted(deferredFrom), [deferredFrom]);
  const toParsed = useMemo(() => parsePasted(deferredTo), [deferredTo]);
  // The stage keeps the last markup that parsed on each side, so a typo never blanks it.
  const lastGood = useRef({ from: DEFAULT_FROM, to: DEFAULT_TO });
  if (fromParsed.error === null) lastGood.current.from = deferredFrom;
  if (toParsed.error === null) lastGood.current.to = deferredTo;
  const isPairValid = fromParsed.error === null && toParsed.error === null;
  const showsArtifacts = useMemo(
    () =>
      fromParsed.contours !== null &&
      toParsed.contours !== null &&
      hasArtifacts(fromParsed.contours, toParsed.contours),
    [fromParsed, toParsed],
  );
  const goodFrom = lastGood.current.from;
  const goodTo = lastGood.current.to;
  const [binding, setBinding] = useState<Binding>("react");
  const code = useMemo(
    () =>
      binding === "react"
        ? generateReactComponent(goodFrom, goodTo, spring)
        : generateVanillaScript(goodFrom, goodTo, spring),
    [binding, goodFrom, goodTo, spring],
  );
  const codeTokens = useMemo(() => highlight(code), [code]);

  const stageIcon = mode === "set" ? current.markup : isOnTo ? goodTo : goodFrom;

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/[0.04] dark:border-white/10 dark:bg-neutral-900/50 dark:shadow-black/30">
      <div
        role="tablist"
        aria-label="Playground mode"
        className="flex gap-1 border-b border-neutral-200 px-3 dark:border-white/10"
      >
        {(
          [
            ["set", "Icon set"],
            ["custom", "Your own SVGs"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`mode-${value}`}
            aria-selected={mode === value}
            aria-controls="playground-panel"
            onClick={() => setMode(value)}
            className="-mb-px cursor-pointer border-b-2 border-transparent px-3 py-3 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 aria-selected:border-orange-500 aria-selected:text-neutral-950 dark:hover:text-white dark:aria-selected:text-white"
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="playground-panel"
        role="tabpanel"
        aria-labelledby={`mode-${mode}`}
        className="grid md:grid-cols-[2fr_3fr]"
      >
        <div className="flex flex-col items-center justify-center gap-4 border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white px-6 py-7 md:border-r md:border-b-0 dark:border-white/10 dark:from-white/[0.03] dark:to-transparent">
          <div className="grid size-32 place-items-center">
            <Morph
              icon={stageIcon}
              spring={spring}
              className="w-full text-neutral-950 dark:text-white"
              label={mode === "set" ? describe(current) : "Your pasted icon"}
            />
          </div>
          {mode === "set" ? (
            <>
              <p className="flex items-baseline gap-2" aria-live="polite">
                <span className="font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {current.label}
                </span>
                <span className="text-xs text-neutral-500">{current.style}</span>
              </p>
              <p
                className={`text-xs text-neutral-500 transition-opacity duration-300 ${hasPicked ? "opacity-0" : ""}`}
              >
                Pick any icon to morph into it
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsOnTo(!isOnTo)}
              disabled={!isPairValid}
              className="cursor-pointer rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Morph to {isOnTo ? "first" : "second"} icon
            </button>
          )}
          <SpringControls spring={spring} onChange={setSpring} />
        </div>

        <div className="flex min-w-0 flex-col">
          {mode === "set" ? (
            <IconPicker
              currentId={currentId}
              onPick={(icon) => {
                setCurrentId(icon.id);
                setHasPicked(true);
              }}
            />
          ) : (
            // Fills the row's full height: the left column (morph + controls) sets it, and both
            // fields stretch to it (spec 08 §1g #3); the notice, when shown, sits below them.
            <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <PasteField
                  id="paste-from"
                  label="First icon (SVG markup)"
                  value={fromText}
                  onChange={setFromText}
                  error={fromParsed.error}
                />
                <PasteField
                  id="paste-to"
                  label="Second icon (SVG markup)"
                  value={toText}
                  onChange={setToText}
                  error={toParsed.error}
                />
              </div>
              {showsArtifacts && (
                <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  This pair shows geometry artifacts mid-morph (an outline crossing itself or a hole
                  leaving its shape). That's a known limitation on very complex or concave outlines.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {mode === "custom" && (
        <div className="border-t border-neutral-200 dark:border-white/10">
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4">
            <div role="tablist" aria-label="Output" className="flex">
              {BINDINGS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={binding === option.id}
                  onClick={() => setBinding(option.id)}
                  className="-mb-px flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 aria-selected:border-orange-500 aria-selected:text-neutral-950 dark:hover:text-white dark:aria-selected:text-white"
                >
                  <FrameworkMark markup={option.mark} framework={option.id} />
                  {option.label}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1">
              <span className="hidden font-mono text-xs text-neutral-400 sm:inline dark:text-neutral-500">
                {BINDINGS.find((option) => option.id === binding)?.file}
              </span>
              <CopyButton
                text={code}
                label={`Copy the ${binding === "react" ? "React component" : "Vanilla JS"} code`}
              />
            </span>
          </div>
          <pre className="max-h-72 overflow-auto border-t border-neutral-200 p-4 font-mono text-[12px] leading-5 text-neutral-800 sm:px-5 dark:text-neutral-200">
            <code>
              {codeTokens.map((token, index) =>
                token.kind === null ? (
                  token.text
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: tokens never reorder.
                  <span key={index} className={`tok-${token.kind}`}>
                    {token.text}
                  </span>
                ),
              )}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
};
