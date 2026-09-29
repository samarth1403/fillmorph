import type { Point } from "../contour";

/** One drawing segment in absolute coordinates, starting at the previous segment's end. */
export type Segment =
  | { kind: "line"; to: Point }
  | { kind: "cubic"; ctrl1: Point; ctrl2: Point; to: Point }
  | { kind: "quadratic"; ctrl: Point; to: Point }
  | {
      kind: "arc";
      rx: number;
      ry: number;
      xAxisRotation: number;
      isLargeArc: boolean;
      isSweep: boolean;
      to: Point;
    };

/** One subpath of a `d` string: a start point, its segments, and whether it ended with `Z`. */
export type Subpath = {
  start: Point;
  segments: Segment[];
  hasClosePath: boolean;
};

/** A syntax problem in a `d` string, located by character offset. */
export class PathDataSyntaxError extends Error {
  override name = "PathDataSyntaxError";
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

const PARAMETER_COUNTS: Readonly<Record<string, number>> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

const NUMBER_PATTERN = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

/**
 * Parses an SVG path `d` string into subpaths of absolute-coordinate segments, following the
 * SVG 1.1 path grammar: relative commands are resolved, `H`/`V` become lines, `S`/`T` get their
 * reflected control points, implicit repeated parameters are honoured (extra pairs after `M` are
 * line-tos), and a command after `Z` without a new `M` starts a new subpath at the closed one's
 * start. A lone move-to (one not followed by any drawing command or `Z`) draws nothing and is
 * dropped; `M x y Z` is kept as an empty closed subpath so it can be rejected as degenerate.
 *
 * @throws PathDataSyntaxError on any deviation from the grammar (the caller wraps it in the
 *   public error type with the path's identity).
 */
export function parsePathData(d: string): Subpath[] {
  const subpaths: Subpath[] = [];
  let i = 0;
  let current: Point = { x: 0, y: 0 };
  let subpath: Subpath | undefined;
  let previousCubicCtrl: Point | undefined;
  let previousQuadraticCtrl: Point | undefined;

  const fail = (message: string): never => {
    throw new PathDataSyntaxError(message, i);
  };
  const skipWhitespace = (): void => {
    while (i < d.length && isPathWhitespace(d.charCodeAt(i))) i++;
  };
  const skipSeparator = (): void => {
    skipWhitespace();
    if (d[i] === ",") {
      i++;
      skipWhitespace();
    }
  };
  const peekIsNumber = (): boolean => {
    NUMBER_PATTERN.lastIndex = i;
    return NUMBER_PATTERN.test(d);
  };
  const readNumber = (): number => {
    NUMBER_PATTERN.lastIndex = i;
    const match = NUMBER_PATTERN.exec(d);
    if (!match) return fail(`expected a number at "${d.slice(i, i + 12)}"`);
    const value = Number(match[0]);
    if (!Number.isFinite(value)) return fail(`number "${match[0]}" is out of range`);
    i = NUMBER_PATTERN.lastIndex;
    return value;
  };
  const readFlag = (): boolean => {
    const char = d[i];
    if (char !== "0" && char !== "1")
      return fail(`expected an arc flag (0 or 1) at "${d.slice(i, i + 12)}"`);
    i++;
    return char === "1";
  };
  const beginSubpathIfNeeded = (): Subpath => {
    if (!subpath) {
      subpath = { start: current, segments: [], hasClosePath: false };
      subpaths.push(subpath);
    }
    return subpath;
  };
  const addSegment = (segment: Segment): void => {
    beginSubpathIfNeeded().segments.push(segment);
    current = segment.to;
  };

  skipWhitespace();
  if (i >= d.length) fail("path data is empty");

  let command: string | undefined;
  while (i < d.length) {
    const char = d[i] as string;
    if (!/[A-Za-z]/.test(char)) {
      return fail(
        command === undefined
          ? `path data must start with a move-to command ("M" or "m"), not "${char}"`
          : `unexpected "${char}" — expected a command letter`,
      );
    }
    if (PARAMETER_COUNTS[char.toUpperCase()] === undefined) fail(`unknown command "${char}"`);
    const upper = char.toUpperCase();
    if (command === undefined && upper !== "M") {
      fail(`path data must start with a move-to command ("M" or "m"), not "${char}"`);
    }
    command = char;
    const isRelative = command !== upper;
    i++;
    skipWhitespace();

    if (upper === "Z") {
      // `M x y Z` closes a subpath with no segments; keep it so it's rejected as degenerate later.
      beginSubpathIfNeeded().hasClosePath = true;
      current = subpath?.start ?? current;
      subpath = undefined;
      previousCubicCtrl = undefined;
      previousQuadraticCtrl = undefined;
      skipWhitespace();
      continue;
    }

    for (let groupCount = 0; ; groupCount++) {
      const params = readParameters(upper);
      const base = isRelative ? current : { x: 0, y: 0 };
      const at = (index: number): Point => ({
        x: base.x + (params[index] as number),
        y: base.y + (params[index + 1] as number),
      });

      let cubicCtrl: Point | undefined;
      let quadraticCtrl: Point | undefined;
      if (upper === "M") {
        if (groupCount === 0) {
          current = at(0);
          subpath = undefined;
        } else {
          addSegment({ kind: "line", to: at(0) });
        }
      } else if (upper === "L") {
        addSegment({ kind: "line", to: at(0) });
      } else if (upper === "H") {
        addSegment({ kind: "line", to: { x: base.x + (params[0] as number), y: current.y } });
      } else if (upper === "V") {
        addSegment({
          kind: "line",
          to: { x: current.x, y: (isRelative ? current.y : 0) + (params[0] as number) },
        });
      } else if (upper === "C") {
        cubicCtrl = at(2);
        addSegment({ kind: "cubic", ctrl1: at(0), ctrl2: cubicCtrl, to: at(4) });
      } else if (upper === "S") {
        cubicCtrl = at(0);
        addSegment({
          kind: "cubic",
          ctrl1: reflect(previousCubicCtrl, current),
          ctrl2: cubicCtrl,
          to: at(2),
        });
      } else if (upper === "Q") {
        quadraticCtrl = at(0);
        addSegment({ kind: "quadratic", ctrl: quadraticCtrl, to: at(2) });
      } else if (upper === "T") {
        quadraticCtrl = reflect(previousQuadraticCtrl, current);
        addSegment({ kind: "quadratic", ctrl: quadraticCtrl, to: at(0) });
      } else {
        addSegment({
          kind: "arc",
          rx: Math.abs(params[0] as number),
          ry: Math.abs(params[1] as number),
          xAxisRotation: params[2] as number,
          isLargeArc: params[3] === 1,
          isSweep: params[4] === 1,
          to: at(5),
        });
      }
      previousCubicCtrl = cubicCtrl;
      previousQuadraticCtrl = quadraticCtrl;

      const groupEnd = i;
      skipSeparator();
      if (!peekIsNumber()) {
        i = groupEnd;
        break;
      }
    }
    skipWhitespace();
  }

  return subpaths.filter((candidate) => candidate.segments.length > 0 || candidate.hasClosePath);

  function readParameters(upper: string): number[] {
    const count = PARAMETER_COUNTS[upper] as number;
    const params: number[] = [];
    for (let index = 0; index < count; index++) {
      if (index > 0) skipSeparator();
      if (upper === "A" && (index === 3 || index === 4)) {
        params.push(readFlag() ? 1 : 0);
      } else {
        params.push(readNumber());
      }
    }
    return params;
  }
}

/** Reflects a previous control point through `current`; without one, the control is `current`. */
function reflect(previousCtrl: Point | undefined, current: Point): Point {
  if (!previousCtrl) return current;
  return { x: 2 * current.x - previousCtrl.x, y: 2 * current.y - previousCtrl.y };
}

function isPathWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c;
}
