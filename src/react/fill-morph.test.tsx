// @vitest-environment happy-dom
import {
  advanceMorph,
  type Contour,
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  interpolate,
  type MorphState,
  parseIcon,
  renderContours,
  retargetMorph,
  type SpringConfig,
  startMorph,
} from "fillmorph";
import { act, Component, createRef, type ReactNode, StrictMode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FillMorph, { type FillMorphHandle } from "./fill-morph";
import type { FillmorphError } from "./parse-icon-markup";
import {
  CIRCLE,
  DIAMOND,
  enableActEnvironment,
  type FakeFrames,
  FRAME_MS,
  installFakeAnimationFrames,
  MALFORMED,
  type Mounted,
  mount,
  pathData,
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

beforeEach(() => {
  enableActEnvironment();
  frames = installFakeAnimationFrames();
  now = 0;
});

afterEach(() => {
  for (const tree of mounted) tree.unmount();
  mounted = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Records what an error boundary caught, so a render-time throw can be asserted. */
class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }
  override render(): ReactNode {
    return this.state.error === null ? this.props.children : <p>caught</p>;
  }
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
