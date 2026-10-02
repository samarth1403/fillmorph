import { type ReactElement, type ReactNode, useCallback, useState } from "react";
import { findIcon } from "../catalog";
import { Morph } from "../morph";
import { HERO_SPRING } from "../presets";
import { BOTH_STYLES, STROKE_WIDTH } from "../stroke-icons";
import { useAmbientTimer } from "../use-page-motion";

const MORPHICONS_URL = "https://morphicons.com";
const HOLD_MS = 2200;

const Panel = ({
  tag,
  isOurs,
  title,
  children,
  footer,
}: {
  tag: string;
  isOurs: boolean;
  title: string;
  children: ReactNode;
  footer: ReactNode;
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
      <div className="grid h-40 place-items-center">{children}</div>
      <figcaption>
        <p className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
          {title}
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{footer}</p>
      </figcaption>
    </figure>
  );
};

/**
 * Spec 08 §1d #2 (icons per §1e #4): the same four icons in both styles, on **one** index and
 * timer, so at every moment the two sides morph the same pair: Lucide's lines on the left, Font
 * Awesome's solid shapes on the right.
 */
export const Compare = (): ReactElement => {
  const [index, setIndex] = useState(0);
  const advance = useCallback(() => setIndex((current) => (current + 1) % BOTH_STYLES.length), []);
  useAmbientTimer(advance, HOLD_MS);
  const current = BOTH_STYLES[index] as (typeof BOTH_STYLES)[number];
  return (
    <section
      id="compare"
      aria-labelledby="compare-title"
      className="mx-auto max-w-[84rem] scroll-mt-16 px-4 py-12 sm:px-6 sm:py-16"
    >
      <h2
        id="compare-title"
        className="mx-auto max-w-2xl text-center text-3xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-4xl dark:text-white"
      >
        Two kinds of icon. Two different problems.
      </h2>
      <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-2">
        <Panel
          tag="Stroke icon"
          isOurs={false}
          title="A line, bent into another line"
          footer={
            <>
              Existing libraries handle this. For stroke icons, see{" "}
              <a
                href={MORPHICONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-800 underline underline-offset-2 hover:text-orange-600 dark:text-neutral-200 dark:hover:text-orange-400"
              >
                morphicons.com
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </>
          }
        >
          <Morph
            icon={current.stroke}
            spring={HERO_SPRING}
            className="size-28 text-neutral-900 dark:text-white"
            label={`Lucide's ${current.name.toLowerCase()}, a stroke icon, morphing as a line`}
            stroke={STROKE_WIDTH}
          />
        </Panel>
        <Panel
          tag="Filled icon"
          isOurs
          title="A solid region, reshaped"
          footer="fillmorph handles this."
        >
          <Morph
            icon={findIcon(current.filledId).markup}
            spring={HERO_SPRING}
            className="size-28 text-neutral-900 dark:text-white"
            label={`Font Awesome's solid ${current.name.toLowerCase()}, morphing as a filled shape`}
          />
        </Panel>
      </div>
      <ol className="mt-6 flex justify-center gap-2" aria-label="Icon in both panels">
        {BOTH_STYLES.map((icon, iconIndex) => (
          <li
            key={icon.name}
            aria-current={iconIndex === index ? "true" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              iconIndex === index
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-500"
            }`}
          >
            {icon.name}
          </li>
        ))}
      </ol>
    </section>
  );
};
