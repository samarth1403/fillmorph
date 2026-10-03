import type { Contour, SpringConfig } from "fillmorph";
import { createMorphDriver, type MorphDriver } from "fillmorph/dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type FillMorphIcon, isSameIcon, useResolvedIcon, useResolvedSlot } from "./icon-source";
import type { IconSvgProps } from "./icon-svg-props";
import {
  type FillmorphError,
  useIconSvgProps,
  useLastParsedIcon,
  useParsedIcon,
} from "./parse-icon-markup";

/** What `useFillMorph` returns on every render. */
export type UseFillMorphResult = {
  /**
   * The shape to draw now, in spec 02's canonical frame: draw it inside a `CANONICAL_VIEW_BOX`
   * frame, never the icon's original `viewBox`. Empty only if no icon has parsed yet: with `error`
   * also `null`, that means the first icon is an element still waiting for `react-dom/server` to
   * load (once per page, spec 09).
   */
  contours: Contour[];
  /**
   * Morphs to `icon` (full SVG markup or a React element) from whatever is on screen, like
   * changing the hook's `icon` argument, until that argument changes again. Stable across renders.
   */
  retarget: (icon: FillMorphIcon) => void;
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
 * `icon` is full SVG markup (spec 02's contract) or a React element that renders it (spec 09).
 * Icons are compared by markup, so an element recreated every render (`<FaHeart />`) is the same
 * icon each time; it is re-rendered to markup whenever its identity changes, which a module-level
 * or memoized element avoids. A rejected icon is reported through `error` and never thrown by the
 * hook; an invalid `config` throws from the driver, as `createMorphDriver` does.
 *
 * Elements need `react-dom/server`, loaded on first use (spec 09). Until it arrives, an element
 * target is pending: the shape on screen carries on as if the target hadn't changed yet, and the
 * very first icon, if it's an element, shows nothing. Strings never wait.
 */
export function useFillMorph(icon: FillMorphIcon, config?: SpringConfig): UseFillMorphResult {
  const { contours, retarget, error } = useFillMorphWithIconProps(icon, config);
  return { contours, retarget, error };
}

/**
 * `useFillMorph`, plus the root `<svg>` attributes of the icon being morphed to, if it's an
 * element: what `<FillMorph>` forwards to its own `<svg>` (0.2.1). They switch the moment a new
 * icon parses (a snap, not animated); a rejected or still-loading icon leaves them as they were.
 * Internal: not exported from `fillmorph/react`.
 */
export function useFillMorphWithIconProps(
  icon: FillMorphIcon,
  config?: SpringConfig,
): UseFillMorphResult & { iconSvgProps: IconSvgProps | null } {
  const resolved = useResolvedIcon(icon);
  // An imperative `retarget` wins until `icon` itself changes; tracking the `icon` it was made
  // under means a later change back to that value doesn't revive a stale override.
  const [request, setRequest] = useState<{
    icon: FillMorphIcon;
    override: { icon: FillMorphIcon } | null;
  }>({ icon, override: null });
  const requestIcon = useResolvedIcon(request.icon);
  const override = useResolvedSlot(request.override);
  const isCurrentIcon = isSameIcon(request.icon, requestIcon, icon, resolved);
  if (!isCurrentIcon) setRequest({ icon, override: null });
  const target = isCurrentIcon && override !== null ? override : resolved;

  const parsed = useParsedIcon(target);
  const iconSvgProps = useIconSvgProps(useLastParsedIcon(target, parsed));
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

  const retarget = useCallback((next: FillMorphIcon) => {
    setRequest((current) => ({ icon: current.icon, override: { icon: next } }));
  }, []);

  return {
    contours: emitted ?? parsed.contours ?? [],
    retarget,
    error: parsed.error,
    iconSvgProps,
  };
}
