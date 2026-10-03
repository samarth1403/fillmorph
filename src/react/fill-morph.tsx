import {
  CANONICAL_VIEW_BOX,
  type Contour,
  interpolate,
  renderContours,
  type SpringConfig,
} from "fillmorph";
import {
  type ForwardedRef,
  forwardRef,
  type ReactElement,
  type SVGProps,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FillMorphIcon } from "./icon-source";
import { useResolvedIcon } from "./icon-source";
import { type IconSvgProps, mergeSvgProps } from "./icon-svg-props";
import {
  type FillmorphError,
  type IconParse,
  useIconSvgProps,
  useLastParsedIcon,
  useParsedIcon,
} from "./parse-icon-markup";
import { useFillMorphWithIconProps } from "./use-fill-morph";

/**
 * Props forwarded untouched to the rendered root `<svg>` (`className`, `aria-label`, `fill`,
 * `style`, …). `viewBox` is left out because the root is always drawn in `CANONICAL_VIEW_BOX`,
 * and `to`/`onError` because `<FillMorph>` uses those names itself.
 */
export type FillMorphSvgProps = Omit<
  SVGProps<SVGSVGElement>,
  "children" | "onError" | "ref" | "to" | "viewBox"
>;

type FillMorphOwnProps = {
  /**
   * Full SVG markup (spec 02's contract), or a React element that renders it, such as
   * `<FaHeart />` (spec 09). Uncontrolled: the icon to show and morph to.
   */
  icon: FillMorphIcon;
  /** Spec 05's spring; the driver's default if omitted. Uncontrolled mode only. */
  springConfig?: SpringConfig;
  /**
   * Receives core's parse-time rejections. Without it, a rejection is thrown during render, for
   * the nearest error boundary. Either way the last shape that parsed stays on screen.
   */
  onError?: (error: FillmorphError) => void;
};

/**
 * `<FillMorph>`'s props. Passing `progress` on the first render selects controlled mode for the
 * component's lifetime; see `FillMorph`.
 */
export type FillMorphProps = FillMorphSvgProps &
  FillMorphOwnProps &
  (
    | { progress?: undefined; to?: undefined }
    | {
        /**
         * Controlled mode: how far from `icon` (0) to `to` (1) to draw. Clamped to [0, 1], since
         * the geometry can't extrapolate: past 1, a collapsing hole would turn inside out.
         */
        progress: number;
        /** Controlled mode: the icon at `progress` 1, as markup or an element like `icon`. */
        to: FillMorphIcon;
      }
  );

/** The imperative handle `<FillMorph ref>` exposes. */
export type FillMorphHandle = {
  /**
   * Uncontrolled mode: morphs to `icon` from whatever is on screen, the same path as changing the
   * `icon` prop. In controlled mode it does nothing but warn in development.
   */
  morphTo: (icon: FillMorphIcon) => void;
};

const VIEW_BOX = [
  CANONICAL_VIEW_BOX.x,
  CANONICAL_VIEW_BOX.y,
  CANONICAL_VIEW_BOX.width,
  CANONICAL_VIEW_BOX.height,
].join(" ");

// Bundlers replace `process.env.NODE_ENV`; without one, `process` may not exist at all.
declare const process: { env: { NODE_ENV?: string } } | undefined;

function warnInDevelopment(message: string): void {
  if (typeof process !== "undefined" && process?.env.NODE_ENV === "production") return;
  console.warn(`fillmorph: ${message}`);
}

/**
 * Surfaces a parse rejection: to `onError` once per distinct error, or, without `onError`, by
 * throwing during render so an error boundary catches it.
 */
function useSurfacedError(
  error: FillmorphError | null,
  onError: ((error: FillmorphError) => void) | undefined,
): void {
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  useEffect(() => {
    if (error !== null) onErrorRef.current?.(error);
  }, [error]);
  if (error !== null && onError === undefined) throw error;
}

/** The newest contours that parsed, so a rejection doesn't blank what was already showing. */
function useLastParsed(parsed: IconParse): Contour[] | null {
  const [last, setLast] = useState(parsed.contours);
  if (parsed.contours !== null && parsed.contours !== last) setLast(parsed.contours);
  return parsed.contours ?? last;
}

/**
 * The root `<svg>`. It defaults to `overflow="visible"`: a spring that overshoots draws its target
 * slightly larger than the frame (spec 05's overshoot pop, about 3% per side for an icon that
 * fills it), and browsers clip an inline `<svg>` to its box by default, which would silently cut
 * the bounce off. It's a presentation attribute, not inline style, so any CSS the caller sets (a
 * class or `style`) still wins, and so does an `overflow` prop. Geometry inside the frame draws
 * the same either way.
 *
 * An icon given as a React element also lends its rendered root `<svg>` attributes (`fill`,
 * `width`, `class`, `style`, `aria-*`, …; see `toIconSvgProps` for the few fillmorph keeps), with
 * the caller's own props winning and `className`/`style` combining (spec 09, 0.2.1).
 */
