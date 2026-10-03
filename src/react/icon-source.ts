import { FillmorphMarkupError } from "fillmorph";
import { isValidElement, type ReactElement, useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * An icon as `fillmorph/react` accepts it (spec 09): full SVG markup (spec 02's contract), or a
 * React element that renders one, such as react-icons' `<FaHeart />`. An element is rendered to
 * markup with `react-dom/server`'s `renderToStaticMarkup` and then parsed like a string, so it
 * meets exactly the same contract: an element from a stroke icon set is still rejected.
 */
export type FillMorphIcon = string | ReactElement;

/**
 * Thrown (or passed to `onError`) when no SVG markup can be had from an icon: it is neither a
 * string nor a React element (e.g. the component `FaHeart` passed where the element `<FaHeart />`
 * was meant), or it is an element but `react-dom/server` couldn't be loaded to render it. It
 * extends core's `FillmorphMarkupError`, so it is one of `FillmorphError`'s members and code
 * already catching markup errors catches it too.
 */
export class FillmorphIconInputError extends FillmorphMarkupError {
  override name = "FillmorphIconInputError";
}

/**
 * An icon reduced to its markup, to the message of why it has none, or to neither while the
 * renderer an element needs is still loading (spec 09's lazy load). `isElement` marks markup
 * rendered from an element, whose root `<svg>` attributes `<FillMorph>` forwards (0.2.1). The
 * fields are primitives so hooks can memoize and compare on them: a JSX element is a new object
 * on every render, but the markup it renders to isn't.
 */
export type ResolvedIcon =
  | { markup: string; invalid: null; isElement: boolean }
  | { markup: null; invalid: string; isElement: boolean }
  | { markup: null; invalid: null; isElement: true };

type RenderToStaticMarkup = (element: ReactElement) => string;
/** What `fillmorph/react` uses from `react-dom/server`. */
export type ServerModule = { renderToStaticMarkup: RenderToStaticMarkup };

/**
 * Where loading `react-dom/server` stands. It is loaded at most once per page, and only when an
 * element icon first needs rendering, so string-only apps never load (or bundle a chunk for) it.
 */
export type IconRendererState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; render: RenderToStaticMarkup }
  | { status: "failed"; message: string };

const IDLE: IconRendererState = { status: "idle" };
const importServer = (): Promise<ServerModule> => import("react-dom/server");

// Module-level on purpose: the loaded module is shared by every instance on the page, and it is
// the only state here. Per-instance state stays in each component (architecture-context.md).
let rendererState: IconRendererState = IDLE;
let pendingLoad: Promise<void> | null = null;
let importer: () => Promise<ServerModule> = importServer;
const listeners = new Set<() => void>();

function setRendererState(next: IconRendererState): void {
  rendererState = next;
  for (const listener of listeners) listener();
}

function subscribeRenderer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Where loading `react-dom/server` stands now. Internal; not exported from `fillmorph/react`. */
export const getIconRendererState = (): IconRendererState => rendererState;
// Server rendering and hydration always see "idle": effects never run on the server, so an
// element icon renders as pending there and on the hydrating client alike, and nothing mismatches.
const getServerRendererState = (): IconRendererState => IDLE;

/**
 * Loads `react-dom/server` with a dynamic `import()`, once: later calls share the first one's
 * promise. A failed load (`react-dom` not installed, a chunk that didn't download) is final for the
 * page, and turns element icons into a `FillmorphIconInputError` naming the cause.
 */
export function loadIconRenderer(): Promise<void> {
  if (pendingLoad !== null) return pendingLoad;
  setRendererState({ status: "loading" });
  pendingLoad = importer().then(
    (server) => setRendererState({ status: "ready", render: server.renderToStaticMarkup }),
    (error: unknown) =>
      setRendererState({
        status: "failed",
        message: `fillmorph/react couldn't load \`react-dom/server\`, which it needs to render a React element icon to SVG markup: ${error instanceof Error ? error.message : String(error)}. Check that \`react-dom\` is installed and loads in this environment, or pass the icon as SVG markup instead.`,
      }),
  );
  return pendingLoad;
}

/**
 * Test-only: forgets the loaded renderer and swaps the importer, so tests can hold the load
 * open or make it fail. Not exported from `fillmorph/react`.
 */
export function resetIconRenderer(nextImporter: () => Promise<ServerModule> = importServer): void {
  importer = nextImporter;
  pendingLoad = null;
  setRendererState(IDLE);
}

function describeInvalid(icon: unknown): string {
  if (typeof icon === "function") {
    return "a function (did you pass a component, like `FaHeart`, instead of an element, like `<FaHeart />`?)";
  }
  if (icon === null) return "null";
  if (Array.isArray(icon)) return "an array";
  if (typeof icon === "object") return "an object that isn't a React element";
  return typeof icon === "undefined" ? "undefined" : `a ${typeof icon}`;
}

/**
 * Turns an icon into SVG markup, given where the renderer stands: a string as-is, always; a React
 * element via `renderToStaticMarkup` (which runs function components, `forwardRef` and context
 * defaults the way React does) once it's loaded, or pending until then. An error thrown while
 * rendering the element isn't a bad icon but a bug in it, so it propagates.
 */
export function resolveIcon(icon: unknown, renderer: IconRendererState): ResolvedIcon {
  if (typeof icon === "string") return { markup: icon, invalid: null, isElement: false };
  if (!isValidElement(icon)) {
    return {
      markup: null,
      invalid: `fillmorph/react expects an icon as full SVG markup (a string) or a React element such as \`<FaHeart />\`, but got ${describeInvalid(icon)}.`,
      isElement: false,
    };
  }
  if (renderer.status === "ready") {
    return { markup: renderer.render(icon), invalid: null, isElement: true };
  }
  if (renderer.status === "failed") {
    return { markup: null, invalid: renderer.message, isElement: true };
  }
  return { markup: null, invalid: null, isElement: true };
}

/** Whether a resolved icon is waiting for the renderer. */
export function isPendingIcon(icon: ResolvedIcon): boolean {
  return icon.markup === null && icon.invalid === null;
}

/**
 * Element props compared one level deep: the stand-in for markup comparison while an element
 * can't be rendered yet, so `<FaHeart />` recreated on every render still counts as one icon.
 */
function isSameElement(a: ReactElement, b: ReactElement): boolean {
  if (a.type !== b.type || a.key !== b.key) return false;
  const aProps = a.props as Record<string, unknown>;
  const bProps = b.props as Record<string, unknown>;
  const aKeys = Object.keys(aProps);
  return (
    aKeys.length === Object.keys(bProps).length &&
    aKeys.every((key) => Object.is(aProps[key], bProps[key]))
  );
}

/**
 * Whether two icons are the same icon: by the markup they resolve to, or, while either is still
 * pending, by element type and props (see `isSameElement`). Takes each icon with its resolution,
 * resolved against the same renderer state.
 */
export function isSameIcon(
  a: FillMorphIcon,
  aResolved: ResolvedIcon,
  b: FillMorphIcon,
  bResolved: ResolvedIcon,
): boolean {
  if (isPendingIcon(aResolved) || isPendingIcon(bResolved)) {
    return isValidElement(a) && isValidElement(b) ? isSameElement(a, b) : a === b;
  }
  return (
    aResolved.markup === bResolved.markup &&
    aResolved.invalid === bResolved.invalid &&
    aResolved.isElement === bResolved.isElement
  );
}

/** The rejection for an icon `resolveIcon` found no markup in, carrying its message. */
export function iconInputError(message: string): FillmorphIconInputError {
  return new FillmorphIconInputError(message);
}

function useResolution(icon: unknown, isPresent: boolean): ResolvedIcon | null {
  const renderer = useSyncExternalStore(
    subscribeRenderer,
    getIconRendererState,
    getServerRendererState,
  );
  const resolved = useMemo(
    () => (isPresent ? resolveIcon(icon, renderer) : null),
    [icon, isPresent, renderer],
  );
  const isPending = resolved !== null && isPendingIcon(resolved);
  useEffect(() => {
    if (isPending) void loadIconRenderer();
  }, [isPending]);
  return resolved;
}

/**
 * `icon` resolved against the renderer, re-resolved when the renderer finishes loading. An icon
 * pending on the renderer starts the load (from an effect, so rendering stays pure); a string
 * never does.
 */
export function useResolvedIcon(icon: FillMorphIcon): ResolvedIcon {
  return useResolution(icon, true) ?? { markup: null, invalid: null, isElement: true };
}

/**
 * An optional icon, e.g. an imperative override, resolved like `useResolvedIcon`. The icon sits
 * in a slot so that a `null` icon (invalid input) isn't mistaken for no icon.
 */
export function useResolvedSlot(slot: { icon: FillMorphIcon } | null): ResolvedIcon | null {
  return useResolution(slot?.icon, slot !== null);
}
