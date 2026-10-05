// @vitest-environment happy-dom

import { HeartIcon } from "@heroicons/react/24/solid";
import {
  advanceMorph,
  type Contour,
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  interpolate,
  type MorphState,
  parseIcon,
  renderContours,
  renderLayers,
  retargetMorph,
  type SpringConfig,
  startMorph,
} from "fillmorph";
import { createMorphDriver } from "fillmorph/dom";
import { Circle, Heart } from "lucide-react";
import {
  act,
  Component,
  type CSSProperties,
  createRef,
  type ReactElement,
  type ReactNode,
  StrictMode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaCircle, FaHeart, FaRegCircle } from "react-icons/fa6";
import {
  MdFavorite,
  MdSignalWifi1Bar,
  MdSignalWifi1BarLock,
  MdSignalWifi2Bar,
  MdSignalWifi2BarLock,
  MdSignalWifi3Bar,
  MdSignalWifi3BarLock,
  MdWifiCalling1,
  MdWifiCalling2,
} from "react-icons/md";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FillMorph, { type FillMorphHandle } from "./fill-morph";
import { type FillMorphIcon, FillmorphIconInputError, getIconRendererState } from "./icon-source";
import { readRootSvgAttributes } from "./icon-svg-props";
import type { FillmorphError } from "./parse-icon-markup";
import {
  CIRCLE,
  DIAMOND,
  enableActEnvironment,
  FA_SOLID_HEART,
  type FakeFrames,
  FRAME_MS,
  holdIconRendererLoad,
  installFakeAnimationFrames,
  LUCIDE_HEART,
  MALFORMED,
  type Mounted,
  mount,
  pathData,
  preloadIconRenderer,
  RING,
  SQUARE,
  STROKE_ONLY,
} from "./test-helpers";

const CONFIG: SpringConfig = { stiffness: 170, damping: 26, mass: 1 };

let frames: FakeFrames;
let now = 0;
let mounted: Mounted[] = [];

/** Runs the next animation frame, one frame length after the previous one. */
function nextFrame(): void {
  now += FRAME_MS;
  frames.frame(now);
}

/** Runs frames until no driver has one pending; returns how many ran. */
function runUntilIdle(limit = 1000): number {
  let count = 0;
  while (frames.pendingCount() > 0) {
    if (++count > limit) throw new Error("the morph never settled");
    nextFrame();
  }
  return count;
}

function track(tree: Mounted): Mounted {
  mounted.push(tree);
  return tree;
}

const contoursOf = (icon: string): Contour[] => parseIcon(icon).contours;
const dOf = (icon: string): string => renderContours(contoursOf(icon));

// Element icons resolve synchronously once react-dom/server is loaded; the "first element load"
// tests below hold that load open on purpose, and every test after them starts loaded again.
beforeAll(preloadIconRenderer);

beforeEach(() => {
  enableActEnvironment();
  frames = installFakeAnimationFrames();
  now = 0;
});

afterEach(async () => {
  for (const tree of mounted) tree.unmount();
  mounted = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (getIconRendererState().status !== "ready") await preloadIconRenderer();
});

/**
 * Records what an error boundary caught, so a render-time throw can be asserted; `onCatch` hands
 * over the error itself.
 */
class Boundary extends Component<
  { children: ReactNode; onCatch?: (error: unknown) => void },
  { error: unknown }
> {
  override state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }
  override componentDidCatch(error: unknown): void {
    this.props.onCatch?.(error);
  }
  override render(): ReactNode {
    return this.state.error === null ? this.props.children : <p>caught</p>;
  }
}

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return null;
}

describe("<FillMorph> rendering", () => {
  it("renders one <svg> in CANONICAL_VIEW_BOX with one <path> showing the icon from mount", () => {
    const { container } = track(mount(<FillMorph icon={DIAMOND} springConfig={CONFIG} />));
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]?.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(container.querySelectorAll("path")).toHaveLength(1);
    // Mounted, the driver shows its at-rest `from`: the same diamond, as `interpolate` lays it out.
    const diamond = contoursOf(DIAMOND);
    expect(pathData(container)).toBe(renderContours(interpolate(diamond, diamond, 0)));
    runUntilIdle();
    // The diamond's native frame is 48 units, but it's drawn in canonical coordinates.
    expect(pathData(container)).toBe(dOf(DIAMOND));
  });

  it("draws the icon in its very first render, before any effect or frame runs", () => {
    // Server rendering runs no effects, so this is exactly what the first paint gets.
    const html = renderToStaticMarkup(<FillMorph icon={DIAMOND} springConfig={CONFIG} />);
    expect(html).toBe(
      `<svg overflow="visible" viewBox="0 0 100 100"><path d="${dOf(DIAMOND)}"></path></svg>`,
    );
    expect(frames.pendingCount()).toBe(0);
  });

  it("forwards className and standard SVG props to the root <svg>", () => {
    const { container } = track(
      mount(
        <FillMorph
          icon={SQUARE}
          className="icon"
          aria-label="Square"
          role="img"
          fill="currentColor"
          data-testid="morph"
        />,
      ),
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("icon");
    expect(svg?.getAttribute("aria-label")).toBe("Square");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
    expect(svg?.getAttribute("data-testid")).toBe("morph");
  });

  it("lets an overshooting spring's pop draw past the frame, in both modes, by default", () => {
    // Uncontrolled and controlled render through the same root <svg>.
    const uncontrolled = renderToStaticMarkup(<FillMorph icon={SQUARE} />);
    const controlled = renderToStaticMarkup(
      <FillMorph icon={SQUARE} to={DIAMOND} progress={0.5} />,
    );
    for (const html of [uncontrolled, controlled])
      expect(html).toMatch(/^<svg overflow="visible" /);
  });

  it("gives way to the caller's own overflow: an `overflow` prop, or CSS via style or class", () => {
    const { container } = track(
      mount(<FillMorph icon={SQUARE} overflow="hidden" style={{ overflow: "clip" }} />),
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("overflow")).toBe("hidden");
    // Inline style (like any CSS rule) outranks a presentation attribute in the cascade.
    expect(svg?.getAttribute("style")).toBe("overflow: clip;");
  });
});

