/** One icon in the demo set: verbatim Font Awesome Free 6.7.2 markup plus its display names. */
export type DemoIcon = {
  /** Font Awesome's own file name, e.g. `fa-solid-heart`. Unique across the set. */
  id: string;
  /** Short human name, e.g. "Heart". */
  label: string;
  style: "solid" | "regular";
  markup: string;
};

/** One tab of the playground's picker. */
export type IconCategory = { name: string; icons: DemoIcon[] };

/**
 * Every file in `demo/icons/`, which holds exactly the shipped set: unmodified Font Awesome Free
 * 6.7.2 SVGs (Icons: CC BY 4.0, the license comment kept in each).
 */
const FILES = import.meta.glob<string>("../icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

const MARKUP_BY_ID = new Map(
  Object.entries(FILES).map(([path, markup]) => [
    path.slice(path.lastIndexOf("/") + 1, -".svg".length),
    markup,
  ]),
);

/** The picker's tabs, by icon id. `catalog.test.ts` checks this covers every file exactly once. */
const CATEGORY_IDS: readonly { name: string; ids: readonly string[] }[] = [
  {
    name: "Media",
    ids: [
      "fa-solid-play",
      "fa-solid-pause",
      "fa-solid-stop",
      "fa-solid-forward",
      "fa-solid-backward",
      "fa-solid-forward-step",
      "fa-solid-backward-step",
      "fa-solid-circle-play",
      "fa-regular-circle-play",
      "fa-solid-circle-pause",
      "fa-regular-circle-pause",
      "fa-solid-circle-stop",
      "fa-regular-circle-stop",
      "fa-solid-video",
      "fa-solid-camera",
      "fa-solid-volume-low",
      "fa-solid-volume-xmark",
      "fa-solid-gamepad",
    ],
  },
  {
    name: "Interface",
    ids: [
      "fa-solid-house",
      "fa-solid-house-chimney",
      "fa-solid-magnifying-glass",
      "fa-solid-gear",
      "fa-solid-lock",
      "fa-solid-eye",
      "fa-solid-bell",
      "fa-regular-bell",
      "fa-solid-bell-slash",
      "fa-solid-bookmark",
      "fa-solid-star",
      "fa-solid-heart",
      "fa-regular-heart",
      "fa-solid-pen",
      "fa-solid-plus",
      "fa-solid-minus",
      "fa-solid-xmark",
      "fa-solid-ellipsis",
      "fa-solid-grip",
      "fa-solid-filter",
      "fa-solid-compress",
      "fa-solid-toggle-on",
      "fa-solid-toggle-off",
      "fa-regular-window-maximize",
      "fa-solid-sun",
      "fa-solid-circle-half-stroke",
    ],
  },
  {
    name: "Status",
    ids: [
      "fa-regular-circle-check",
      "fa-solid-circle-xmark",
      "fa-regular-circle-xmark",
      "fa-solid-circle-info",
      "fa-solid-circle-exclamation",
      "fa-regular-circle-question",
      "fa-regular-square-check",
      "fa-regular-square-plus",
      "fa-regular-square-minus",
      "fa-regular-rectangle-xmark",
      "fa-regular-circle-up",
      "fa-regular-circle-down",
      "fa-regular-circle-left",
      "fa-regular-circle-right",
      "fa-regular-square-caret-up",
      "fa-regular-square-caret-down",
      "fa-regular-square-caret-left",
      "fa-regular-square-caret-right",
      "fa-solid-battery-full",
      "fa-solid-battery-half",
      "fa-solid-battery-empty",
      "fa-solid-shield",
      "fa-solid-shield-halved",
      "fa-regular-life-ring",
    ],
  },
  {
    name: "Messaging",
    ids: [
      "fa-solid-comment",
      "fa-regular-comment",
      "fa-solid-comments",
      "fa-regular-comment-dots",
      "fa-regular-message",
      "fa-solid-envelope-open",
      "fa-regular-envelope-open",
      "fa-solid-inbox",
      "fa-solid-user",
      "fa-solid-users",
      "fa-solid-user-group",
      "fa-regular-address-book",
      "fa-regular-address-card",
      "fa-regular-id-badge",
      "fa-solid-hashtag",
      "fa-solid-thumbs-down",
    ],
  },
  {
    name: "Emoji",
    ids: [
      "fa-regular-face-smile",
      "fa-solid-face-smile",
      "fa-regular-face-smile-beam",
      "fa-regular-face-smile-wink",
      "fa-regular-face-grin",
      "fa-regular-face-grin-beam",
      "fa-regular-face-grin-hearts",
      "fa-regular-face-grin-squint",
      "fa-regular-face-grin-stars",
      "fa-regular-face-grin-wide",
      "fa-regular-face-grin-wink",
      "fa-regular-face-laugh",
      "fa-regular-face-laugh-beam",
      "fa-regular-face-laugh-squint",
      "fa-regular-face-laugh-wink",
      "fa-regular-face-kiss",
      "fa-regular-face-kiss-beam",
      "fa-regular-face-meh",
      "fa-solid-face-meh",
      "fa-regular-face-meh-blank",
      "fa-regular-face-frown-open",
      "fa-solid-face-frown",
      "fa-regular-face-sad-tear",
      "fa-regular-face-surprise",
      "fa-regular-face-tired",
      "fa-regular-face-angry",
      "fa-regular-face-dizzy",
    ],
  },
  {
    name: "Files",
    ids: [
      "fa-solid-file",
      "fa-regular-file",
      "fa-solid-file-lines",
      "fa-regular-file-lines",
      "fa-regular-file-audio",
      "fa-regular-file-code",
      "fa-regular-file-excel",
      "fa-regular-file-video",
      "fa-solid-folder",
      "fa-regular-folder",
      "fa-solid-folder-open",
      "fa-solid-floppy-disk",
      "fa-regular-note-sticky",
      "fa-regular-rectangle-list",
      "fa-solid-database",
      "fa-solid-box",
      "fa-solid-cloud",
      "fa-solid-book-open",
      "fa-regular-keyboard",
      "fa-solid-mobile-screen",
      "fa-solid-tablet-screen-button",
    ],
  },
  {
    name: "Calendar",
    ids: [
      "fa-solid-calendar",
      "fa-regular-calendar",
      "fa-regular-calendar-days",
      "fa-regular-calendar-check",
      "fa-regular-calendar-plus",
      "fa-regular-calendar-minus",
      "fa-regular-calendar-xmark",
      "fa-regular-clock",
      "fa-solid-flag",
      "fa-regular-flag",
      "fa-solid-location-dot",
      "fa-solid-map",
      "fa-solid-compass",
    ],
  },
  {
    name: "Shapes",
    ids: [
      "fa-solid-circle",
      "fa-regular-circle",
      "fa-solid-circle-dot",
      "fa-regular-circle-dot",
      "fa-solid-square",
      "fa-regular-square",
      "fa-regular-square-full",
      "fa-solid-diamond",
      "fa-solid-cube",
      "fa-solid-shapes",
      "fa-solid-b",
      "fa-solid-gem",
      "fa-solid-fire",
      "fa-solid-seedling",
      "fa-solid-tree",
      "fa-regular-lemon",
      "fa-solid-coins",
      "fa-solid-bag-shopping",
      "fa-regular-building",
    ],
  },
];

const SPECIAL_LABELS: Record<string, string> = { b: "Letter B", "circle-half-stroke": "Contrast" };

function labelFor(name: string): string {
  const special = SPECIAL_LABELS[name];
  if (special !== undefined) return special;
  const words = name.replace(/^face-/, "").replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toIcon(id: string): DemoIcon {
  const markup = MARKUP_BY_ID.get(id);
  if (markup === undefined) throw new Error(`No file demo/icons/${id}.svg`);
  const style = id.startsWith("fa-regular-") ? "regular" : "solid";
  return { id, label: labelFor(id.replace(/^fa-(solid|regular)-/, "")), style, markup };
}

/**
 * The demo's icon set (spec 08 §1b #8), grouped into the playground's tabs. It was chosen so that
 * **every ordered pair** passes spec 03's geometry checks at 11 frames: 0 known-failing pairs.
 * `pnpm harness --vet-icons demo/icons` re-proves that on exactly these files.
 */
export const CATEGORIES: readonly IconCategory[] = CATEGORY_IDS.map((category) => ({
  name: category.name,
  icons: category.ids.map(toIcon),
}));

/** Every icon in the set, in picker order. */
export const ALL_ICONS: readonly DemoIcon[] = CATEGORIES.flatMap((category) => category.icons);

/** Ids of every file in `demo/icons/`, for the coverage test. */
export const FILE_IDS: readonly string[] = [...MARKUP_BY_ID.keys()];

/** Looks an icon up by `id`; throws for an unknown one, which would be a bug in the page. */
export function findIcon(id: string): DemoIcon {
  const found = ALL_ICONS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No demo icon "${id}"`);
  return found;
}
