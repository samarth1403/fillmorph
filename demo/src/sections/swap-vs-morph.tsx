import { type ReactElement, useCallback, useState } from "react";
import { type DemoIcon, findIcon } from "../catalog";
import { Morph } from "../morph";
import { HERO_SPRING } from "../presets";
import { StaticIcon } from "../static-icon";
import { useAmbientTimer, useIsOnScreen } from "../use-page-motion";

/**
 * Spec 08 §1f #2: each step is one icon's own outline (regular) version becoming its filled
 * (solid) version, then on to the next icon. Only icons vetted in *both* styles qualify: of the
 * earlier heart / star / bookmark / diamond, only heart does (Font Awesome's regular star and
 * bookmark failed vetting, and diamond has no regular version). Every step, within a pair or
 * between pairs, is a clean pair from the vetted set.
 */
const PAIRS = ["heart", "bell", "comment", "folder"].map((name) => ({
  name,
  outline: findIcon(`fa-regular-${name}`),
  solid: findIcon(`fa-solid-${name}`),
}));
const SEQUENCE: readonly DemoIcon[] = PAIRS.flatMap((pair) => [pair.outline, pair.solid]);
const HOLD_MS = 1800;

const Half = ({
  tag,
  isOurs,
  title,
  why,
  children,
}: {
  tag: string;
  isOurs: boolean;
  title: string;
  why: string;
  children: ReactElement;
}): ReactElement => {
  return (
    <figure
      className={`flex flex-col items-center rounded-3xl border p-8 text-center ${
        isOurs
          ? "border-orange-300 bg-gradient-to-b from-orange-50 to-white dark:border-orange-400/30 dark:from-orange-500/[0.08] dark:to-transparent"
          : "border-neutral-200 bg-neutral-50/60 dark:border-white/10 dark:bg-white/[0.02]"
      }`}
    >
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${
          isOurs
            ? "bg-orange-500 text-neutral-950"
            : "bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
        }`}
      >
        {tag}
      </span>
      <div className="grid h-40 place-items-center text-neutral-900 dark:text-white">
        {children}
      </div>
      <figcaption className="max-w-sm">
        <p className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
          {title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {why}
        </p>
      </figcaption>
    </figure>
  );
};

/**
 * Spec 08 §1d #3, §1f #2: the problem itself, before the stroke/filled distinction. Both halves
 * step through the same outline → filled pairs on one timer; one cuts, one morphs.
 */
export const SwapVsMorph = (): ReactElement => {
  const [index, setIndex] = useState(0);
  const advance = useCallback(() => setIndex((current) => (current + 1) % SEQUENCE.length), []);
  const [sectionRef, isOnScreen] = useIsOnScreen<HTMLElement>();
  useAmbientTimer(isOnScreen ? advance : null, HOLD_MS);
  const current = SEQUENCE[index] as DemoIcon;
  return (
    <section
      ref={sectionRef}
      id="why"
      aria-labelledby="why-title"
      className="mx-auto max-w-[84rem] scroll-mt-16 px-4 py-12 sm:px-6 sm:py-16"
    >
      <h2
        id="why-title"
        className="mx-auto max-w-2xl text-center text-3xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-4xl dark:text-white"
      >
        Most icon changes are a cut.
      </h2>
      <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-2">
        <Half
          tag="Icon swap"
          isOurs={false}
          title="One icon replaces the other"
          why="Nothing connects the two shapes, so the eye has nothing to follow: it registers a flicker, then has to find the new icon."
        >
          <span role="img" aria-label={`${current.label} (${current.style}), swapped in instantly`}>
            <StaticIcon markup={current.markup} className="size-28" />
          </span>
        </Half>
        <Half
          tag="fillmorph"
          isOurs
          title="One shape becomes the other"
          why="The outline deforms continuously with physical motion, so the eye tracks one object through the change instead of seeing a cut."
        >
          <Morph
            icon={current.markup}
            spring={HERO_SPRING}
            className="size-28"
            label={`${current.label} (${current.style}), morphed in by fillmorph`}
          />
        </Half>
      </div>
    </section>
  );
};