describe("<FillMorph> identity", () => {
  it("keeps its name for React DevTools and React's warnings (arrow-function conversion)", () => {
    expect(FillMorph.displayName).toBe("FillMorph");
  });
});

describe("<FillMorph> uncontrolled mode", () => {
  it("morphs smoothly to a new icon without ever drawing a blank frame, and settles on it", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    runUntilIdle();
    const before = pathData(tree.container);

    tree.render(<FillMorph icon={CIRCLE} springConfig={CONFIG} />);
    // The prop change alone draws nothing new: the shape moves only with the next frame.
    expect(pathData(tree.container)).toBe(before);

    const seen = new Set<string>();
    while (frames.pendingCount() > 0) {
      nextFrame();
      const d = pathData(tree.container);
      expect(d).not.toBe("");
      seen.add(d);
    }
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
    // Many distinct in-between shapes, not a swap.
    expect(seen.size).toBeGreaterThan(20);
  });

  it("matches core's own spring sequence frame for frame, including a mid-flight icon change", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    runUntilIdle();

    // The same morph through core's pure state functions: settled on the square, then two legs.
    let model: MorphState = advanceMorph(
      {
        ...startMorph(contoursOf(SQUARE), contoursOf(SQUARE)),
        spring: { position: 1, velocity: 0 },
      },
      CONFIG,
      0,
    );
    model = retargetMorph(model, contoursOf(RING), CONFIG);
    tree.render(<FillMorph icon={RING} springConfig={CONFIG} />);

    // The driver's first frame after a rest steps by 0.
    let lastTime: number | null = null;
    const step = () => {
      nextFrame();
      model = advanceMorph(model, CONFIG, lastTime === null ? 0 : (now - lastTime) / 1000);
      lastTime = now;
      expect(pathData(tree.container)).toBe(renderContours(model.contours));
    };
    for (let i = 0; i < 12; i++) step();
    const velocityBefore = model.spring.velocity;
    expect(velocityBefore).toBeGreaterThan(0);

    // Interrupt: change `icon` again while the ring is still forming.
    const beforeInterrupt = pathData(tree.container);
    model = retargetMorph(model, contoursOf(DIAMOND), CONFIG);
    tree.render(<FillMorph icon={DIAMOND} springConfig={CONFIG} />);
    expect(pathData(tree.container)).toBe(beforeInterrupt);
    // The new leg keeps moving (its velocity converted to the new leg's units): no restart from
    // rest.
    expect(model.spring.velocity).toBeGreaterThan(0);
    expect(velocityBefore).toBeGreaterThan(0);

    while (frames.pendingCount() > 0) step();
    expect(pathData(tree.container)).toBe(dOf(DIAMOND));
  });

  it("follows a rapid series of icon changes to the last one", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    for (const icon of [CIRCLE, RING, DIAMOND, CIRCLE]) {
      tree.render(<FillMorph icon={icon} springConfig={CONFIG} />);
      nextFrame();
      nextFrame();
    }
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
  });

  it("rebuilds the spring on a new springConfig without jumping, and still settles on the target", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    runUntilIdle();
    tree.render(<FillMorph icon={CIRCLE} springConfig={CONFIG} />);
    for (let i = 0; i < 8; i++) nextFrame();

    tree.render(
      <FillMorph icon={CIRCLE} springConfig={{ stiffness: 400, damping: 40, mass: 1 }} />,
    );
    expect(pathData(tree.container)).not.toBe(dOf(CIRCLE));
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
  });

  it("treats an equal springConfig object as unchanged", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={{ ...CONFIG }} />));
    runUntilIdle();
    tree.render(<FillMorph icon={SQUARE} springConfig={{ ...CONFIG }} />);
    // A rebuilt driver would schedule a frame; the settled one doesn't.
    expect(frames.pendingCount()).toBe(0);
  });

  it("works under StrictMode's double-run effects and leaves no loop behind", () => {
    const tree = track(
      mount(
        <StrictMode>
          <FillMorph icon={SQUARE} springConfig={CONFIG} />
        </StrictMode>,
      ),
    );
    tree.render(
      <StrictMode>
        <FillMorph icon={RING} springConfig={CONFIG} />
      </StrictMode>,
    );
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(RING));
    expect(frames.pendingCount()).toBe(0);
  });
});

