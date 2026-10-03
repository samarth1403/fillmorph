import { FillMorph } from "fillmorph/react";
// ?raw imports the file's SVG markup. Without it, Vite gives you the file's URL instead,
// and fillmorph rejects it as not being SVG.
import soundOn from "./volume-low.svg?raw";
import soundOff from "./volume-xmark.svg?raw";

export const SoundToggle = ({ muted }: { muted: boolean }) => {
  return <FillMorph icon={muted ? soundOff : soundOn} fill="currentColor" width={56} height={56} />;
};
