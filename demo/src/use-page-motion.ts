import { type RefCallback, useCallback, useEffect, useState, useSyncExternalStore } from "react";

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

type OnScreenListener = (isOnScreen: boolean) => void;

/** One observer for the whole page: the icon wall alone watches 164 tiles. */
const onScreenListeners = new Map<Element, OnScreenListener>();
let onScreenObserver: IntersectionObserver | null = null;

function observeOnScreen(element: Element, listener: OnScreenListener): () => void {
  if (typeof IntersectionObserver === "undefined") {
    listener(true);
    return () => {};
  }
  onScreenObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) onScreenListeners.get(entry.target)?.(entry.isIntersecting);
  });
  onScreenListeners.set(element, listener);
  onScreenObserver.observe(element);
  return () => {
    onScreenListeners.delete(element);
    onScreenObserver?.unobserve(element);
  };
}

/**
 * Whether the element given the returned ref overlaps the viewport (false until the first
 * observation, a frame after mount). The page's ambient morphs only run where they can be seen:
 * off screen they would still cost a phone most of its frame budget (about 4 ms of morph math per
 * frame on a desktop, several times that on a phone), taken from the morph the visitor tapped.
 */
export function useIsOnScreen<T extends Element>(): [ref: RefCallback<T>, isOnScreen: boolean] {
  const [isOnScreen, setIsOnScreen] = useState(false);
  const ref = useCallback(
    (element: T | null) => (element === null ? undefined : observeOnScreen(element, setIsOnScreen)),
    [],
  );
  return [ref, isOnScreen];
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