describe("<FillMorph> unmounting", () => {
  it("unmounting mid-morph cancels the loop and logs nothing", () => {
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    const tree = mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />);
    tree.render(<FillMorph icon={CIRCLE} springConfig={CONFIG} />);
    for (let i = 0; i < 5; i++) nextFrame();
    expect(frames.pendingCount()).toBe(1);

    tree.unmount();
    expect(frames.pendingCount()).toBe(0);
    for (let i = 0; i < 5; i++) nextFrame();
    expect(frames.pendingCount()).toBe(0);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("<FillMorph> with two instances", () => {
  it("animates both at once, each at the pace it has alone", () => {
    const alone = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    runUntilIdle();
    alone.render(<FillMorph icon={CIRCLE} springConfig={CONFIG} />);
    const framesAlone = runUntilIdle();
    alone.unmount();
    mounted = [];

    const pair = (a: string, b: string) => (
      <>
        <FillMorph icon={a} springConfig={CONFIG} />
        <FillMorph icon={b} springConfig={CONFIG} />
      </>
    );
    const tree = track(mount(pair(SQUARE, DIAMOND)));
    runUntilIdle();
    tree.render(pair(CIRCLE, RING));
    expect(frames.pendingCount()).toBe(2);

    let framesTogether = 0;
    while (frames.pendingCount() > 0) {
      const [firstBefore, secondBefore] = [
        pathData(tree.container, 0),
        pathData(tree.container, 1),
      ];
      nextFrame();
      framesTogether++;
      if (frames.pendingCount() === 2) {
        expect(pathData(tree.container, 0)).not.toBe(firstBefore);
        expect(pathData(tree.container, 1)).not.toBe(secondBefore);
      }
    }
    expect(framesTogether).toBe(framesAlone);
    expect(pathData(tree.container, 0)).toBe(dOf(CIRCLE));
    expect(pathData(tree.container, 1)).toBe(dOf(RING));
  });

  it("unmounting one instance leaves the other animating", () => {
    const both = (showFirst: boolean, a: string, b: string) => (
      <>
        {showFirst ? <FillMorph icon={a} springConfig={CONFIG} /> : null}
        <FillMorph icon={b} springConfig={CONFIG} />
      </>
    );
    const tree = track(mount(both(true, SQUARE, SQUARE)));
    runUntilIdle();
    tree.render(both(true, CIRCLE, RING));
    nextFrame();
    tree.render(both(false, CIRCLE, RING));
    expect(frames.pendingCount()).toBe(1);
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(RING));
  });
});

describe("<FillMorph> imperative handle", () => {
  it("morphTo morphs like an icon prop change", () => {
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} springConfig={CONFIG} />));
    runUntilIdle();
    act(() => ref.current?.morphTo(RING));
    nextFrame();
    expect(pathData(tree.container)).not.toBe(dOf(SQUARE));
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(RING));
  });

  it("an icon prop change takes over from an earlier morphTo, and doesn't revive it later", () => {
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} springConfig={CONFIG} />));
    act(() => ref.current?.morphTo(RING));
    runUntilIdle();
    tree.render(<FillMorph ref={ref} icon={CIRCLE} springConfig={CONFIG} />);
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
    tree.render(<FillMorph ref={ref} icon={SQUARE} springConfig={CONFIG} />);
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(SQUARE));
  });

  it("morphTo is a no-op with a warning in controlled mode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} to={CIRCLE} progress={0.3} />));
    const before = pathData(tree.container);
    act(() => ref.current?.morphTo(RING));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/morphTo\(\) does nothing on a controlled/);
    expect(pathData(tree.container)).toBe(before);
    expect(frames.pendingCount()).toBe(0);
  });
});

describe("<FillMorph> controlled mode", () => {
  it("draws interpolate(icon, to, progress) with no animation frame, identically every time", () => {
    const expected = renderContours(interpolate(contoursOf(SQUARE), contoursOf(RING), 0.4));
    const tree = track(mount(<FillMorph icon={SQUARE} to={RING} progress={0.4} />));
    expect(pathData(tree.container)).toBe(expected);
    tree.render(<FillMorph icon={SQUARE} to={RING} progress={0.4} />);
    expect(pathData(tree.container)).toBe(expected);

    const other = track(mount(<FillMorph icon={SQUARE} to={RING} progress={0.4} />));
    expect(other.container.innerHTML).toBe(tree.container.innerHTML);
    expect(frames.pendingCount()).toBe(0);
  });

  it("follows the progress prop and nothing else", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} to={CIRCLE} progress={0} />));
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      tree.render(<FillMorph icon={SQUARE} to={CIRCLE} progress={progress} />);
      expect(pathData(tree.container)).toBe(
        renderContours(interpolate(contoursOf(SQUARE), contoursOf(CIRCLE), progress)),
      );
      expect(frames.pendingCount()).toBe(0);
    }
  });

  it("clamps progress to [0, 1]", () => {
    const at = (progress: number) =>
      pathData(track(mount(<FillMorph icon={RING} to={SQUARE} progress={progress} />)).container);
    expect(at(1.6)).toBe(at(1));
    expect(at(-0.4)).toBe(at(0));
  });

  it("draws NaN as 0 and clamps ±Infinity, without throwing (spec 10 #2)", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    const at = (progress: number) =>
      pathData(
        track(mount(<FillMorph icon={RING} to={SQUARE} progress={progress} onError={onError} />))
          .container,
      );
    expect(at(Number.NaN)).toBe(at(0));
    expect(at(Number.POSITIVE_INFINITY)).toBe(at(1));
    expect(at(Number.NEGATIVE_INFINITY)).toBe(at(0));
    expect(at(0)).not.toBe(at(1));
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps drawing when a live progress turns NaN mid-scroll, e.g. 0 / 0", () => {
    const tree = track(mount(<FillMorph icon={RING} to={SQUARE} progress={0.5} />));
    tree.render(<FillMorph icon={RING} to={SQUARE} progress={0 / 0} />);
    expect(pathData(tree.container)).toBe(
      renderContours(interpolate(contoursOf(RING), contoursOf(SQUARE), 0)),
    );
  });

  it("warns, and stays controlled, if progress is dropped later", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tree = track(mount(<FillMorph icon={SQUARE} to={CIRCLE} progress={0.5} />));
    tree.render(<FillMorph icon={SQUARE} />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/can't switch between controlled and uncontrolled/);
    expect(frames.pendingCount()).toBe(0);
  });
});

