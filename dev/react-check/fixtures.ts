import type { FixtureName } from "../../harness/fixtures.ts";
import regularBell from "../../harness/fixtures/fa-regular-bell.svg";
import regularCircle from "../../harness/fixtures/fa-regular-circle.svg";
import regularCircleDot from "../../harness/fixtures/fa-regular-circle-dot.svg";
import regularHeart from "../../harness/fixtures/fa-regular-heart.svg";
import regularStar from "../../harness/fixtures/fa-regular-star.svg";
import solidB from "../../harness/fixtures/fa-solid-b.svg";
import solidBullseye from "../../harness/fixtures/fa-solid-bullseye.svg";
import solidCircle from "../../harness/fixtures/fa-solid-circle.svg";
import solidHeart from "../../harness/fixtures/fa-solid-heart.svg";
import solidUser from "../../harness/fixtures/fa-solid-user.svg";

/**
 * The harness's committed reference icons, as markup, bundled into the page (the harness itself
 * reads them from disk in Node). Typed against the harness's list, so none can go missing.
 */
export const FIXTURES: Record<FixtureName, string> = {
  "fa-regular-bell": regularBell,
  "fa-regular-circle": regularCircle,
  "fa-regular-circle-dot": regularCircleDot,
  "fa-regular-heart": regularHeart,
  "fa-regular-star": regularStar,
  "fa-solid-b": solidB,
  "fa-solid-bullseye": solidBullseye,
  "fa-solid-circle": solidCircle,
  "fa-solid-heart": solidHeart,
  "fa-solid-user": solidUser,
};

export const FIXTURE_LIST = Object.keys(FIXTURES) as FixtureName[];
