// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IconWall } from "./icon-wall";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A stand-in IntersectionObserver whose visibility the test sets by hand. */
const observed = new Set<Element>();
let report: ((entries: { target: Element; isIntersecting: boolean }[]) => void) | null = null;
vi.stubGlobal(
  "IntersectionObserver",
  class {
    constructor(callback: typeof report) {
      report = callback;
    }
    observe(element: Element) {
      observed.add(element);
    }
    unobserve(element: Element) {
      observed.delete(element);
    }
  },
);

async function setOnScreen(isOnScreen: (element: Element) => boolean): Promise<void> {
  await act(async () =>
    report?.([...observed].map((target) => ({ target, isIntersecting: isOnScreen(target) }))),
  );
}

let container: HTMLDivElement;
let unmount: () => void;

beforeEach(async () => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<IconWall />));
  unmount = () => act(() => root.unmount());
});

afterEach(() => {
  unmount();
  container.remove();
  vi.useRealTimers();
});

const titles = () => [...container.querySelectorAll("button")].map((button) => button.title);
/** `<FillMorph>`'s root sets `overflow`; a still tile's `<svg>` doesn't. */
const liveMorphs = () => container.querySelectorAll("svg[overflow]").length;

async function wait(ms: number): Promise<void> {
  await act(async () => vi.advanceTimersByTime(ms));
}

describe("IconWall's ambient swaps", () => {
  it("trade icons by morphing while the wall and its tiles are on screen", async () => {
    await setOnScreen(() => true);
    const before = titles();
    await wait(200);
    expect(titles()).not.toEqual(before);
    expect(liveMorphs()).toBeGreaterThan(0);
  });

  it("stop altogether while the wall is off screen", async () => {
    await setOnScreen(() => false);
    const before = titles();
    await wait(2000);
    expect(titles()).toEqual(before);
    expect(liveMorphs()).toBe(0);
  });

  it("swap off-screen tiles still, without running a morph", async () => {
    await setOnScreen((element) => element.tagName === "UL");
    const before = titles();
    await wait(2000);
    expect(titles()).not.toEqual(before);
    expect(liveMorphs()).toBe(0);
  });
});