describe("<FillMorph> errors", () => {
  it("passes a malformed icon's error to onError and renders without throwing", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    const tree = track(mount(<FillMorph icon={MALFORMED} onError={onError} />));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(FillmorphMarkupError);
    expect(pathData(tree.container)).toBe("");
  });

  it("throws a malformed icon's error to the nearest error boundary without onError", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = track(
      mount(
        <Boundary>
          <FillMorph icon={MALFORMED} />
        </Boundary>,
      ),
    );
    expect(tree.container.textContent).toBe("caught");
  });

  it("keeps the last good shape after a bad icon prop, and resumes on the next good one", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} onError={onError} />));
    runUntilIdle();
    const square = pathData(tree.container);

    tree.render(<FillMorph icon={STROKE_ONLY} springConfig={CONFIG} onError={onError} />);
    runUntilIdle();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(FillmorphIncompatibleIconError);
    expect(pathData(tree.container)).toBe(square);

    tree.render(<FillMorph icon={CIRCLE} springConfig={CONFIG} onError={onError} />);
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("reports a bad morphTo icon the same way, keeping the shape", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} onError={onError} />));
    runUntilIdle();
    const square = pathData(tree.container);
    act(() => ref.current?.morphTo(MALFORMED));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(pathData(tree.container)).toBe(square);
  });

  it("throws a bad morphTo icon to the error boundary without onError", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ref = createRef<FillMorphHandle>();
    const tree = track(
      mount(
        <Boundary>
          <FillMorph ref={ref} icon={SQUARE} />
        </Boundary>,
      ),
    );
    act(() => ref.current?.morphTo(MALFORMED));
    // The next render throws; flush it.
    tree.render(
      <Boundary>
        <FillMorph ref={ref} icon={SQUARE} />
      </Boundary>,
    );
    expect(tree.container.textContent).toBe("caught");
  });

  // Spec 10 #3: a partial config used to fall back to the default spring silently.
  const invalidConfigs: [string, Partial<SpringConfig>][] = [
    ["a partial springConfig", { stiffness: 2000 }],
    ["an out-of-range springConfig", { stiffness: -1, damping: 26, mass: 1 }],
    ["an empty springConfig", {}],
  ];
  it.each(invalidConfigs)(
    "rejects %s with the same RangeError as createMorphDriver",
    (_label, config) => {
      const expected = captureError(() =>
        createMorphDriver(contoursOf(SQUARE), contoursOf(SQUARE), config as SpringConfig),
      );
      expect(expected).toBeInstanceOf(RangeError);

      vi.spyOn(console, "error").mockImplementation(() => {});
      let caught: unknown = null;
      track(
        mount(
          <Boundary onCatch={(error) => (caught = error)}>
            <FillMorph icon={SQUARE} springConfig={config as SpringConfig} />
          </Boundary>,
        ),
      );
      expect(caught).toBeInstanceOf(RangeError);
      expect((caught as RangeError).message).toBe((expected as RangeError).message);
    },
  );

  it("controlled mode reports a bad `to` and keeps drawing the last good pair", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    const tree = track(
      mount(<FillMorph icon={SQUARE} to={CIRCLE} progress={0.5} onError={onError} />),
    );
    const good = pathData(tree.container);
    tree.render(<FillMorph icon={SQUARE} to={MALFORMED} progress={0.5} onError={onError} />);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(pathData(tree.container)).toBe(good);
  });
});

