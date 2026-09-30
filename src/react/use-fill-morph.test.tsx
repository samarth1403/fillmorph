// @vitest-environment happy-dom
import { FillmorphParseError, parseIcon, renderContours, type SpringConfig } from "fillmorph";
import { act, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CIRCLE,
  enableActEnvironment,
  type FakeFrames,
  FRAME_MS,
  installFakeAnimationFrames,
  mount,
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
function Probe({ icon, results }: { icon: string; results: UseFillMorphResult[] }): ReactElement {
  results.push(useFillMorph(icon, CONFIG));
  return <span />;
}

beforeEach(() => {
  enableActEnvironment();
  frames = installFakeAnimationFrames();
  now = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
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
