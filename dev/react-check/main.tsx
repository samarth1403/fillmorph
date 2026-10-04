import { HeartIcon, StarIcon } from "@heroicons/react/24/solid";
import { parseIcon, type SpringConfig } from "fillmorph";
import { createMorphDriver } from "fillmorph/dom";
import {
  FillMorph,
  type FillMorphHandle,
  type FillMorphIcon,
  type FillmorphError,
} from "fillmorph/react";
import { Circle as LucideCircle, Heart as LucideHeart } from "lucide-react";
import { type ReactElement, type RefObject, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { IconBaseProps } from "react-icons";
import {
  FaB,
  FaBullseye,
  FaCircle,
  FaHeart,
  FaRegBell,
  FaRegCircle,
  FaRegCircleDot,
  FaRegHeart,
  FaRegStar,
  FaUser,
} from "react-icons/fa6";
import { MdFavorite } from "react-icons/md";
import type { FixtureName } from "../../harness/fixtures.ts";
import { REFERENCE_PAIRS } from "../../harness/pairs.ts";
import { FIXTURE_LIST, FIXTURES } from "./fixtures.ts";

/**
 * Spec 06's by-eye check: `<FillMorph>` in all three modes on the harness's reference icons,
 * through the built `fillmorph/react`, plus spec 09's icon elements (react-icons, lucide-react).
 * No automated checks; see dev/react-check/index.html.
 */

const SIZE = 200;
/** Matches the playback harness's scripted interruption: retarget 0.2 s into the first leg. */
const INTERRUPT_AFTER_MS = 200;
/** Not well-formed XML, to see `onError` fire while the last shape stays. */
const MALFORMED = '<svg viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"></svg';

function label(name: FixtureName): string {
  return name.replace(/^fa-/, "");
}

const IconButtons = ({
  current,
  onPick,
}: {
  current: string | null;
  onPick: (name: FixtureName) => void;
}): ReactElement => {
  return (
    <div className="buttons">
      {FIXTURE_LIST.map((name) => (
        <button
          key={name}
          type="button"
          className={FIXTURES[name] === current ? "active" : undefined}
          onClick={() => onPick(name)}
        >
          {label(name)}
        </button>
      ))}
    </div>
  );
};

const UncontrolledSection = (): ReactElement => {
  const [icon, setIcon] = useState(FIXTURES["fa-solid-heart"]);
  // Bumping the key remounts the component, so a scripted pair starts at rest on its `from`.
  const [mountKey, setMountKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const pick = (markup: string) => {
    clearTimers();
    setError(null);
    setIcon(markup);
  };

  const playPair = (pair: (typeof REFERENCE_PAIRS)[number]) => {
    clearTimers();
    setError(null);
    setMountKey((key) => key + 1);
    setIcon(FIXTURES[pair.from]);
    timers.current = [
      window.setTimeout(() => setIcon(FIXTURES[pair.to]), 400),
      window.setTimeout(() => setIcon(FIXTURES[pair.interruptTo]), 400 + INTERRUPT_AFTER_MS),
    ];
  };

  return (
    <section>
      <h2>Uncontrolled</h2>
      <p>
        Click icons to change the <code>icon</code> prop; click again mid-morph to interrupt. Look
        for: no snap or pause at an interruption, no blank frame, holes growing and collapsing
        inside their parents.
      </p>
      <FillMorph
        key={mountKey}
        icon={icon}
        onError={(e: FillmorphError) => setError(`${e.name}: ${e.message}`)}
        width={SIZE}
        height={SIZE}
        fill="currentColor"
        aria-label="Uncontrolled morph"
      />
      <IconButtons current={icon} onPick={(name) => pick(FIXTURES[name])} />
      <div className="buttons">
        <button type="button" onClick={() => pick(MALFORMED)}>
          malformed icon (onError)
        </button>
      </div>
      {error !== null ? <p className="error">{error}</p> : null}
      <h3>Reference pairs, scripted like playback.html</h3>
      <p>
        Starts at rest on <code>from</code>, changes <code>icon</code> to <code>to</code>, then to
        the interrupt icon {INTERRUPT_AFTER_MS} ms later.
      </p>
      <div className="buttons">
        {REFERENCE_PAIRS.map((pair) => (
          <button key={pair.name} type="button" onClick={() => playPair(pair)}>
            {label(pair.from)} → {label(pair.to)} ⤳ {label(pair.interruptTo)}
          </button>
        ))}
      </div>
    </section>
  );
};

const ControlledSection = ({
  controlledRef,
}: {
  controlledRef: RefObject<FillMorphHandle | null>;
}): ReactElement => {
  const [pairName, setPairName] = useState(REFERENCE_PAIRS[0]?.name ?? "");
  const [progress, setProgress] = useState(0);
  const pair =
    REFERENCE_PAIRS.find((candidate) => candidate.name === pairName) ?? REFERENCE_PAIRS[0];
  if (pair === undefined) return <p>No reference pairs.</p>;

  return (
    <section>
      <h2>Controlled</h2>
      <p>
        The slider drives <code>progress</code> directly; nothing animates on its own. The range
        runs past [0, 1] on purpose: out there the shape should hold still (clamped).
      </p>
      <FillMorph
        ref={controlledRef}
        icon={FIXTURES[pair.from]}
        to={FIXTURES[pair.to]}
        progress={progress}
        width={SIZE}
        height={SIZE}
        fill="currentColor"
        aria-label="Controlled morph"
      />
      <div className="controls">
        <select value={pairName} onChange={(event) => setPairName(event.target.value)}>
          {REFERENCE_PAIRS.map((candidate) => (
            <option key={candidate.name} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
        <input
          type="range"
          min={-0.2}
          max={1.2}
          step={0.001}
          value={progress}
          onChange={(event) => setProgress(Number(event.target.value))}
          aria-label="progress"
        />
        <output>progress {progress.toFixed(3)}</output>
      </div>
    </section>
  );
};

const ImperativeSection = ({
  controlledRef,
}: {
  controlledRef: RefObject<FillMorphHandle | null>;
}): ReactElement => {
  const ref = useRef<FillMorphHandle>(null);
  return (
    <section>
      <h2>Imperative</h2>
      <p>
        The <code>icon</code> prop stays on the solid heart; these buttons call{" "}
        <code>ref.current.morphTo(…)</code>. Same look-fors as uncontrolled.
      </p>
      <FillMorph
        ref={ref}
        icon={FIXTURES["fa-solid-heart"]}
        width={SIZE}
        height={SIZE}
        fill="currentColor"
        aria-label="Imperative morph"
      />
      <IconButtons current={null} onPick={(name) => ref.current?.morphTo(FIXTURES[name])} />
      <div className="buttons">
        <button
          type="button"
          onClick={() => controlledRef.current?.morphTo(FIXTURES["fa-solid-circle"])}
        >
          morphTo on the controlled instance (no-op; warns in the console)
        </button>
      </div>
    </section>
  );
};

/**
 * Spec 09: each reference icon's react-icons twin (`react-icons/fa6` draws the same FA 6.7.2 path
 * data as the committed fixture), passed as an element rather than markup. Created inline on every
 * render on purpose, as typical app code does, so a needless restart would show.
 */
const ELEMENT_TWINS: Record<
  FixtureName,
  { label: string; render: (props?: IconBaseProps) => ReactElement }
> = {
  "fa-regular-bell": { label: "<FaRegBell />", render: (props) => <FaRegBell {...props} /> },
  "fa-regular-circle": { label: "<FaRegCircle />", render: (props) => <FaRegCircle {...props} /> },
  "fa-regular-circle-dot": {
    label: "<FaRegCircleDot />",
    render: (props) => <FaRegCircleDot {...props} />,
  },
  "fa-regular-heart": { label: "<FaRegHeart />", render: (props) => <FaRegHeart {...props} /> },
  "fa-regular-star": { label: "<FaRegStar />", render: (props) => <FaRegStar {...props} /> },
  "fa-solid-b": { label: "<FaB />", render: (props) => <FaB {...props} /> },
  "fa-solid-bullseye": { label: "<FaBullseye />", render: (props) => <FaBullseye {...props} /> },
  "fa-solid-circle": { label: "<FaCircle />", render: (props) => <FaCircle {...props} /> },
  "fa-solid-heart": { label: "<FaHeart />", render: (props) => <FaHeart {...props} /> },
  "fa-solid-user": { label: "<FaUser />", render: (props) => <FaUser {...props} /> },
};

const ElementSection = (): ReactElement => {
  const [name, setName] = useState<FixtureName>("fa-solid-heart");
  const [progress, setProgress] = useState(0.5);
  const [isStroke, setIsStroke] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHeroHeart, setIsHeroHeart] = useState(true);
  const icon: FillMorphIcon = isStroke ? <LucideHeart /> : ELEMENT_TWINS[name].render();
  const twinIndex = FIXTURE_LIST.indexOf(name);

  return (
    <section>
      <h2>Icon elements (spec 09)</h2>
      <p>
        Same as uncontrolled, but <code>icon</code> is a react-icons element (
        <code>icon={"{<FaHeart />}"}</code>), recreated on every render. Each button is the element
        twin of the same-position markup icon above (identical FA 6.7.2 paths). Look for: the same
        morphs as the markup icons, and no restart or stutter while the slider below re-renders this
        section mid-morph.
      </p>
      <FillMorph
        icon={icon}
        onError={(e: FillmorphError) => setError(`${e.name}: ${e.message}`)}
        width={SIZE}
        height={SIZE}
        fill="currentColor"
        aria-label="Element morph"
      />
      <div className="buttons">
        {FIXTURE_LIST.map((fixture) => (
          <button
            key={fixture}
            type="button"
            className={!isStroke && fixture === name ? "active" : undefined}
            onClick={() => {
              setIsStroke(false);
              setError(null);
              setName(fixture);
            }}
          >
            {ELEMENT_TWINS[fixture].label}
          </button>
        ))}
      </div>
      <div className="buttons">
        <button type="button" onClick={() => setIsStroke(true)}>
          lucide-react &lt;Heart /&gt; (stroke icon: onError, shape stays)
        </button>
      </div>
      {error !== null ? <p className="error">{error}</p> : null}
      <h3>Attributes from the element (0.2.1)</h3>
      <p>
        These two <code>&lt;FillMorph&gt;</code>s get no <code>fill</code>, size or style props of
        their own: everything comes from the element's rendered <code>&lt;svg&gt;</code>. Left: the
        same twin as above, styled by react-icons' own <code>color</code>/<code>size</code>,
        alternating crimson and royal blue per icon. Right: heroicons, styled by plain{" "}
        <code>style</code>. Look for: the size and color matching the element, the color snapping
        (not fading) at each change while the shape springs, and the bounce not being clipped.
      </p>
      <div className="buttons">
        <FillMorph
          icon={ELEMENT_TWINS[name].render({
            color: twinIndex % 2 === 0 ? "crimson" : "royalblue",
            size: 120,
          })}
          aria-label="Element attributes, react-icons"
        />
        <FillMorph
          icon={
            isHeroHeart ? (
              <HeartIcon style={{ color: "seagreen", width: 120, height: 120 }} />
            ) : (
              <StarIcon style={{ color: "darkorange", width: 120, height: 120 }} />
            )
          }
          aria-label="Element attributes, heroicons"
        />
      </div>
      <div className="buttons">
        <button type="button" onClick={() => setIsHeroHeart((value) => !value)}>
          heroicons: {isHeroHeart ? "<HeartIcon /> → <StarIcon />" : "<StarIcon /> → <HeartIcon />"}
        </button>
      </div>
      <h3>Controlled, elements for both ends</h3>
      <FillMorph
        icon={<FaRegCircleDot />}
        to={<FaHeart />}
        progress={progress}
        width={SIZE}
        height={SIZE}
        fill="currentColor"
        aria-label="Controlled element morph"
      />
      <div className="controls">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(event) => setProgress(Number(event.target.value))}
          aria-label="element progress"
        />
        <output>&lt;FaRegCircleDot /&gt; → &lt;FaHeart /&gt; at {progress.toFixed(3)}</output>
      </div>
    </section>
  );
};

const NON_FINITE_PROGRESS: [string, number][] = [
  ["0", 0],
  ["NaN (0 / 0)", 0 / 0],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["1", 1],
  ["-Infinity", Number.NEGATIVE_INFINITY],
];
const PARTIAL_SPRING = { stiffness: 2000 } as SpringConfig;

/** What `createMorphDriver` itself throws for `config`: the error the component must match. */
function driverErrorFor(config: SpringConfig): string {
  const square = '<svg viewBox="0 0 10 10"><path d="M0 0H10V10H0Z"/></svg>';
  const contours = parseIcon(square).contours;
  try {
    createMorphDriver(contours, contours, config).stop();
    return "(no error)";
  } catch (error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}

/**
 * Mounts a `<FillMorph>` with a partial `springConfig` in a root of its own, so the error it
 * throws (from an effect, where only an error boundary or the root sees it) is shown here
 * instead of unmounting the whole page.
 */
const PartialSpringCheck = (): ReactElement => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [caught, setCaught] = useState<string | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    // A fresh child each time: StrictMode re-runs this effect before the deferred unmount below.
    const mountPoint = host.appendChild(document.createElement("div"));
    const root = createRoot(mountPoint, {
      onUncaughtError: (error) =>
        setCaught(error instanceof Error ? `${error.name}: ${error.message}` : String(error)),
    });
    root.render(
      <FillMorph
        icon={FIXTURES["fa-solid-heart"]}
        springConfig={PARTIAL_SPRING}
        width={80}
        height={80}
      />,
    );
    return () => {
      window.setTimeout(() => {
        root.unmount();
        mountPoint.remove();
      });
    };
  }, []);
  const expected = driverErrorFor(PARTIAL_SPRING);
  return (
    <>
      <div ref={hostRef} />
      <p>
        <code>{"<FillMorph springConfig={{ stiffness: 2000 }}>"}</code> threw:
      </p>
      <p className="error">{caught ?? "(nothing yet - this is the bug)"}</p>
      <p>
        <code>createMorphDriver(…, {"{ stiffness: 2000 }"})</code> throws:
      </p>
      <p className="error">{expected}</p>
      <p>{caught === expected ? "✓ identical" : "✗ different"}</p>
    </>
  );
};

/** Spec 10's by-eye checks (0.2.2): non-finite controlled progress, partial springConfig, MD icons. */
const BugFixSection = (): ReactElement => {
  const [progress, setProgress] = useState(0);
  const [mdError, setMdError] = useState<string | null>(null);
  const [lucideError, setLucideError] = useState<string | null>(null);
  return (
    <section>
      <h2>Bug fixes (spec 10, 0.2.2)</h2>
      <h3>Non-finite controlled progress</h3>
      <p>
        Regular heart → solid heart. Each button sets <code>progress</code> directly. Look for: NaN
        draws the same as 0, Infinity the same as 1, -Infinity the same as 0, and the page never
        goes blank (in 0.2.1 these unmounted the whole tree).
      </p>
      <FillMorph
        icon={FIXTURES["fa-regular-heart"]}
        to={FIXTURES["fa-solid-heart"]}
        progress={progress}
        width={SIZE}
        height={SIZE}
        fill="currentColor"
        aria-label="Non-finite progress check"
      />
      <div className="buttons">
        {NON_FINITE_PROGRESS.map(([text, value]) => (
          <button
            key={text}
            type="button"
            className={Object.is(progress, value) ? "active" : undefined}
            onClick={() => setProgress(value)}
          >
            progress = {text}
          </button>
        ))}
      </div>
      <h3>Partial springConfig</h3>
      <p>
        Look for: the component's error matches the driver's word for word (in 0.2.1 it threw
        nothing and silently used the default spring).
      </p>
      <PartialSpringCheck />
      <h3>Material Design and stroke-only shapes</h3>
      <p>
        Left: react-icons' <code>{"<MdFavorite />"}</code>, which 0.2.1 rejected for its invisible
        bounding-box path; it should draw a heart. Right: lucide-react's <code>{"<Circle />"}</code>
        , which should report a stroke/outline error, not "no &lt;path&gt;".
      </p>
      <div className="buttons">
        <FillMorph
          icon={<MdFavorite />}
          onError={(e: FillmorphError) => setMdError(`${e.name}: ${e.message}`)}
          width={120}
          height={120}
          fill="crimson"
          aria-label="MdFavorite"
        />
        <FillMorph
          icon={<LucideCircle />}
          onError={(e: FillmorphError) => setLucideError(`${e.name}: ${e.message}`)}
          width={120}
          height={120}
          aria-label="Lucide Circle"
        />
      </div>
      {mdError !== null ? <p className="error">MdFavorite: {mdError}</p> : null}
      <p className="error">Lucide Circle: {lucideError ?? "(no error yet)"}</p>
    </section>
  );
};

const App = (): ReactElement => {
  const controlledRef = useRef<FillMorphHandle>(null);
  return (
    <>
      <UncontrolledSection />
      <ControlledSection controlledRef={controlledRef} />
      <ImperativeSection controlledRef={controlledRef} />
      <ElementSection />
      <BugFixSection />
    </>
  );
};

const container = document.getElementById("root");
if (container === null) throw new Error("dev/react-check/index.html has no #root");
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