describe("<FillMorph> with icon elements (spec 09)", () => {
  it("draws react-icons' <FaHeart /> exactly as the same icon's markup string", () => {
    const fromElement = track(mount(<FillMorph icon={<FaHeart />} />));
    const fromString = track(mount(<FillMorph icon={FA_SOLID_HEART} />));
    expect(pathData(fromElement.container)).not.toBe("");
    expect(pathData(fromElement.container)).toBe(pathData(fromString.container));
  });

  it("morphs between elements and settles on the target, frame for frame like markup strings", () => {
    const elements = track(mount(<FillMorph icon={<FaHeart />} springConfig={CONFIG} />));
    const strings = track(mount(<FillMorph icon={FA_SOLID_HEART} springConfig={CONFIG} />));
    const circle = renderToStaticMarkup(<FaCircle />);
    elements.render(<FillMorph icon={<FaCircle />} springConfig={CONFIG} />);
    strings.render(<FillMorph icon={circle} springConfig={CONFIG} />);
    let frameCount = 0;
    while (frames.pendingCount() > 0) {
      if (++frameCount > 1000) throw new Error("the morph never settled");
      nextFrame();
      expect(pathData(elements.container)).toBe(pathData(strings.container));
    }
    expect(frameCount).toBeGreaterThan(2);
    expect(pathData(elements.container)).toBe(dOf(circle));
  });

  it("mixes elements and strings freely in one morph", () => {
    const tree = track(mount(<FillMorph icon={<FaHeart />} springConfig={CONFIG} />));
    tree.render(<FillMorph icon={CIRCLE} springConfig={CONFIG} />);
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
  });

  it("treats a fresh but identical element on every render as the same icon", () => {
    const tree = track(mount(<FillMorph icon={<FaHeart />} springConfig={CONFIG} />));
    runUntilIdle();
    const settled = pathData(tree.container);
    tree.render(<FillMorph icon={<FaHeart />} springConfig={CONFIG} />);
    expect(frames.pendingCount()).toBe(0);
    expect(pathData(tree.container)).toBe(settled);
  });

  it("keeps a morphTo target across parent re-renders that recreate the icon element", () => {
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={<FaHeart />} springConfig={CONFIG} />));
    act(() => ref.current?.morphTo(<FaRegCircle />));
    nextFrame();
    tree.render(<FillMorph ref={ref} icon={<FaHeart />} springConfig={CONFIG} />);
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(renderToStaticMarkup(<FaRegCircle />)));
  });

  it("morphTo accepts an element", () => {
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} springConfig={CONFIG} />));
    act(() => ref.current?.morphTo(<FaHeart />));
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(FA_SOLID_HEART));
  });

  it("controlled mode takes elements for icon and to, identically to their markup", () => {
    const circle = renderToStaticMarkup(<FaCircle />);
    const fromElements = track(
      mount(<FillMorph icon={<FaHeart />} to={<FaCircle />} progress={0.4} />),
    );
    const fromStrings = track(
      mount(<FillMorph icon={FA_SOLID_HEART} to={circle} progress={0.4} />),
    );
    expect(pathData(fromElements.container)).toBe(
      renderContours(interpolate(contoursOf(FA_SOLID_HEART), contoursOf(circle), 0.4)),
    );
    expect(pathData(fromElements.container)).toBe(pathData(fromStrings.container));
    expect(frames.pendingCount()).toBe(0);
  });

  it("draws Material Design's <MdFavorite />, skipping its invisible bounding-box path (spec 10 #1)", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    const tree = track(mount(<FillMorph icon={<MdFavorite />} onError={onError} />));
    expect(onError).not.toHaveBeenCalled();
    const heartOnly = renderToStaticMarkup(<MdFavorite />).replace(
      /<path fill="none" d="M0 0h24v24H0z"><\/path>/,
      "",
    );
    expect(heartOnly).not.toBe(renderToStaticMarkup(<MdFavorite />));
    expect(pathData(tree.container)).toBe(dOf(heartOnly));
  });

  it("rejects lucide-react's <Circle /> (no <path>) as a stroke icon (spec 10 #1)", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    track(mount(<FillMorph icon={<Circle />} onError={onError} />));
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(FillmorphIncompatibleIconError);
    expect(onError.mock.calls[0]?.[0].message).toMatch(/<circle> element has fill: none/);
  });

  it("still rejects a stroke icon set's element (lucide-react), with the error its markup gets", () => {
    const fromElement = vi.fn<(error: FillmorphError) => void>();
    const fromString = vi.fn<(error: FillmorphError) => void>();
    track(mount(<FillMorph icon={<Heart />} onError={fromElement} />));
    track(mount(<FillMorph icon={LUCIDE_HEART} onError={fromString} />));
    const elementError = fromElement.mock.calls[0]?.[0];
    const stringError = fromString.mock.calls[0]?.[0];
    expect(elementError).toBeInstanceOf(FillmorphIncompatibleIconError);
    expect(stringError).toBeInstanceOf(FillmorphIncompatibleIconError);
    expect(elementError?.message).toBe(stringError?.message);
    expect(elementError?.message).toMatch(/fill: none.*filled icons only/);
  });

  it("throws a stroke icon element's rejection to the error boundary without onError", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = track(
      mount(
        <Boundary>
          <FillMorph icon={<Heart />} />
        </Boundary>,
      ),
    );
    expect(tree.container.textContent).toBe("caught");
  });

  it("reports an icon that is neither markup nor an element as a FillmorphIconInputError, once", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    // A component where an element was meant: the classic slip this error names.
    const component = FaHeart as unknown as FillMorphIcon;
    const tree = track(mount(<FillMorph icon={component} onError={onError} />));
    tree.render(<FillMorph icon={component} onError={onError} />);
    expect(onError).toHaveBeenCalledTimes(1);
    const error = onError.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(FillmorphIconInputError);
    expect(error).toBeInstanceOf(FillmorphMarkupError);
    expect(error?.message).toMatch(/instead of an element/);
    expect(pathData(tree.container)).toBe("");
  });

  it("throws an invalid icon input to the error boundary without onError", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = track(
      mount(
        <Boundary>
          <FillMorph icon={42 as unknown as FillMorphIcon} />
        </Boundary>,
      ),
    );
    expect(tree.container.textContent).toBe("caught");
  });

  it("works under StrictMode with an element icon and leaves no loop behind", () => {
    const tree = track(
      mount(
        <StrictMode>
          <FillMorph icon={<FaHeart />} springConfig={CONFIG} />
        </StrictMode>,
      ),
    );
    tree.render(
      <StrictMode>
        <FillMorph icon={<FaCircle />} springConfig={CONFIG} />
      </StrictMode>,
    );
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(renderToStaticMarkup(<FaCircle />)));
  });
});

