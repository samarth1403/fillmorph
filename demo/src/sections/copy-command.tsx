import { type ReactElement, useEffect, useRef, useState } from "react";
import { Morph } from "../morph";
import { SPRING_PRESETS } from "../presets";
import { COPIED_ICON, COPY_ICON } from "../ui-icons";

const COPIED_FOR_MS = 1600;
const BOUNCY = (SPRING_PRESETS[2] as (typeof SPRING_PRESETS)[number]).config;

/**
 * Copies `text` and morphs its icon copy → check through the real driver, then back. A vetted pair
 * (`demo/ui-pairs/copy`). Used for every copy action on the page (spec 08 §1d #1).
 */
export function useCopy(text: string): { isCopied: boolean; copy: () => void } {
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setIsCopied(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setIsCopied(false), COPIED_FOR_MS);
      })
      .catch(() => {});
  };
  return { isCopied, copy };
}

/** The morphing copy/check icon, with a live "Copied" announcement for assistive tech. */
export const CopyIcon = ({
  isCopied,
  className,
}: {
  isCopied: boolean;
  className: string;
}): ReactElement => {
  return (
    <>
      <Morph icon={isCopied ? COPIED_ICON : COPY_ICON} spring={BOUNCY} className={className} />
      <span className="sr-only" aria-live="polite">
        {isCopied ? "Copied" : ""}
      </span>
    </>
  );
};

/** A copy-icon button for a block of text (the code previews). */
export const CopyButton = ({ text, label }: { text: string; label: string }): ReactElement => {
  const { isCopied, copy } = useCopy(text);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={`grid size-8 cursor-pointer place-items-center rounded-lg transition-colors ${
        isCopied
          ? "text-orange-500"
          : "text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white"
      }`}
    >
      <CopyIcon isCopied={isCopied} className="size-3.5" />
    </button>
  );
};

/** A shell command in a pill that copies itself on click. */
export const CopyCommand = ({ command }: { command: string }): ReactElement => {
  const { isCopied, copy } = useCopy(command);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy "${command}"`}
      className="group inline-flex h-12 cursor-pointer items-center gap-4 rounded-full border border-neutral-200 bg-white/70 pr-4 pl-5 font-mono text-sm text-neutral-800 transition-colors hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-200 dark:hover:border-white/20"
    >
      <span>
        <span aria-hidden="true" className="mr-2.5 text-neutral-400 dark:text-neutral-500">
          $
        </span>
        {command}
      </span>
      <span
        className={`transition-colors ${isCopied ? "text-orange-500" : "text-neutral-400 group-hover:text-neutral-800 dark:text-neutral-500 dark:group-hover:text-neutral-100"}`}
      >
        <CopyIcon isCopied={isCopied} className="size-4" />
      </span>
    </button>
  );
};
