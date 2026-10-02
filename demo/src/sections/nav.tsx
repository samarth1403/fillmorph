import type { ReactElement } from "react";
import { Morph } from "../morph";
import { SPRING_PRESETS } from "../presets";
import { MOON_ICON, SUN_ICON } from "../ui-icons";
import { useTheme } from "../use-theme";

const TOGGLE_SPRING = SPRING_PRESETS[2]?.config ?? { stiffness: 300, damping: 12, mass: 1 };

const LINKS = [
  { href: "#why", label: "Why" },
  { href: "#playground", label: "Playground" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#icons", label: "Icons" },
  { href: "#start", label: "Get started" },
];

/**
 * Sticky top bar: the static flame brand mark (the favicon's file), section links, and the theme
 * toggle, whose icon morphs sun ↔ moon (a vetted pair, `demo/ui-pairs/theme`).
 */
export const Nav = (): ReactElement => {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/75 backdrop-blur-xl dark:border-white/[0.06] dark:bg-neutral-950/75">
      <div className="mx-auto flex h-16 max-w-[84rem] items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 font-semibold tracking-tight">
          {/* The static flame mark, the very file used as the favicon (spec 08 §1j #1), in the
              same size-5 slot the live morphing mark had. Decorative: the wordmark names the link. */}
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-5" />
          fillmorph
        </a>
        <div className="flex items-center gap-1">
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${next} theme`}
            title={`Switch to ${next} theme`}
            className="ml-2 grid size-9 cursor-pointer place-items-center rounded-full border border-neutral-200 text-neutral-700 transition-colors hover:border-orange-400 hover:text-orange-600 dark:border-white/10 dark:text-neutral-200 dark:hover:border-orange-400/60 dark:hover:text-orange-400"
          >
            <Morph
              icon={theme === "dark" ? SUN_ICON : MOON_ICON}
              spring={TOGGLE_SPRING}
              className="size-4"
            />
          </button>
        </div>
      </div>
    </header>
  );
};