describe("<FillMorph> while react-dom/server first loads (spec 09 lazy load)", () => {
  it("never loads react-dom/server for string icons, in any mode", () => {
    const load = holdIconRendererLoad();
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} springConfig={CONFIG} />));
    tree.render(<FillMorph ref={ref} icon={CIRCLE} springConfig={CONFIG} />);
    act(() => ref.current?.morphTo(RING));
    runUntilIdle();
    track(mount(<FillMorph icon={SQUARE} to={CIRCLE} progress={0.5} />));
    track(mount(<FillMorph icon={MALFORMED} onError={() => {}} />));
    expect(load.importer).not.toHaveBeenCalled();
    expect(getIconRendererState().status).toBe("idle");
    expect(pathData(tree.container)).toBe(dOf(RING));
  });

  it("draws nothing for a first element icon until it loads, then shows it at rest", async () => {
    const load = holdIconRendererLoad();
    const onError = vi.fn<(error: FillmorphError) => void>();
    const tree = track(
      mount(<FillMorph icon={<FaHeart />} springConfig={CONFIG} onError={onError} />),
    );
    expect(load.importer).toHaveBeenCalledTimes(1);
    expect(pathData(tree.container)).toBe("");
    expect(frames.pendingCount()).toBe(0);
    await load.release();
    // Shown at rest from the first frame it appears, not morphed in from anything.
    const heart = contoursOf(FA_SOLID_HEART);
    expect(pathData(tree.container)).toBe(renderContours(interpolate(heart, heart, 0)));
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(FA_SOLID_HEART));
    expect(onError).not.toHaveBeenCalled();
  });

  it("an element icon change keeps the current shape until it loads, then morphs from it", async () => {
    const load = holdIconRendererLoad();
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    runUntilIdle();
    tree.render(<FillMorph icon={<FaHeart />} springConfig={CONFIG} />);
    expect(pathData(tree.container)).toBe(dOf(SQUARE));
    expect(frames.pendingCount()).toBe(0);
    await load.release();
    nextFrame();
    nextFrame();
    const midway = pathData(tree.container);
    expect(midway).not.toBe(dOf(SQUARE));
    expect(midway).not.toBe(dOf(FA_SOLID_HEART));
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(FA_SOLID_HEART));
  });

  it("a morphTo element mid-morph lets the current morph carry on until it loads", async () => {
    const load = holdIconRendererLoad();
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} springConfig={CONFIG} />));
    tree.render(<FillMorph ref={ref} icon={CIRCLE} springConfig={CONFIG} />);
    nextFrame();
    act(() => ref.current?.morphTo(<FaHeart />));
    // Still heading for the circle: the pending element doesn't stop or snap the motion.
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
    await load.release();
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(FA_SOLID_HEART));
  });

  it("keeps a morphTo target when the parent re-renders a fresh element during the load", async () => {
    const load = holdIconRendererLoad();
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={<FaHeart />} springConfig={CONFIG} />));
    act(() => ref.current?.morphTo(SQUARE));
    tree.render(<FillMorph ref={ref} icon={<FaHeart />} springConfig={CONFIG} />);
    await load.release();
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(SQUARE));
  });

  it("controlled mode draws nothing until its element icons load, then interpolates them", async () => {
    const load = holdIconRendererLoad();
    const tree = track(mount(<FillMorph icon={<FaHeart />} to={CIRCLE} progress={0.5} />));
    expect(pathData(tree.container)).toBe("");
    await load.release();
    expect(pathData(tree.container)).toBe(
      renderContours(interpolate(contoursOf(FA_SOLID_HEART), contoursOf(CIRCLE), 0.5)),
    );
    expect(frames.pendingCount()).toBe(0);
  });

  it("reports a failed load through onError as a FillmorphIconInputError; strings still work", async () => {
    const load = holdIconRendererLoad();
    const onError = vi.fn<(error: FillmorphError) => void>();
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} onError={onError} />));
    tree.render(<FillMorph icon={<FaHeart />} springConfig={CONFIG} onError={onError} />);
    await load.fail(new Error("Failed to fetch dynamically imported module"));
    expect(onError).toHaveBeenCalledTimes(1);
    const error = onError.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(FillmorphIconInputError);
    expect(error?.message).toMatch(/couldn't load `react-dom\/server`.*Failed to fetch/);
    expect(pathData(tree.container)).toBe(dOf(SQUARE));
    tree.render(<FillMorph icon={CIRCLE} springConfig={CONFIG} onError={onError} />);
    runUntilIdle();
    expect(pathData(tree.container)).toBe(dOf(CIRCLE));
  });
});

/** Root attributes `<FillMorph>` keeps for itself rather than forwarding from an icon element. */
const OWNED = ["viewBox", "preserveAspectRatio", "x", "y", "overflow", "id", "xmlns", "version"];

function rootSvg(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("no <svg> rendered");
  return svg;
}

/**
 * Asserts `svg` carries every root attribute `element` renders to on its own, minus the ones
 * fillmorph owns, computed from the library's output alone: nothing here knows any library.
 */
function expectForwarded(svg: SVGSVGElement, element: ReactElement): void {
  const attributes = readRootSvgAttributes(renderToStaticMarkup(element)) ?? [];
  const forwarded = attributes.filter(
    ([name]) => !OWNED.includes(name) && !name.startsWith("xmlns:"),
  );
  expect(forwarded.length).toBeGreaterThan(0);
  for (const [name, value] of forwarded) {
    if (name !== "style") {
      expect([name, svg.getAttribute(name)]).toEqual([name, value]);
      continue;
    }
    for (const declaration of value.split(";").filter(Boolean)) {
      const [property = "", propertyValue = ""] = declaration.split(":");
      expect([property, svg.style.getPropertyValue(property)]).toEqual([property, propertyValue]);
    }
  }
}

