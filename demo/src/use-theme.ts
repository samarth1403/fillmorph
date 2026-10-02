import { useCallback, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "fillmorph-theme";

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * The page's theme: dark by default (index.html's inline script applies a remembered "light"
 * before first paint), switched by toggling `.dark` on `<html>`, which Tailwind's `dark:` variant
 * keys on. The choice is remembered in this browser only; storage that's unavailable just means
 * it isn't remembered.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const toggleTheme = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the toggle still works for this visit.
    }
    setTheme(next);
  }, []);
  return { theme, toggleTheme };
}
