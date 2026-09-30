import type { Contour, SpringConfig } from "fillmorph";
import { createMorphDriver, type MorphDriver } from "fillmorph/dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type FillmorphError, parseIconMarkup } from "./parse-icon-markup";

/** What `useFillMorph` returns on every render. */
export type UseFillMorphResult = {
  /**
   * The shape to draw now, in spec 02's canonical frame: draw it inside a `CANONICAL_VIEW_BOX`
   * frame, never the icon's original `viewBox`. Empty only if no icon has parsed yet.
   */
  contours: Contour[];
  /**
   * Morphs to `icon` (full SVG markup) from whatever is on screen, like changing the hook's
   * `icon` argument, until that argument changes again. Stable across renders.
   */
  retarget: (icon: string) => void;
  /**
   * The rejection of the icon most recently asked for, or `null` if it parsed. While set, the
   * morph carries on toward the last icon that did parse.
   */
  error: FillmorphError | null;
};

/** The driver this hook owns, with what it needs to be torn down or compared. */
type LiveDriver = {
  driver: MorphDriver;
  config: SpringConfig | undefined;
  unsubscribe: () => void;
};

function disposeDriver(live: LiveDriver): void {
  live.unsubscribe();
  live.driver.stop();
}

/**
 * `springConfig` by value, so a caller passing a fresh object literal every render doesn't make
 * the driver look reconfigured every render.
 */
function useStableConfig(config: SpringConfig | undefined): SpringConfig | undefined {
  const stiffness = config?.stiffness;
  const damping = config?.damping;
  const mass = config?.mass;
  return useMemo(
    () =>
      stiffness === undefined || damping === undefined || mass === undefined
        ? undefined
        : { stiffness, damping, mass },
    [stiffness, damping, mass],
  );
}

/**
 * Spec 06's uncontrolled morph as a hook, for callers that draw the shape themselves (canvas,
 * composed SVG). `<FillMorph>` is built on it.
 *
 * It owns one `createMorphDriver` (`fillmorph/dom`) and adds only React wiring around it:
 * - the first icon to parse starts the driver; each later one is passed to its `retarget`, so an
 *   icon change mid-morph turns the motion without a snap (spec 05's interruption rule);
 * - a new `config` (compared by value) rebuilds the driver from the shape on screen toward the
 *   same target, since a driver's config is fixed at creation. Motion already in flight restarts
 *   from rest at that point, but nothing jumps;
 * - unmounting unsubscribes and calls `stop()`, so no frame runs afterwards.
 *
 * `icon` is full SVG markup (spec 02's contract). A rejected icon is reported through `error` and
 * never thrown by the hook; an invalid `config` throws from the driver, as `createMorphDriver`
 * does.
 */
export function useFillMorph(icon: string, config?: SpringConfig): UseFillMorphResult {
  // An imperative `retarget` wins until `icon` itself changes; tracking the `icon` it was made
  // under means a later change back to that value doesn't revive a stale override.
  const [request, setRequest] = useState<{ icon: string; override: string | null }>({
    icon,
    override: null,
  });
  if (request.icon !== icon) setRequest({ icon, override: null });
  const target = request.icon === icon && request.override !== null ? request.override : icon;

  const parsed = useMemo(() => parseIconMarkup(target), [target]);
  const springConfig = useStableConfig(config);

  const [emitted, setEmitted] = useState<Contour[] | null>(null);
  const liveRef = useRef<LiveDriver | null>(null);
  // Last good target, and the last shape the driver reported: where a rebuilt driver resumes.
  const headingRef = useRef<Contour[] | null>(null);
  const shownRef = useRef<Contour[] | null>(null);

  useEffect(() => {
    const to = parsed.contours ?? headingRef.current;
    if (to === null) return;
    const live = liveRef.current;
    if (live !== null && live.config === springConfig) {
      if (to !== headingRef.current) live.driver.retarget(to);
    } else {
      if (live !== null) disposeDriver(live);
      liveRef.current = null;
      const driver = createMorphDriver(shownRef.current ?? to, to, springConfig);
      const unsubscribe = driver.subscribe((contours) => {
        shownRef.current = contours;
        setEmitted(contours);
      });
      liveRef.current = { driver, config: springConfig, unsubscribe };
    }
    headingRef.current = to;
  }, [parsed, springConfig]);

  useEffect(
    () => () => {
      if (liveRef.current !== null) disposeDriver(liveRef.current);
      liveRef.current = null;
    },
    [],
  );

  const retarget = useCallback((next: string) => {
    setRequest((current) => ({ icon: current.icon, override: next }));
  }, []);

  return { contours: emitted ?? parsed.contours ?? [], retarget, error: parsed.error };
}