describe("<FillMorph> forwarding an icon element's root <svg> attributes (0.2.1)", () => {
  it.each([
    ["react-icons (color, size)", <FaHeart key="fa" color="red" size={32} className="like" />],
    [
      "heroicons (className, aria-*, data-*)",
      <HeartIcon key="hero" className="size-6 text-red-500" aria-label="Like" data-state="on" />,
    ],
  ])("forwards whatever %s renders, with no library-specific code", (_name, element) => {
    const { container } = track(mount(<FillMorph icon={element} />));
    const svg = rootSvg(container);
    expectForwarded(svg, element);
    // The frame stays fillmorph's.
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(svg.getAttribute("overflow")).toBe("visible");
    expect(pathData(container)).not.toBe("");
  });

  it("draws react-icons' color and size the way the icon itself would", () => {
    const { container } = track(mount(<FillMorph icon={<FaHeart color="red" size={32} />} />));
    const svg = rootSvg(container);
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.style.color).toBe("red");
  });

  it("lets a prop passed to <FillMorph> win over the icon's own value", () => {
    const { container } = track(
      mount(<FillMorph icon={<FaHeart color="red" size={32} />} fill="blue" width={48} />),
    );
    const svg = rootSvg(container);
    expect(svg.getAttribute("fill")).toBe("blue");
    expect(svg.getAttribute("width")).toBe("48");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("combines className and style instead of replacing them, the caller winning shared properties", () => {
    const { container } = track(
      mount(
        <FillMorph
          icon={<FaHeart className="icon" style={{ opacity: 0.5, color: "red" }} />}
          className="mine"
          style={{ color: "blue", margin: "2px" }}
        />,
      ),
    );
    const svg = rootSvg(container);
    expect(svg.getAttribute("class")).toBe("icon mine");
    expect(svg.style.opacity).toBe("0.5");
    expect(svg.style.color).toBe("blue");
    expect(svg.style.margin).toBe("2px");
  });

  it("never forwards the icon's id, so the same icon twice can't duplicate a DOM id", () => {
    const tree = track(
      mount(
        <>
          <FillMorph icon={<FaHeart id="like" />} />
          <FillMorph icon={<FaHeart id="like" />} />
          <FillMorph icon={<FaHeart id="like" />} id="mine" />
        </>,
      ),
    );
    expect(tree.container.querySelectorAll("#like")).toHaveLength(0);
    expect(tree.container.querySelectorAll("#mine")).toHaveLength(1);
  });

  it("doesn't forward anything from markup given as a string", () => {
    const red =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" class="x"><path d="M4 4H20V20H4Z"/></svg>';
    const svg = rootSvg(track(mount(<FillMorph icon={red} />)).container);
    expect(svg.getAttribute("fill")).toBeNull();
    expect(svg.getAttribute("class")).toBeNull();
  });

  it("snaps to the new icon's attributes the moment it changes, while the shape springs", () => {
    const tree = track(mount(<FillMorph icon={<FaHeart color="red" />} springConfig={CONFIG} />));
    runUntilIdle();
    tree.render(<FillMorph icon={<FaCircle color="blue" size={20} />} springConfig={CONFIG} />);
    const svg = rootSvg(tree.container);
    expect(svg.style.color).toBe("blue");
    expect(svg.getAttribute("width")).toBe("20");
    nextFrame();
    expect(pathData(tree.container)).not.toBe(dOf(renderToStaticMarkup(<FaCircle />)));
    tree.render(<FillMorph icon={SQUARE} springConfig={CONFIG} />);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.style.color).toBe("");
  });

  it("keeps the last good icon's attributes when a new icon is rejected", () => {
    const onError = vi.fn<(error: FillmorphError) => void>();
    const tree = track(mount(<FillMorph icon={<FaHeart color="red" />} onError={onError} />));
    tree.render(<FillMorph icon={<Heart color="blue" />} onError={onError} />);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(rootSvg(tree.container).style.color).toBe("red");
  });

  it("forwards a morphTo element's attributes", () => {
    const ref = createRef<FillMorphHandle>();
    const tree = track(mount(<FillMorph ref={ref} icon={SQUARE} springConfig={CONFIG} />));
    act(() => ref.current?.morphTo(<FaHeart color="red" />));
    expect(rootSvg(tree.container).style.color).toBe("red");
  });

  it("controlled mode snaps from icon's attributes to to's halfway", () => {
    const at = (progress: number) => {
      const { container } = track(
        mount(
          <FillMorph
            icon={<FaHeart color="red" />}
            to={<FaCircle color="blue" />}
            progress={progress}
          />,
        ),
      );
      return rootSvg(container).style.color;
    };
    expect([at(0), at(0.49), at(0.5), at(1)]).toEqual(["red", "red", "blue", "blue"]);
  });
});

describe("<FillMorph> forwarded attributes while react-dom/server first loads", () => {
  it("forwards a first element icon's attributes once it loads, not before", async () => {
    const load = holdIconRendererLoad();
    const tree = track(mount(<FillMorph icon={<FaHeart color="red" size={32} />} />));
    const svg = rootSvg(tree.container);
    expect(svg.getAttribute("width")).toBeNull();
    await load.release();
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.style.color).toBe("red");
  });
});

describe("<FillMorph> translucent layers (spec 11)", () => {
  const TWO_TONE = renderToStaticMarkup(<MdSignalWifi1Bar />);
  const pathsOf = (container: HTMLElement) =>
    [...container.querySelectorAll("path")].map((path) => ({
      d: path.getAttribute("d"),
      opacity: path.getAttribute("fill-opacity"),
    }));

  it("draws a two-tone icon as one <path> per opacity, the faded layer faded", () => {
    const { container } = track(mount(<FillMorph icon={TWO_TONE} progress={0} to={TWO_TONE} />));
    expect(pathsOf(container)).toEqual(
      renderLayers(contoursOf(TWO_TONE)).map(({ d, opacity }) => ({
        d,
        opacity: opacity === 1 ? null : String(opacity),
      })),
    );
    expect(pathsOf(container).map(({ opacity }) => opacity)).toEqual(["0.3", null]);
  });

  it("still draws an opaque icon as exactly one <path> with no fill-opacity", () => {
    const { container } = track(mount(<FillMorph icon={SQUARE} progress={0} to={SQUARE} />));
    expect(pathsOf(container)).toEqual([{ d: dOf(SQUARE), opacity: null }]);
  });

  it("fades the layers through a controlled morph to an opaque icon, ending on one <path>", () => {
    const tree = track(mount(<FillMorph icon={TWO_TONE} to={CIRCLE} progress={0.5} />));
    const expected = renderLayers(interpolate(contoursOf(TWO_TONE), contoursOf(CIRCLE), 0.5));
    expect(pathsOf(tree.container).map(({ d }) => d)).toEqual(expected.map(({ d }) => d));
    tree.render(<FillMorph icon={TWO_TONE} to={CIRCLE} progress={1} />);
    expect(pathsOf(tree.container)).toHaveLength(1);
  });

  it("animates a two-tone element icon in uncontrolled mode and settles on its layers", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    tree.render(<FillMorph icon={<MdSignalWifi1Bar />} springConfig={CONFIG} />);
    runUntilIdle();
    expect(pathsOf(tree.container).map(({ opacity }) => opacity)).toEqual(["0.3", null]);
  });
});