const MorphSvg = ({
  contours,
  svgProps,
  iconSvgProps,
}: {
  contours: Contour[];
  svgProps: FillMorphSvgProps;
  iconSvgProps: IconSvgProps | null;
}): ReactElement => {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: the caller names it (or hides it) via passthrough `aria-*`/`role` props
    <svg overflow="visible" {...mergeSvgProps(iconSvgProps, svgProps)} viewBox={VIEW_BOX}>
      <path d={renderContours(contours)} />
    </svg>
  );
};

type ModeProps = {
  icon: FillMorphIcon;
  onError: ((error: FillmorphError) => void) | undefined;
  svgProps: FillMorphSvgProps;
  handleRef: ForwardedRef<FillMorphHandle>;
};

const UncontrolledFillMorph = ({
  icon,
  springConfig,
  onError,
  svgProps,
  handleRef,
}: ModeProps & { springConfig: SpringConfig | undefined }): ReactElement => {
  const { contours, retarget, error, iconSvgProps } = useFillMorphWithIconProps(icon, springConfig);
  useImperativeHandle(handleRef, () => ({ morphTo: retarget }), [retarget]);
  useSurfacedError(error, onError);
  return <MorphSvg contours={contours} svgProps={svgProps} iconSvgProps={iconSvgProps} />;
};

const ControlledFillMorph = ({
  icon,
  to,
  progress,
  onError,
  svgProps,
  handleRef,
}: ModeProps & { to: FillMorphIcon; progress: number }): ReactElement => {
  const fromIcon = useResolvedIcon(icon);
  const toIcon = useResolvedIcon(to);
  const fromParsed = useParsedIcon(fromIcon);
  const toParsed = useParsedIcon(toIcon);
  const from = useLastParsed(fromParsed);
  const target = useLastParsed(toParsed);
  const fromShown = useLastParsedIcon(fromIcon, fromParsed);
  const toShown = useLastParsedIcon(toIcon, toParsed);
  useImperativeHandle(
    handleRef,
    () => ({
      morphTo: () =>
        warnInDevelopment(
          "morphTo() does nothing on a controlled <FillMorph> (one given `progress`); change `icon`, `to` or `progress` instead.",
        ),
    }),
    [],
  );
  useSurfacedError(fromParsed.error, onError);
  useSurfacedError(toParsed.error, onError);

  // Non-finite progress is left for `interpolate` to reject rather than clamped into range.
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : progress;
  const contours = useMemo(
    () => (from !== null && target !== null ? interpolate(from, target, clamped) : (from ?? [])),
    [from, target, clamped],
  );
  // Attributes don't interpolate: they snap from `icon`'s to `to`'s halfway through.
  const iconSvgProps = useIconSvgProps(clamped < 0.5 ? fromShown : toShown);
  return <MorphSvg contours={contours} svgProps={svgProps} iconSvgProps={iconSvgProps} />;
};

/**
 * Morphs filled SVG icons (spec 06), rendering one `<svg viewBox={CANONICAL_VIEW_BOX}>` with a
 * single `<path>` drawn by core's `renderContours`. Icons are full SVG markup or React elements
 * that render it (`icon={<FaHeart />}`, spec 09); either way they must meet spec 02's contract.
 *
 * - **Uncontrolled** (no `progress`): shows `icon`; changing it springs to the new icon from
 *   whatever is on screen, interruptions included (`useFillMorph`, over `fillmorph/dom`'s
 *   driver).
 * - **Controlled** (`progress` and `to`): draws `interpolate(icon, to, progress)`, with no timer or
 *   animation frame of its own, so the caller owns the timing.
 * - **Imperative:** `ref.current.morphTo(icon)`, uncontrolled mode only.
 *
 * The mode is fixed by whether `progress` was passed on the first render, as React does for
 * controlled inputs; switching later only warns in development.
 *
 * The `<svg>` allows overflow by default, so an overshooting spring's bounce isn't clipped at the
 * frame's edge; override it with CSS or an `overflow` prop if the icon must stay inside its box.
 */
const FillMorph = forwardRef<FillMorphHandle, FillMorphProps>((props, ref) => {
  const { icon, progress, to, springConfig, onError, ...svgProps } = props;
  const [isControlled] = useState(progress !== undefined);
  const hasWarnedRef = useRef(false);
  useEffect(() => {
    if (isControlled === (progress !== undefined) || hasWarnedRef.current) return;
    hasWarnedRef.current = true;
    warnInDevelopment(
      `a <FillMorph> can't switch between controlled and uncontrolled mode; it stays ${isControlled ? "controlled" : "uncontrolled"}, as chosen by whether \`progress\` was passed on its first render.`,
    );
  }, [isControlled, progress]);

  return isControlled ? (
    <ControlledFillMorph
      icon={icon}
      to={to ?? icon}
      progress={progress ?? 0}
      onError={onError}
      svgProps={svgProps}
      handleRef={ref}
    />
  ) : (
    <UncontrolledFillMorph
      icon={icon}
      springConfig={springConfig}
      onError={onError}
      svgProps={svgProps}
      handleRef={ref}
    />
  );
});
FillMorph.displayName = "FillMorph";

export default FillMorph;
