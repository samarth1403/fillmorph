import { type ReactElement, type ReactNode, useState } from "react";
import { ICON_INPUT_SNIPPETS, type IconInputSnippet } from "../snippets";
import { LockToggle } from "../snippets/lock-toggle";
import { SoundToggle } from "../snippets/sound-toggle";
import { CopyButton } from "./copy-command";
import { CodeBlock } from "./get-started";

/**
 * Spec 09 on the demo: the two ways to hand `<FillMorph>` an icon, each a live example next to
 * the exact source it runs (`snippets/lock-toggle.tsx`, `snippets/sound-toggle.tsx`, type-checked
 * with the demo). The markup listing shows its `?raw` imports in the code itself, since importing
 * an `.svg` without it yields a URL string, not markup.
 */

const Example = ({
  title,
  why,
  snippet,
  children,
}: {
  title: string;
  why: ReactNode;
  snippet: IconInputSnippet;
  children: ReactNode;
}): ReactElement => {
  return (
    // A subgrid over the section's two rows (example + text, then code), so both cards' code
    // starts on the same line however many lines each one's text wraps to.
    <article className="row-span-2 grid min-w-0 grid-rows-subgrid gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/[0.02]">
      <div className="p-4">
        <div className="grid place-items-center rounded-xl bg-neutral-50 py-3 dark:bg-white/[0.03]">
          {children}
        </div>
        <h3 className="mt-3 font-semibold tracking-tight text-neutral-950 dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-normal text-neutral-600 dark:text-neutral-400">{why}</p>
      </div>
      <div className="min-w-0 border-t border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-neutral-900/70">
        <div className="flex items-center justify-between border-b border-neutral-200 py-0.5 pr-1 pl-4 dark:border-white/10">
          <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
            {snippet.file}
          </span>
          <CopyButton text={snippet.code} label={`Copy ${snippet.file}`} />
        </div>
        <CodeBlock code={snippet.code} isWrapped />
      </div>
    </article>
  );
};

const toggleClass =
  "grid size-20 cursor-pointer place-items-center rounded-2xl border border-neutral-200 bg-white shadow-sm transition-colors hover:border-orange-300 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-orange-400/50";

export const IconInput = (): ReactElement => {
  const [isLocked, setIsLocked] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Example
        title="An icon element, straight from your icon library"
        why={
          <>
            Pass <code className="font-mono text-[0.9em]">{"<FaLock />"}</code> itself. Its own{" "}
            <code className="font-mono text-[0.9em]">color</code> and{" "}
            <code className="font-mono text-[0.9em]">size</code> carry over (orange or green, 56
            px): <code className="font-mono text-[0.9em]">{"<FillMorph>"}</code> gets no color or
            size of its own here. Any library works, as long as its icons are filled.
          </>
        }
        snippet={ICON_INPUT_SNIPPETS.element}
      >
        <button
          type="button"
          aria-pressed={isLocked}
          aria-label={isLocked ? "Unlock" : "Lock"}
          onClick={() => setIsLocked(!isLocked)}
          className={toggleClass}
        >
          <LockToggle locked={isLocked} />
        </button>
      </Example>
      <Example
        title="SVG markup, imported with ?raw"
        why={
          <>
            Any SVG file works as a string of its markup. With Vite, that's the{" "}
            <code className="font-mono text-[0.9em]">?raw</code> on the import: without it you get
            the file's URL, which isn't SVG.
          </>
        }
        snippet={ICON_INPUT_SNIPPETS.markup}
      >
        <button
          type="button"
          aria-pressed={isMuted}
          aria-label={isMuted ? "Unmute" : "Mute"}
          onClick={() => setIsMuted(!isMuted)}
          className={`${toggleClass} ${isMuted ? "text-neutral-400 dark:text-neutral-500" : "text-orange-500"}`}
        >
          <SoundToggle muted={isMuted} />
        </button>
      </Example>
    </div>
  );
};
