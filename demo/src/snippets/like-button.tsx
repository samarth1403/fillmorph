import { FillMorph } from "fillmorph/react";
import { heartOutline, heartSolid } from "./icons"; // <svg> markup strings

export const Like = ({ liked }: { liked: boolean }) => {
  return <FillMorph icon={liked ? heartSolid : heartOutline} />;
};
