import { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";
import { findIcon } from "../catalog";
import { Morph } from "../morph";
import { SPRING_PRESETS } from "../presets";
import { MOON_ICON, SUN_ICON } from "../ui-icons";

/**
 * Spec 08 §1c #5: each use case is a small, working piece of the UI it belongs in, built on
 * `<FillMorph>` and driven only by the visitor's clicks (nothing here runs on a timer by itself).
 * Every icon pair is from the vetted set.
 */

const [SMOOTH, SNAPPY, BOUNCY] = SPRING_PRESETS.map((preset) => preset.config) as [
  (typeof SPRING_PRESETS)[number]["config"],
  (typeof SPRING_PRESETS)[number]["config"],
  (typeof SPRING_PRESETS)[number]["config"],
];

const icon = (id: string): string => findIcon(id).markup;

const Card = ({
  title,
  why,
  children,
}: {
  title: string;
  why: string;
  children: ReactNode;
}): ReactElement => {
  return (
    <article className="flex flex-col rounded-3xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="grid min-h-40 place-items-center rounded-2xl bg-neutral-50 p-5 dark:bg-white/[0.03]">
        {children}
      </div>
      <h3 className="mt-5 font-semibold tracking-tight text-neutral-950 dark:text-white">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{why}</p>
    </article>
  );
};

/** E-commerce: a product card's save-for-later heart. */
const Wishlist = (): ReactElement => {
  const [isSaved, setIsSaved] = useState(false);
  return (
    <div className="w-full max-w-[13rem] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="relative h-24 bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-500/20 dark:to-amber-500/5">
        <button
          type="button"
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
          onClick={() => setIsSaved(!isSaved)}
          className={`absolute top-2 right-2 grid size-9 cursor-pointer place-items-center rounded-full bg-white/90 shadow-sm transition-colors dark:bg-neutral-950/80 ${
            isSaved
              ? "text-orange-500"
              : "text-neutral-700 hover:text-orange-500 dark:text-neutral-200"
          }`}
        >
          <Morph
            icon={icon(isSaved ? "fa-solid-heart" : "fa-regular-heart")}
            spring={BOUNCY}
            className="size-[18px]"
          />
        </button>
      </div>
      <div className="flex items-baseline justify-between px-3 py-2.5 text-sm">
        <span className="font-medium text-neutral-900 dark:text-white">Linen shirt</span>
        <span className="text-neutral-500">$48</span>
      </div>
    </div>
  );
};

/** An inbox row: clicking it toggles read/unread. */
const ReadUnread = (): ReactElement => {
  const [isUnread, setIsUnread] = useState(true);
  return (
    <button
      type="button"
      aria-pressed={!isUnread}
      aria-label={isUnread ? "Mark as read" : "Mark as unread"}
      onClick={() => setIsUnread(!isUnread)}
      className="flex w-full max-w-[15rem] cursor-pointer items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 text-left shadow-sm transition-colors hover:border-orange-300 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-orange-400/50"
    >
      <span className={isUnread ? "text-orange-500" : "text-neutral-400 dark:text-neutral-500"}>
        <Morph
          icon={icon(isUnread ? "fa-solid-envelope-open" : "fa-regular-envelope-open")}
          spring={SMOOTH}
          className="size-5"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${isUnread ? "font-semibold text-neutral-950 dark:text-white" : "text-neutral-600 dark:text-neutral-400"}`}
        >
          Maya Chen
        </span>
        <span className="block truncate text-xs text-neutral-500">Draft for Thursday's review</span>
      </span>
      <span
        aria-hidden="true"
        className={`size-2 rounded-full bg-orange-500 transition-opacity ${isUnread ? "" : "opacity-0"}`}
      />
    </button>
  );
};

type UploadState = "idle" | "uploading" | "done";
const UPLOAD_ICON: Record<UploadState, string> = {
  idle: "fa-solid-file",
  uploading: "fa-solid-cloud",
  done: "fa-regular-circle-check",
};
const UPLOAD_MS = 1400;

/** A file upload: click to send; the icon morphs file → cloud → check as it goes. */
const Upload = (): ReactElement => {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const start = () => {
    if (state === "uploading") return;
    if (state === "done") {
      setState("idle");
      setProgress(0);
      return;
    }
    // A stand-in for a real upload's progress events, started by the visitor's click.
    setState("uploading");
    const startedAt = performance.now();
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - startedAt) / UPLOAD_MS);
      setProgress(fraction);
      if (fraction < 1) frame.current = requestAnimationFrame(tick);
      else setState("done");
    };
    frame.current = requestAnimationFrame(tick);
  };
  const label = { idle: "Upload report.pdf", uploading: "Uploading…", done: "Uploaded" }[state];
  return (
    <button
      type="button"
      onClick={start}
      aria-live="polite"
      className="w-full max-w-[15rem] cursor-pointer rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-orange-300 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-orange-400/50"
    >
      <span className="flex items-center gap-3">
        <span
          className={
            state === "done" ? "text-orange-500" : "text-neutral-700 dark:text-neutral-200"
          }
        >
          <Morph icon={icon(UPLOAD_ICON[state])} spring={SNAPPY} className="size-5" />
        </span>
        <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
      </span>
      <span className="mt-3 block h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
        <span
          className="block h-full rounded-full bg-orange-500"
          style={{ width: `${(state === "idle" ? 0 : progress) * 100}%` }}
        />
      </span>
    </button>
  );
};

/**
 * A reaction button with a count: a different pair from the heart. The count crosses 999 → 1000
 * on purpose, the case where a digit is added, and the pill keeps its width (§1d #5).
 *
 * The morph is the only motion (§1e #6). There used to be an `active:scale-90` press and a full
 * orange background flood on the same click: the press scaled the whole pill (icon included) back
 * up over the 150 ms after release, and the flood swapped its contrast, exactly while the morph
 * made its main move (it arrives at 0.2 s), hiding it. Now the pill doesn't move or refill; only
 * its border and color turn orange, which moves no pixels.
 */
const Reaction = (): ReactElement => {
  const [hasReacted, setHasReacted] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={hasReacted}
      onClick={() => setHasReacted(!hasReacted)}
      className={`inline-flex w-28 cursor-pointer items-center justify-center gap-2.5 rounded-full border bg-white py-2.5 text-sm font-semibold shadow-sm transition-colors duration-300 dark:bg-neutral-900 ${
        hasReacted
          ? "border-orange-400 text-orange-600 dark:border-orange-400/70 dark:text-orange-400"
          : "border-neutral-200 text-neutral-700 hover:border-orange-300 dark:border-white/10 dark:text-neutral-200"
      }`}
    >
      <Morph
        icon={icon(hasReacted ? "fa-regular-face-grin-hearts" : "fa-regular-face-smile")}
        spring={BOUNCY}
        className="size-5"
      />
      {/* A fixed-width counter in tabular figures: the pill never resizes as the count changes. */}
      <span className="inline-block min-w-[4ch] text-left tabular-nums">
        {hasReacted ? 1_000 : 999}
      </span>
      <span className="sr-only">{hasReacted ? "Remove your reaction" : "React"}</span>
    </button>
  );
};

const STEPS = ["Account", "Profile", "Finish"];

/** A sign-up stepper: Back/Next move the current step, and each indicator morphs to its state. */
const Onboarding = (): ReactElement => {
  const [current, setCurrent] = useState(0);
  const stateIcon = (step: number) =>
    step < current
      ? "fa-regular-circle-check"
      : step === current
        ? "fa-regular-circle-dot"
        : "fa-regular-circle";
  return (
    <div className="w-full max-w-[16rem]">
      <ol className="flex items-start justify-between">
        {STEPS.map((step, index) => (
          <li key={step} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={
                index <= current ? "text-orange-500" : "text-neutral-300 dark:text-neutral-600"
              }
            >
              <Morph icon={icon(stateIcon(index))} spring={SMOOTH} className="size-6" />
            </span>
            <span
              className={`text-xs ${index === current ? "font-semibold text-neutral-950 dark:text-white" : "text-neutral-500"}`}
            >
              {step}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex justify-between gap-2">
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
          className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-white/5"
        >
          Back
        </button>
        <button
          type="button"
          disabled={current === STEPS.length}
          onClick={() => setCurrent(current + 1)}
          className="cursor-pointer rounded-full bg-orange-500 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-orange-400 disabled:cursor-default disabled:opacity-40"
        >
          {current >= STEPS.length - 1 ? "Complete" : "Next"}
        </button>
      </div>
    </div>
  );
};

const TABS = [
  { name: "Inbox", outline: "fa-regular-envelope-open", solid: "fa-solid-envelope-open" },
  { name: "Calendar", outline: "fa-regular-calendar", solid: "fa-solid-calendar" },
  { name: "Files", outline: "fa-regular-folder", solid: "fa-solid-folder" },
  { name: "Alerts", outline: "fa-regular-bell", solid: "fa-solid-bell" },
];

/** A bottom tab bar: the active tab's icon fills in, and the one it leaves hollows out. */
const TabBar = (): ReactElement => {
  const [active, setActive] = useState(0);
  return (
    <div
      role="tablist"
      aria-label="Example app tabs"
      className="flex w-full max-w-[16rem] justify-around rounded-2xl border border-neutral-200 bg-white px-2 py-2 shadow-sm dark:border-white/10 dark:bg-neutral-900"
    >
      {TABS.map((tab, index) => (
        <button
          key={tab.name}
          type="button"
          role="tab"
          aria-selected={index === active}
          onClick={() => setActive(index)}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors ${
            index === active
              ? "text-orange-500"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <Morph
            icon={icon(index === active ? tab.solid : tab.outline)}
            spring={SNAPPY}
            className="size-5"
          />
          {tab.name}
        </button>
      ))}
    </div>
  );
};

/** A theme switch: its icon morphs sun ↔ moon (a vetted pair) over a small preview of the theme. */
const ThemeSwitch = (): ReactElement => {
  const [isDark, setIsDark] = useState(false);
  return (
    <div
      className={`w-full max-w-[15rem] rounded-2xl border p-3 shadow-sm transition-colors duration-300 ${
        isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-semibold transition-colors duration-300 ${isDark ? "text-white" : "text-neutral-950"}`}
        >
          Appearance
        </span>
        <button
          type="button"
          aria-pressed={isDark}
          aria-label={isDark ? "Use light theme" : "Use dark theme"}
          onClick={() => setIsDark(!isDark)}
          className={`grid size-9 cursor-pointer place-items-center rounded-full border transition-colors duration-300 ${
            isDark
              ? "border-white/15 text-orange-400 hover:border-orange-400/60"
              : "border-neutral-200 text-orange-500 hover:border-orange-400"
          }`}
        >
          <Morph icon={isDark ? MOON_ICON : SUN_ICON} spring={BOUNCY} className="size-4" />
        </button>
      </div>
      <div aria-hidden="true" className="mt-3 space-y-1.5">
        <div
          className={`h-2 w-3/4 rounded-full transition-colors duration-300 ${isDark ? "bg-white/20" : "bg-neutral-200"}`}
        />
        <div
          className={`h-2 w-1/2 rounded-full transition-colors duration-300 ${isDark ? "bg-white/10" : "bg-neutral-100"}`}
        />
      </div>
    </div>
  );
};

const TRACKS = [
  { title: "Wildfire", artist: "The Embers", art: "fa-solid-fire" },
  { title: "Seedling", artist: "Green Room", art: "fa-solid-seedling" },
  { title: "Gemstone", artist: "Low Light", art: "fa-solid-gem" },
];

/** A mini player: play ↔ pause morphs, and previous/next morph the artwork to the new track. */
const MediaPlayer = (): ReactElement => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [track, setTrack] = useState(0);
  const current = TRACKS[track] as (typeof TRACKS)[number];
  const step = (by: number) => setTrack((index) => (index + by + TRACKS.length) % TRACKS.length);
  const controlClass =
    "grid size-9 cursor-pointer place-items-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10";
  return (
    <div className="flex w-full max-w-[16rem] items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-300 text-neutral-950">
        <Morph icon={icon(current.art)} spring={SMOOTH} className="size-5" />
      </span>
      <span className="min-w-0 flex-1" aria-live="polite">
        <span className="block truncate text-sm font-semibold text-neutral-950 dark:text-white">
          {current.title}
        </span>
        <span className="block truncate text-xs text-neutral-500">{current.artist}</span>
      </span>
      <span className="flex items-center">
        <button
          type="button"
          aria-label="Previous track"
          onClick={() => step(-1)}
          className={controlClass}
        >
          <Morph icon={icon("fa-solid-backward-step")} spring={SNAPPY} className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={() => setIsPlaying(!isPlaying)}
          className="grid size-9 cursor-pointer place-items-center rounded-full bg-orange-500 text-neutral-950 transition-colors hover:bg-orange-400"
        >
          <Morph
            icon={icon(isPlaying ? "fa-solid-pause" : "fa-solid-play")}
            spring={SNAPPY}
            className="size-3.5"
          />
        </button>
        <button
          type="button"
          aria-label="Next track"
          onClick={() => step(1)}
          className={controlClass}
        >
          <Morph icon={icon("fa-solid-forward-step")} spring={SNAPPY} className="size-3.5" />
        </button>
      </span>
    </div>
  );
};

/**
 * A settings row: muting notifications morphs the bell into the struck-through bell, and the
 * switch from on to off.
 */
const MuteNotifications = (): ReactElement => {
  const [isMuted, setIsMuted] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isMuted}
      onClick={() => setIsMuted(!isMuted)}
      className="flex w-full max-w-[15rem] cursor-pointer items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 text-left shadow-sm transition-colors hover:border-orange-300 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-orange-400/50"
    >
      <span className={isMuted ? "text-neutral-400 dark:text-neutral-500" : "text-orange-500"}>
        <Morph
          icon={icon(isMuted ? "fa-solid-bell-slash" : "fa-solid-bell")}
          spring={SMOOTH}
          className="size-5"
        />
      </span>
      <span className="flex-1 text-sm font-medium text-neutral-900 dark:text-white">
        Notifications
      </span>
      {/* The switch itself morphs too (§1e #6): Font Awesome's toggle-on ↔ toggle-off, both in
          the vetted set, instead of a CSS knob sliding. */}
      <span
        aria-hidden="true"
        className={`transition-colors duration-300 ${isMuted ? "text-neutral-400 dark:text-neutral-500" : "text-orange-500"}`}
      >
        <Morph
          icon={icon(isMuted ? "fa-solid-toggle-off" : "fa-solid-toggle-on")}
          spring={SNAPPY}
          className="size-7"
        />
      </span>
    </button>
  );
};

export const UseCases = (): ReactElement => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        title="Wishlist and favorites"
        why="Product cards and saved items. The outline fills from the inside, so the tap visibly did something; a swap just blinks."
      >
        <Wishlist />
      </Card>
      <Card
        title="Read and unread"
        why="Inbox and chat rows. Marking as read hollows the icon out in one motion, legible at a glance."
      >
        <ReadUnread />
      </Card>
      <Card
        title="Upload complete"
        why="File uploads and saves. File, cloud, check read as one continuous event, not three unrelated pictures."
      >
        <Upload />
      </Card>
      <Card
        title="Reactions"
        why="Like and react buttons. A little overshoot gives the press the small reward of a physical button."
      >
        <Reaction />
      </Card>
      <Card
        title="Onboarding steps"
        why="Sign-up and checkout flows. Each step grows out of the last (ring, dot, check), so progress feels continuous."
      >
        <Onboarding />
      </Card>
      <Card
        title="Tab bars"
        why="App navigation. The tab you pick fills in as the one you left hollows out, so the move between them is visible."
      >
        <TabBar />
      </Card>
      <Card
        title="Theme toggle"
        why="Settings and headers. Sun turning into moon says what just changed, where an icon swap only flashes."
      >
        <ThemeSwitch />
      </Card>
      <Card
        title="Media controls"
        why="Players. Play and pause share one button, and the artwork changes shape with the track instead of blinking."
      >
        <MediaPlayer />
      </Card>
      <Card
        title="Mute and unmute"
        why="Notification settings. The bell getting struck through reads as an action, not a different picture."
      >
        <MuteNotifications />
      </Card>
    </div>
  );
};
