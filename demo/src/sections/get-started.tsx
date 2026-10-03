import { type ReactElement, useMemo, useState } from "react";
import { highlight } from "../highlight";
import { SNIPPETS, type Snippet } from "../snippets";
import { CopyButton, CopyCommand } from "./copy-command";
import { FrameworkMark } from "./framework-mark";

/**
 * A highlighted code listing, as the code tabs here and the icon-input section show one. Full
 * width, long lines scroll; `isWrapped` (for narrow cards, where a scrollbar may not even show)
 * wraps them instead, so no line can run off the edge unread. Copying always takes the original.
 */
export const CodeBlock = ({
  code,
  isWrapped = false,
}: {
  code: string;
  isWrapped?: boolean;
}): ReactElement => {
  const tokens = useMemo(() => highlight(code), [code]);
  const layout = isWrapped
    ? "whitespace-pre-wrap px-4 py-3.5 text-[12.5px] leading-5 [overflow-wrap:anywhere]"
    : "p-5 text-[13px] leading-6 sm:p-6 sm:text-sm";
  return (
    <pre className={`overflow-x-auto font-mono text-neutral-800 dark:text-neutral-200 ${layout}`}>
      <code>
        {tokens.map((token, index) =>
          token.kind === null ? (
            token.text
          ) : (
            // Tokens never reorder, so their index is a stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above.
            <span key={index} className={`tok-${token.kind}`}>
              {token.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
};

const Step = ({ number, title }: { number: number; title: string }): ReactElement => {
  return (
    <p className="flex items-center gap-3 text-sm font-semibold text-neutral-950 dark:text-white">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-500 text-xs text-neutral-950">
        {number}
      </span>
      {title}
    </p>
  );
};

/**
 * Spec 08 §1c #7: two steps, install and use, stacked and left-aligned (§1g #4), with the code at
 * the section's full width (§1f #4). The code is the same like button in React and in
 * vanilla JS, each a real file the demo type-checks (see `snippets/`); everything else lives in
 * the README.
 */
export const GetStarted = (): ReactElement => {
  const [activeId, setActiveId] = useState<Snippet["id"]>("react");
  const active = SNIPPETS.find((snippet) => snippet.id === activeId) ?? (SNIPPETS[0] as Snippet);
  return (
    <div className="flex flex-col items-start gap-10">
      <div className="flex flex-col items-start gap-3">
        <Step number={1} title="Install" />
        <CopyCommand command="npm install fillmorph" />
      </div>
      <div className="w-full min-w-0 space-y-3">
        <Step number={2} title="Use it" />
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-neutral-900/70">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 dark:border-white/10">
            <div role="tablist" aria-label="Language" className="flex">
              {SNIPPETS.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  role="tab"
                  id={`code-tab-${snippet.id}`}
                  aria-selected={snippet.id === activeId}
                  aria-controls="code-panel"
                  onClick={() => setActiveId(snippet.id)}
                  className="-mb-px flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 aria-selected:border-orange-500 aria-selected:text-neutral-950 dark:hover:text-white dark:aria-selected:text-white"
                >
                  <FrameworkMark markup={snippet.mark} framework={snippet.id} />
                  {snippet.label}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1 pr-1">
              <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
                {active.file}
              </span>
              <CopyButton text={active.code} label={`Copy the ${active.label} example`} />
            </span>
          </div>
          <div id="code-panel" role="tabpanel" aria-labelledby={`code-tab-${active.id}`}>
            <CodeBlock code={active.code} />
          </div>
        </div>
      </div>
    </div>
  );
};
