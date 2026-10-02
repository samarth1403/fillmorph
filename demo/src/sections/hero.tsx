import { type ReactElement, useCallback, useRef, useState } from "react";
import { type DemoIcon, findIcon } from "../catalog";
import { Morph } from "../morph";
import { HERO_SPRING } from "../presets";
import { useAmbientTimer } from "../use-page-motion";
import { TILE_BUTTON, TILE_CELL, TILE_FRAME } from "./icon-wall";
import { CopyCommand } from "./copy-command";

/**
 * 25 everyday icons a visitor recognizes on sight, many with holes to open, move and close (a
 * keyhole, a lens, a magnifier's glass, a map pin, a clock face). All from the vetted set, so every
 * pair among them morphs cleanly.
 */
const POOL: readonly DemoIcon[] = [
  "fa-solid-heart",
  "fa-regular-bell",
  "fa-solid-lock",
  "fa-solid-camera",
  "fa-solid-magnifying-glass",
  "fa-solid-location-dot",
  "fa-solid-star",
  "fa-solid-house",
  "fa-solid-gear",
  "fa-solid-envelope-open",
  "fa-solid-comment",
  "fa-solid-user",
  "fa-solid-folder",
  "fa-regular-file-lines",
  "fa-regular-calendar",
  "fa-regular-clock",
  "fa-solid-bookmark",
  "fa-solid-play",
  "fa-regular-circle-check",
  "fa-solid-flag",
  "fa-solid-cloud",
  "fa-solid-sun",
  "fa-solid-video",
  "fa-solid-eye",
  "fa-solid-shield-halved",
].map(findIcon);
const TILES = 25;
/** Each tile loops through three icons, 7 and 14 places along the pool, so neighbors differ. */
const LOOPS: readonly (readonly DemoIcon[])[] = Array.from({ length: TILES }, (_, tile) =>
  [0, 7, 14].map((offset) => POOL[(tile + offset) % POOL.length] as DemoIcon),
);
/**
 * Each tile rests about 1.8 s on a settled icon (the default spring takes about 0.8 s), and one
 * tile moves every `HOLD_MS / TILES` ≈ 104 ms, so the grid ripples rather than flipping at once.
 */
const HOLD_MS = 2600;
/** The order tiles take their turns in: a fixed scatter, so the ripple doesn't sweep row by row. */
const TURN_ORDER = Array.from({ length: TILES }, (_, index) => (index * 11) % TILES);

const HeroGrid = (): ReactElement => {
  const [steps, setSteps] = useState<readonly number[]>(() => Array(TILES).fill(0));
  // Turn bookkeeping lives in a ref, not state: it isn't rendered, and an updater with side
  // effects would run twice under StrictMode.
  const turnRef = useRef(0);
  // The hovered tile holds still, so the icon being looked at doesn't morph away; hovering
  // anywhere else on this half does nothing (spec 08 §1d #1, now across 25 tiles).
  const [pausedTile, setPausedTile] = useState<number | null>(null);
  const pausedRef = useRef<number | null>(null);
  pausedRef.current = pausedTile;
  const advance = useCallback(() => {
    const tile = TURN_ORDER[turnRef.current % TILES] as number;
    turnRef.current += 1;
    if (tile === pausedRef.current) return;
    setSteps((all) => all.map((step, index) => (index === tile ? step + 1 : step)));
  }, []);
  useAmbientTimer(advance, HOLD_MS / TILES);
  // A click morphs the tile at once, out of turn, like a click on the icon wall; the ticker
  // carries on from there. It works while hovered (the pause only stops the ticker).
  const morphNow = (tile: number) =>
    setSteps((all) => all.map((step, index) => (index === tile ? step + 1 : step)));
  return (
    <div className="relative w-full max-w-md justify-self-center lg:max-w-none lg:justify-self-stretch">
      <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10 rounded-full blur-3xl" />
      <ul
        className={`grid-cols-5 ${TILE_FRAME}`}
        aria-label="25 icons, each continuously morphing between everyday icons"
      >
        {LOOPS.map((loop, tile) => {
          const icon = loop[(steps[tile] ?? 0) % loop.length] as DemoIcon;
          return (
            <li
              // The tile is its own identity: its icon changes, and it morphs in place.
              // biome-ignore lint/suspicious/noArrayIndexKey: tiles never reorder.
              key={tile}
              onPointerEnter={() => setPausedTile(tile)}
              onPointerLeave={() => setPausedTile((current) => (current === tile ? null : current))}
              className={TILE_CELL}
            >
              <button
                type="button"
                aria-label={`${icon.label}, ${icon.style}. Click to morph it.`}
                title={`${icon.label}, ${icon.style}`}
                onClick={() => morphNow(tile)}
                className={TILE_BUTTON}
              >
                <Morph icon={icon.markup} spring={HERO_SPRING} className="size-7" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * The first screen: what fillmorph is, in one headline and one line, with the morph running.
 *
 * Wide layout (spec 08 §1g #1): the copy column is sized to its content (40 rem: the headline
 * balances to about that, the lede is capped at 36 rem) and the grid's column to the grid, packed
 * to the start with a 4 rem gap. A `1fr` copy column (the earlier layout) left 150–200 px of empty
 * column beside the text, on top of the gap, at a 1440 px window.
 */
export const Hero = (): ReactElement => {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="hero-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem]"
      />
      <div className="mx-auto grid max-w-[84rem] items-center gap-10 px-4 pt-8 pb-10 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,40rem)_28rem] lg:justify-center lg:gap-16 lg:pb-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/60 px-3 py-1 text-xs font-medium text-neutral-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300">
            <span className="size-1.5 rounded-full bg-orange-500" />
            Spring physics for filled SVG icons
          </p>
          <h1 className="mt-6 text-5xl font-semibold tracking-[-0.04em] text-balance text-neutral-950 sm:text-6xl lg:text-7xl dark:text-white">
            Morph filled icons,{" "}
            <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent dark:from-orange-500 dark:to-amber-300">
              holes and all.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
            fillmorph turns any filled SVG icon into another (solid shapes, outlines, rings and
            cutouts) with real spring physics. No crossfade, no icon swap.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#playground"
              className="inline-flex h-12 items-center rounded-full bg-gradient-to-b from-orange-400 to-orange-500 px-6 text-sm font-semibold text-neutral-950 shadow-lg shadow-orange-500/25 transition hover:-translate-y-px hover:shadow-orange-500/40"
            >
              Open the playground
            </a>
            <CopyCommand command="npm install fillmorph" />
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
            <li>Zero runtime dependencies</li>
            <li>React and vanilla JS</li>
            <li>MIT licensed</li>
          </ul>
        </div>
        <HeroGrid />
      </div>
    </section>
  );
};
