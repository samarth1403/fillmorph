import { FillMorph } from "fillmorph/react";
import heartOutline from "./heart-outline.svg?raw"; // ?raw: the SVG's markup, not its URL
import heartSolid from "./heart-solid.svg?raw";

export const Like = ({ liked }: { liked: boolean }) => {
  return <FillMorph icon={liked ? heartSolid : heartOutline} />;
};
