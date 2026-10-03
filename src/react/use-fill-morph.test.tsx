// @vitest-environment happy-dom
import {
  FillmorphIncompatibleIconError,
  FillmorphParseError,
  parseIcon,
  renderContours,
  type SpringConfig,
} from "fillmorph";
import { Heart } from "lucide-react";
import { act, type ReactElement } from "react";
import { FaHeart } from "react-icons/fa6";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type FillMorphIcon, FillmorphIconInputError, getIconRendererState } from "./icon-source";
import {
  CIRCLE,
  enableActEnvironment,
  FA_SOLID_HEART,
  type FakeFrames,
  FRAME_MS,
  holdIconRendererLoad,
  installFakeAnimationFrames,
  mount,
  preloadIconRenderer,
  SQUARE,
} from "./test-helpers";
import { type UseFillMorphResult, useFillMorph } from "./use-fill-morph";

const CONFIG: SpringConfig = { stiffness: 170, damping: 26, mass: 1 };
/** A well-formed SVG whose path never closes: a `FillmorphParseError`. */
const OPEN_PATH =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4H20V20"/></svg>';

let frames: FakeFrames;
let now = 0;

function runUntilIdle(): void {
  for (let i = 0; frames.pendingCount() > 0; i++) {
    if (i > 1000) throw new Error("the morph never settled");
    now += FRAME_MS;
    frames.frame(now);
  }
}

/** Renders nothing; hands every render's hook result to the test. */
function Probe({
  icon,
  results,
}: {
  icon: FillMorphIcon;
  results: UseFillMorphResult[];
}): ReactElement {
  results.push(useFillMorph(icon, CONFIG));
  return <span />;
}

beforeEach(() => {
  enableActEnvironment();
  frames = installFakeAnimationFrames();
  now = 0;
});

// See fill-morph.test.tsx: loaded by default, held open only by the lazy-load test.
beforeAll(preloadIconRenderer);

afterEach(async () => {
  vi.unstubAllGlobals();
  if (getIconRendererState().status !== "ready") await preloadIconRenderer();
});

describe("useFillMorph", () => {
  it("returns the icon's canonical-frame contours on the first render", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={SQUARE} results={results} />);
    expect(results[0]?.contours).toEqual(parseIcon(SQUARE).contours);
    expect(results[0]?.error).toBeNull();
    tree.unmount();
  });

  it("animates to a new icon and settles on it exactly", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={SQUARE} results={results} />);
    runUntilIdle();
    tree.render(<Probe icon={CIRCLE} results={results} />);
    runUntilIdle();
    expect(renderContours(results.at(-1)?.contours ?? [])).toBe(
      renderContours(parseIcon(CIRCLE).contours),
    );
    tree.unmount();
  });

  it("retarget is stable across renders and morphs like an icon change", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={SQUARE} results={results} />);
    runUntilIdle();
    const retarget = results[0]?.retarget;
    expect(results.at(-1)?.retarget).toBe(retarget);
    act(() => retarget?.(CIRCLE));
    runUntilIdle();
    expect(renderContours(results.at(-1)?.contours ?? [])).toBe(
      renderContours(parseIcon(CIRCLE).contours),
    );
    tree.unmount();
  });

  it("reports a rejected icon through `error` without throwing, and keeps the last shape", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={SQUARE} results={results} />);
    runUntilIdle();
    const square = results.at(-1)?.contours;
    tree.render(<Probe icon={OPEN_PATH} results={results} />);
    runUntilIdle();
    expect(results.at(-1)?.error).toBeInstanceOf(FillmorphParseError);
    expect(results.at(-1)?.contours).toBe(square);

    tree.render(<Probe icon={CIRCLE} results={results} />);
    expect(results.at(-1)?.error).toBeNull();
    tree.unmount();
  });

  it("returns no contours and the error when the very first icon is rejected", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={OPEN_PATH} results={results} />);
    expect(results.at(-1)?.contours).toEqual([]);
    expect(results.at(-1)?.error).toBeInstanceOf(FillmorphParseError);
    expect(frames.pendingCount()).toBe(0);
    tree.unmount();
  });
});

describe("useFillMorph with icon elements (spec 09)", () => {
  it("takes an element as its icon, with the same contours as the icon's markup", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={<FaHeart />} results={results} />);
    expect(results[0]?.contours).toEqual(parseIcon(FA_SOLID_HEART).contours);
    expect(results[0]?.error).toBeNull();
    tree.unmount();
  });

  it("retarget takes an element", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={SQUARE} results={results} />);
    act(() => results.at(-1)?.retarget(<FaHeart />));
    runUntilIdle();
    expect(renderContours(results.at(-1)?.contours ?? [])).toBe(
      renderContours(parseIcon(FA_SOLID_HEART).contours),
    );
    tree.unmount();
  });

  it("keeps a retarget when the parent re-renders with a fresh but identical icon element", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={<FaHeart />} results={results} />);
    act(() => results.at(-1)?.retarget(SQUARE));
    tree.render(<Probe icon={<FaHeart />} results={results} />);
    runUntilIdle();
    expect(renderContours(results.at(-1)?.contours ?? [])).toBe(
      renderContours(parseIcon(SQUARE).contours),
    );
    tree.unmount();
  });

  it("doesn't restart the morph when the parent re-renders with a fresh but identical element", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={<FaHeart />} results={results} />);
    runUntilIdle();
    tree.render(<Probe icon={<FaHeart />} results={results} />);
    expect(frames.pendingCount()).toBe(0);
    tree.unmount();
  });

  it("reports a stroke icon element through `error`, as its markup would be", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={<Heart />} results={results} />);
    expect(results.at(-1)?.error).toBeInstanceOf(FillmorphIncompatibleIconError);
    expect(results.at(-1)?.contours).toEqual([]);
    tree.unmount();
  });

  it("reports an icon that is neither markup nor an element through `error`", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={null as unknown as FillMorphIcon} results={results} />);
    expect(results.at(-1)?.error).toBeInstanceOf(FillmorphIconInputError);
    act(() => results.at(-1)?.retarget(SQUARE));
    expect(results.at(-1)?.error).toBeNull();
    tree.unmount();
  });
});

describe("useFillMorph while react-dom/server first loads (spec 09 lazy load)", () => {
  it("returns no contours and no error for a first element icon until it loads", async () => {
    const load = holdIconRendererLoad();
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={<FaHeart />} results={results} />);
    expect(results.at(-1)?.contours).toEqual([]);
    expect(results.at(-1)?.error).toBeNull();
    await load.release();
    expect(results.at(-1)?.contours).toEqual(parseIcon(FA_SOLID_HEART).contours);
    expect(results.at(-1)?.error).toBeNull();
    tree.unmount();
  });

  it("never loads react-dom/server for string icons and string retargets", () => {
    const load = holdIconRendererLoad();
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={SQUARE} results={results} />);
    act(() => results.at(-1)?.retarget(CIRCLE));
    runUntilIdle();
    expect(load.importer).not.toHaveBeenCalled();
    tree.unmount();
  });
});

describe("useFillMorph's public result", () => {
  it("is exactly { contours, retarget, error }: forwarded icon attributes stay internal", () => {
    const results: UseFillMorphResult[] = [];
    const tree = mount(<Probe icon={<FaHeart color="red" />} results={results} />);
    expect(Object.keys(results.at(-1) ?? {}).sort()).toEqual(["contours", "error", "retarget"]);
    tree.unmount();
  });
});
