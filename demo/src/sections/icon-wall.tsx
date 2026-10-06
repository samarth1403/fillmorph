import { type ReactElement, useCallback, useEffect, useState } from "react";
import { ALL_ICONS, findIcon } from "../catalog";
import { Morph } from "../morph";
import { AMBIENT_SPRING } from "../presets";
import { StaticIcon } from "../static-icon";
import { useAmbientTimer, useIsOnScreen } from "../use-page-motion";

/**
 * Two tiles start morphing every `SWAP_EVERY_MS`, and each stays live for `LIVE_FOR_MS`, so about
 * 2 × 1600 / 180 ≈ 18 tiles (a tenth of the wall) are mid-morph at any moment, each starting at a
 * different time: the wall reads as alive within a second or two, without everything moving at
 * once (spec 08 §1c #6).
 */
/**
 * The wall's tile treatment: hairline borders between tiles inside one rounded frame, an orange
 * tint on hover. Shared with the hero's 5×5 grid (spec 08 §1f #1), so the two can't drift apart.
 */
export const TILE_FRAME =
  "grid gap-px overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-200 dark:border-white/10 dark:bg-white/[0.06]";
export const TILE_CELL = "bg-white dark:bg-neutral-950";
export const TILE_BUTTON =
  "grid aspect-square w-full cursor-pointer place-items-center text-neutral-700 transition-colors hover:bg-orange-50 hover:text-orange-600 focus-visible:relative focus-visible:z-10 dark:text-neutral-400 dark:hover:bg-orange-500/10 dark:hover:text-orange-400";

const SWAP_EVERY_MS = 180;
/** Longer than `AMBIENT_SPRING` takes to settle (about 1.2 s), so a tile goes still only at rest. */
const LIVE_FOR_MS = 1600;

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

/**
 * Swaps two slots (`first`, or a random one, with a random other), so every icon stays on the wall
 * exactly once.
 */
function swapTwo(order: readonly string[], first = randomIndex(order.length)): string[] {
  let second = randomIndex(order.length - 1);
  if (second >= first) second += 1;
  const next = [...order];
  [next[first], next[second]] = [next[second] as string, next[first] as string];
  return next;
}

/**
 * Mounts a live `<FillMorph>` on `from`, then hands it `to`, so the morph starts from what the
 * tile showed. Later `to` changes retarget it like any other `icon` change.
 */
const LiveMorph = ({ from, to }: { from: string; to: string }): ReactElement => {
  const [icon, setIcon] = useState(from);
  useEffect(() => setIcon(to), [to]);
  return <Morph icon={icon} spring={AMBIENT_SPRING} className="size-7" />;
};

/**
 * One slot on the wall. Drawn still until its icon changes; then a live `<FillMorph>` morphs it
 * in place, and once that has settled the slot goes back to still. Only the moving tiles run an
 * animation driver, not one per tile for all 164, and only on screen: a slot scrolled out of view
 * (most of the wall, on a phone) just takes its new icon still.
 */
const WallTile = ({
  markup,
  name,
  onClick,
}: {
  markup: string;
  name: string;
  onClick: () => void;
}): ReactElement => {
  const [tileRef, isOnScreen] = useIsOnScreen<HTMLLIElement>();
  const [shown, setShown] = useState(markup);
  const [liveFrom, setLiveFrom] = useState<string | null>(null);
  // Adjusting state during render (React's pattern for reacting to a prop change) switches to the
  // live morph before the new icon is ever painted still.
  if (markup !== shown) {
    setShown(markup);
    if (isOnScreen) setLiveFrom((from) => from ?? shown);
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new icon mid-morph restarts the timer.
  useEffect(() => {
    if (liveFrom === null) return;
    const id = window.setTimeout(() => setLiveFrom(null), LIVE_FOR_MS);
    return () => window.clearTimeout(id);
  }, [liveFrom, markup]);

  return (
    <li ref={tileRef} className={TILE_CELL}>
      {/* A click is an out-of-turn swap, the same move the ambient animation makes, so the
          two never fight over a tile (spec 08 §1d #6). */}
      <button
        type="button"
        title={name}
        aria-label={`${name}. Click to morph it.`}
        onClick={onClick}
        className={TILE_BUTTON}
      >
        {liveFrom === null ? (
          <StaticIcon markup={markup} className="size-7" />
        ) : (
          <LiveMorph from={liveFrom} to={markup} />
        )}
      </button>
    </li>
  );
};

/**
 * The icon wall: every icon in the vetted set at once, with a steady, staggered stream of pairs
 * trading places by morphing in place (still under `prefers-reduced-motion`). Clicking a tile
 * morphs it at once, by swapping it with a random other tile.
 */
export const IconWall = (): ReactElement => {
  const [order, setOrder] = useState(() => ALL_ICONS.map((icon) => icon.id));
  const shuffle = useCallback(() => setOrder((current) => swapTwo(current)), []);
  // Scrolled away, the wall stops trading icons altogether.
  const [wallRef, isOnScreen] = useIsOnScreen<HTMLUListElement>();
  useAmbientTimer(isOnScreen ? shuffle : null, SWAP_EVERY_MS);

  return (
    <ul ref={wallRef} className={`grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] ${TILE_FRAME}`}>
      {order.map((id, slot) => {
        const icon = findIcon(id);
        return (
          <WallTile
            // Keyed by slot, not icon: a slot keeps its tile, and a new icon there morphs in place.
            // biome-ignore lint/suspicious/noArrayIndexKey: the slot is the tile's identity.
            key={slot}
            markup={icon.markup}
            name={`${icon.label}, ${icon.style}`}
            onClick={() => setOrder((current) => swapTwo(current, slot))}
          />
        );
      })}
    </ul>
  );
};