describe("<FillMorph> fillOpacity composes with each layer's own opacity (spec 13 #2)", () => {
  const TWO_TONE_ICONS = {
    MdSignalWifi1Bar,
    MdSignalWifi1BarLock,
    MdSignalWifi2Bar,
    MdSignalWifi2BarLock,
    MdSignalWifi3Bar,
    MdSignalWifi3BarLock,
    MdWifiCalling1,
    MdWifiCalling2,
  };
  const pathsOf = (container: HTMLElement) =>
    [...container.querySelectorAll("path")].map((path) => ({
      d: path.getAttribute("d"),
      opacity: path.getAttribute("fill-opacity"),
    }));
  // What each <path> is drawn at: its own fill-opacity, or the root's it inherits without one.
  const drawnOpacities = (container: HTMLElement): number[] => {
    const root = rootSvg(container).getAttribute("fill-opacity") ?? "1";
    return [...container.querySelectorAll("path")].map((path) =>
      Number(path.getAttribute("fill-opacity") ?? root),
    );
  };
  const layerOpacities = (icon: string): number[] =>
    renderLayers(contoursOf(icon)).map(({ opacity }) => opacity);

  for (const [name, Icon] of Object.entries(TWO_TONE_ICONS)) {
    it(`draws ${name}'s every layer at fillOpacity × its own opacity`, () => {
      const markup = renderToStaticMarkup(<Icon />);
      const own = layerOpacities(markup);
      expect(own.some((opacity) => opacity < 1)).toBe(true);
      const { container } = track(
        mount(<FillMorph icon={markup} progress={0} to={markup} fillOpacity={0.4} />),
      );
      const drawn = drawnOpacities(container);
      expect(drawn).toHaveLength(own.length);
      drawn.forEach((opacity, index) => {
        expect(opacity).toBeCloseTo(0.4 * (own[index] as number), 9);
      });
    });
  }

  it("draws MdSignalWifi1Bar's 0.3 layer at 0.12 and its opaque layer at 0.4", () => {
    const markup = renderToStaticMarkup(<MdSignalWifi1Bar />);
    const { container } = track(
      mount(<FillMorph icon={markup} progress={0} to={markup} fillOpacity={0.4} />),
    );
    expect(pathsOf(container).map(({ opacity }) => opacity)).toEqual(["0.12", null]);
    expect(rootSvg(container).getAttribute("fill-opacity")).toBe("0.4");
    expect(drawnOpacities(container)).toEqual([0.12, 0.4]);
  });

  it("multiplies by fillOpacity given as a string, a percentage, or in style (style wins)", () => {
    const markup = renderToStaticMarkup(<MdSignalWifi1Bar />);
    const faded = (props: { fillOpacity?: string; style?: CSSProperties }) =>
      pathsOf(
        track(mount(<FillMorph icon={markup} progress={0} to={markup} {...props} />)).container,
      )[0]?.opacity;
    expect(faded({ fillOpacity: "0.5" })).toBe("0.15");
    expect(faded({ fillOpacity: "50%" })).toBe("0.15");
    expect(faded({ style: { fillOpacity: 0.5 } })).toBe("0.15");
    expect(faded({ fillOpacity: "0.9", style: { fillOpacity: "0.5" } })).toBe("0.15");
  });

  it("ignores an unreadable fillOpacity, as a browser does, rather than hiding the layer", () => {
    const markup = renderToStaticMarkup(<MdSignalWifi1Bar />);
    for (const fillOpacity of ["inherit", "%", "var(--x)", ""]) {
      const { container } = track(
        mount(<FillMorph icon={markup} progress={0} to={markup} fillOpacity={fillOpacity} />),
      );
      expect(pathsOf(container)[0]?.opacity).toBe("0.3");
    }
  });

  it("composes with a fill-opacity forwarded from an element icon's root, too", () => {
    const tree = track(mount(<FillMorph icon={SQUARE} springConfig={CONFIG} />));
    tree.render(<FillMorph icon={<MdSignalWifi1Bar fillOpacity={0.5} />} springConfig={CONFIG} />);
    runUntilIdle();
    expect(rootSvg(tree.container).getAttribute("fill-opacity")).toBe("0.5");
    expect(pathsOf(tree.container).map(({ opacity }) => opacity)).toEqual(["0.15", null]);
  });

  it("composes through a controlled morph and in uncontrolled mode", () => {
    const markup = renderToStaticMarkup(<MdSignalWifi1Bar />);
    const tree = track(
      mount(<FillMorph icon={markup} to={CIRCLE} progress={0.5} fillOpacity={0.5} />),
    );
    const midway = renderLayers(interpolate(contoursOf(markup), contoursOf(CIRCLE), 0.5));
    expect(drawnOpacities(tree.container)).toEqual(
      midway.map(({ opacity }) => Math.round(opacity * 0.5 * 1e6) / 1e6),
    );

    const uncontrolled = track(
      mount(<FillMorph icon={SQUARE} springConfig={CONFIG} fillOpacity={0.5} />),
    );
    uncontrolled.render(<FillMorph icon={markup} springConfig={CONFIG} fillOpacity={0.5} />);
    runUntilIdle();
    expect(drawnOpacities(uncontrolled.container)).toEqual([0.15, 0.5]);
  });

  it("leaves an opaque icon with fillOpacity exactly as before: one <path>, the root's value", () => {
    const { container } = track(
      mount(<FillMorph icon={SQUARE} progress={0} to={SQUARE} fillOpacity={0.4} />),
    );
    expect(pathsOf(container)).toEqual([{ d: dOf(SQUARE), opacity: null }]);
    expect(rootSvg(container).getAttribute("fill-opacity")).toBe("0.4");
  });
});
