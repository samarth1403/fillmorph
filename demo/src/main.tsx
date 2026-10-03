import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import { type ReactElement, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ALL_ICONS } from "./catalog";
import { GetStarted } from "./sections/get-started";
import { Hero } from "./sections/hero";
import { IconWall } from "./sections/icon-wall";
import { Nav } from "./sections/nav";
import { Playground } from "./sections/playground";
import { SwapVsMorph } from "./sections/swap-vs-morph";
import { UseCases } from "./sections/use-cases";

/**
 * The demo site (spec 08 #1, §1a, §1b), built with `fillmorph/react`'s `<FillMorph>` throughout:
 * hero, swap vs. morph, playground, use cases, icon wall, get started. Fonts are bundled locally
 * (`@fontsource`), so the page makes no external requests.
 */

const Section = ({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: ReactNode;
  children: ReactNode;
}): ReactElement => {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mx-auto max-w-[84rem] scroll-mt-16 px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">{eyebrow}</p>
        <h2
          id={`${id}-title`}
          className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-4xl dark:text-white"
        >
          {title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          {lede}
        </p>
      </div>
      {children}
    </section>
  );
};

const Page = (): ReactElement => {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased selection:bg-orange-500/25 dark:bg-neutral-950 dark:text-neutral-100">
      <Nav />
      <main id="top">
        <Hero />
        <SwapVsMorph />
        <Section
          id="playground"
          eyebrow="Playground"
          title="Click an icon. Watch it morph."
          lede="Click any icon and the one on the left becomes it; click another mid-morph and it turns without a snap. Tune the spring, or paste two of your own SVGs and copy a ready-made component."
        >
          <Playground />
        </Section>
        <Section
          id="use-cases"
          eyebrow="Use cases"
          title="Where a morph beats a swap."
          lede="Each of these is a working piece of UI. Click, toggle and step through them."
        >
          <UseCases />
        </Section>
        <Section
          id="icons"
          eyebrow="Icon set"
          title="Bring your own icons."
          lede={`All ${ALL_ICONS.length} icons here are unmodified Font Awesome Free SVGs, parsed in your browser. Every pair of them morphs cleanly: each was checked against all the others. Click any of them.`}
        >
          <IconWall />
        </Section>
        <Section
          id="start"
          eyebrow="Get started"
          title="Two steps."
          lede="React or no framework at all. Both use the same spring physics."
        >
          <GetStarted />
        </Section>
      </main>
      <footer className="mx-auto max-w-[84rem] px-4 pt-10 pb-16 sm:px-6">
        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-8 text-sm text-neutral-500 sm:flex-row sm:justify-between dark:border-white/10">
          <p>fillmorph · MIT license</p>
          <p>Vue and Svelte bindings are planned, not yet built.</p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
          Icons:{" "}
          <a className="underline underline-offset-2" href="https://fontawesome.com/license/free">
            Font Awesome Free 6.7.2
          </a>{" "}
          by Fonticons, Inc., CC BY 4.0. React and JavaScript marks: Font Awesome Free brand icons,
          CC BY 4.0, trademarks of their owners. Fonts: Inter and JetBrains Mono, SIL OFL 1.1.
        </p>
      </footer>
    </div>
  );
};

const root = document.getElementById("root");
if (root === null) throw new Error("The demo page has no #root element");
createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
