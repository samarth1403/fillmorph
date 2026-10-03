import { FillmorphMarkupError } from "fillmorph";
import { createContext, forwardRef, type ReactElement, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaCircle, FaHeart } from "react-icons/fa6";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FillmorphIconInputError,
  getIconRendererState,
  type IconRendererState,
  iconInputError,
  isPendingIcon,
  isSameIcon,
  loadIconRenderer,
  resetIconRenderer,
  resolveIcon,
} from "./icon-source";
import { SQUARE } from "./test-helpers";

const SQUARE_PATH = "M4 4H20V20H4Z";
const READY: IconRendererState = { status: "ready", render: renderToStaticMarkup };
const IDLE: IconRendererState = { status: "idle" };

afterEach(() => {
  resetIconRenderer();
});

describe("resolveIcon", () => {
  it("passes a markup string through untouched, whether or not the renderer is loaded", () => {
    expect(resolveIcon(SQUARE, IDLE)).toEqual({ markup: SQUARE, invalid: null });
    expect(resolveIcon(SQUARE, READY)).toEqual({ markup: SQUARE, invalid: null });
  });

  it("renders a plain <svg> element to its markup once the renderer is loaded", () => {
    const resolved = resolveIcon(
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d={SQUARE_PATH} />
      </svg>,
      READY,
    );
    expect(resolved.markup).toBe(
      `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${SQUARE_PATH}"></path></svg>`,
    );
  });

  it("leaves an element pending until the renderer is loaded", () => {
    for (const status of ["idle", "loading"] as const) {
      const resolved = resolveIcon(<FaHeart />, { status });
      expect(resolved).toEqual({ markup: null, invalid: null });
      expect(isPendingIcon(resolved)).toBe(true);
    }
  });

  it("rejects an element with the load failure's message if the renderer couldn't load", () => {
    const resolved = resolveIcon(<FaHeart />, { status: "failed", message: "no react-dom" });
    expect(resolved).toEqual({ markup: null, invalid: "no react-dom" });
  });

  it("runs function components, forwardRef and context defaults, as React does", () => {
    const Frame = createContext("0 0 24 24");
    const Square = (): ReactElement => (
      <svg aria-hidden="true" viewBox={useContext(Frame)}>
        <path d={SQUARE_PATH} />
      </svg>
    );
    const Forwarded = forwardRef<SVGSVGElement>((_props, ref) => (
      <svg ref={ref} aria-hidden="true" viewBox="0 0 24 24">
        <path d={SQUARE_PATH} />
      </svg>
    ));
    const expected = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${SQUARE_PATH}"></path></svg>`;
    expect(resolveIcon(<Square />, READY).markup).toBe(expected);
    expect(resolveIcon(<Forwarded />, READY).markup).toBe(expected);
  });

  it("renders a real icon library's element (react-icons' FaHeart)", () => {
    const { markup } = resolveIcon(<FaHeart />, READY);
    expect(markup).toMatch(/^<svg [^>]*viewBox="0 0 512 512"/);
    expect(markup).toContain('<path d="M47.6 300.4L228.3 469.1');
  });

  it("reports anything else as invalid right away, with a hint when a component was passed", () => {
    expect(resolveIcon(FaHeart, IDLE).invalid).toMatch(/but got a function.*instead of an element/);
    expect(resolveIcon(null, IDLE).invalid).toMatch(/but got null\.$/);
    expect(resolveIcon(undefined, IDLE).invalid).toMatch(/but got undefined\.$/);
    expect(resolveIcon(42, IDLE).invalid).toMatch(/but got a number\.$/);
    expect(resolveIcon([SQUARE], IDLE).invalid).toMatch(/but got an array\.$/);
    expect(resolveIcon({ type: "svg" }, IDLE).invalid).toMatch(
      /but got an object that isn't a React element\.$/,
    );
    expect(resolveIcon(FaHeart, READY).markup).toBeNull();
  });

  it("propagates an error thrown while rendering the element, since that's a bug, not a bad icon", () => {
    const Broken = (): ReactElement => {
      throw new TypeError("broken icon component");
    };
    expect(() => resolveIcon(<Broken />, READY)).toThrow(TypeError);
  });
});

describe("isSameIcon", () => {
  const same = (a: string | ReactElement, b: string | ReactElement, state: IconRendererState) =>
    isSameIcon(a, resolveIcon(a, state), b, resolveIcon(b, state));

  it("compares by markup, so two renders of the same element are the same icon", () => {
    expect(same(<FaHeart />, <FaHeart />, READY)).toBe(true);
    expect(same(<FaHeart />, SQUARE, READY)).toBe(false);
    expect(same(<FaHeart />, <FaCircle />, READY)).toBe(false);
  });

  it("compares pending elements by type and props, one level deep", () => {
    expect(same(<FaHeart />, <FaHeart />, IDLE)).toBe(true);
    expect(same(<FaHeart size={20} />, <FaHeart size={20} />, IDLE)).toBe(true);
    expect(same(<FaHeart size={20} />, <FaHeart size={24} />, IDLE)).toBe(false);
    expect(same(<FaHeart />, <FaCircle />, IDLE)).toBe(false);
    expect(same(<FaHeart />, SQUARE, IDLE)).toBe(false);
  });

  it("tells markup and invalid input apart", () => {
    expect(same(null as unknown as string, null as unknown as string, READY)).toBe(true);
    expect(same(null as unknown as string, "null", READY)).toBe(false);
  });
});

describe("loadIconRenderer", () => {
  it("imports react-dom/server once, however many times it's asked", async () => {
    const importer = vi.fn(async () => ({ renderToStaticMarkup }));
    resetIconRenderer(importer);
    expect(getIconRendererState().status).toBe("idle");
    await Promise.all([loadIconRenderer(), loadIconRenderer()]);
    await loadIconRenderer();
    expect(importer).toHaveBeenCalledTimes(1);
    expect(getIconRendererState().status).toBe("ready");
  });

  it("turns a failed import into a load failure naming react-dom/server and the cause", async () => {
    resetIconRenderer(async () => {
      throw new Error("Cannot find module 'react-dom/server'");
    });
    await loadIconRenderer();
    const state = getIconRendererState();
    expect(state.status).toBe("failed");
    const resolved = resolveIcon(<FaHeart />, state);
    expect(resolved.invalid).toMatch(/couldn't load `react-dom\/server`.*Cannot find module/);
  });
});

describe("FillmorphIconInputError", () => {
  it("is a FillmorphMarkupError with its own name, carrying the message it's given", () => {
    const error = iconInputError("fillmorph/react expects … but got a number.");
    expect(error).toBeInstanceOf(FillmorphIconInputError);
    expect(error).toBeInstanceOf(FillmorphMarkupError);
    expect(error.name).toBe("FillmorphIconInputError");
    expect(error.message).toBe("fillmorph/react expects … but got a number.");
  });
});
