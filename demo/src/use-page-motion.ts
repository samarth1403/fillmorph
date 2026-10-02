import { useEffect, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True while the visitor asks the system for less motion; the page's own loops stop then. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Calls `tick` every `intervalMs` while the tab is visible, unless the visitor prefers reduced
 * motion or `tick` is null (paused). A hidden tab skips ticks rather than queueing morphs nobody
 * sees.
 */
export function useAmbientTimer(tick: (() => void) | null, intervalMs: number): void {
  const isReduced = usePrefersReducedMotion();
  useEffect(() => {
    if (isReduced || tick === null) return;
    const id = window.setInterval(() => {
      if (!document.hidden) tick();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isReduced, tick, intervalMs]);
}
