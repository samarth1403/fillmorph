import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";
import { loadIconRenderer, resetIconRenderer, type ServerModule } from "./icon-source";

/** Small real icons in spec 02's contract, in different native frames. */
export const SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"/></svg>';
export const DIAMOND =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 4L44 24L24 44L4 24Z"/></svg>';
export const CIRCLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2A10 10 0 1 1 12 22A10 10 0 1 1 12 2Z"/></svg>';
/** A square with a square hole (1 hole), so morphs to and from it grow or collapse a hole. */
export const RING =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M2 2H22V22H2Z M7 7V17H17V7Z"/></svg>';
/** Not well-formed XML: a `FillmorphMarkupError`. */
export const MALFORMED = '<svg viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"></svg';
/** A stroke-only icon: a `FillmorphIncompatibleIconError`. */
export const STROKE_ONLY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black"><path d="M4 4H20V20H4Z"/></svg>';

/**
 * Verbatim `@fortawesome/fontawesome-free@6.7.2/svgs/solid/heart.svg` (CC BY 4.0), as committed
 * in `harness/fixtures/`. react-icons' `FaHeart` (`react-icons/fa6`) draws the same path data.
 */
export const FA_SOLID_HEART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2024 Fonticons, Inc. --><path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"/></svg>`;
/** Verbatim `lucide-static@0.469.0/icons/heart.svg` (ISC): a stroke icon, as raw markup. */
export const LUCIDE_HEART = `<!-- @license lucide-static v0.469.0 - ISC -->
<svg
  class="lucide lucide-heart"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
</svg>
`;

/** One animation frame's length, in milliseconds. */
export const FRAME_MS = 1000 / 60;

/**
 * A controllable stand-in for `requestAnimationFrame`, as in `fillmorph/dom`'s own tests:
 * callbacks queue up and run only when a test calls `frame(timestamp)`.
 */
export function installFakeAnimationFrames() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    pending.delete(id);
  });
  return {
    pendingCount: () => pending.size,
    /** Runs every callback queued so far with `timestamp` (milliseconds), inside `act`. */
    frame(timestamp: number) {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(timestamp);
      });
    },
  };
}

export type FakeFrames = ReturnType<typeof installFakeAnimationFrames>;

/** Tells React this is a test environment, so `act` flushes updates without warning. */
export function enableActEnvironment(): void {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

/** A mounted React tree in a detached container, driven through `act`. */
export type Mounted = {
  container: HTMLElement;
  render: (node: ReactNode) => void;
  unmount: () => void;
};

export function mount(node: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  const render = (next: ReactNode) => {
    act(() => root.render(next));
  };
  render(node);
  return {
    container,
    render,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** The `d` of the `index`th `<path>` in `container`. */
export function pathData(container: HTMLElement, index = 0): string {
  const path = container.querySelectorAll("path")[index];
  if (path === undefined) throw new Error(`no <path> #${index} rendered`);
  return path.getAttribute("d") ?? "";
}

/** Loads the real `react-dom/server` up front, so element icons resolve synchronously. */
export async function preloadIconRenderer(): Promise<void> {
  resetIconRenderer();
  await loadIconRenderer();
}

/**
 * Makes the next `react-dom/server` load wait until the test releases (or fails) it, to see what
 * element icons do while the first load is in flight.
 */
export function holdIconRendererLoad() {
  let settle: { resolve: (server: ServerModule) => void; reject: (error: unknown) => void } | null =
    null;
  const importer = vi.fn(
    () =>
      new Promise<ServerModule>((resolve, reject) => {
        settle = { resolve, reject };
      }),
  );
  resetIconRenderer(importer);
  const finish = async (outcome: (pending: NonNullable<typeof settle>) => Promise<void>) => {
    await act(async () => {
      if (settle === null) throw new Error("react-dom/server was never requested");
      await outcome(settle);
      await loadIconRenderer();
    });
  };
  return {
    importer,
    /** Lets the load finish with the real `react-dom/server`, inside `act`. */
    release: () => finish(async (pending) => pending.resolve(await import("react-dom/server"))),
    /** Fails the load with `error`, inside `act`. */
    fail: (error: unknown) => finish(async (pending) => pending.reject(error)),
  };
}
