import { parseIcon, renderContours } from "fillmorph";
import { createMorphDriver } from "fillmorph/dom";
import { heartOutline, heartSolid } from "./icons"; // <svg> markup strings

const path = document.querySelector("#like path") as SVGPathElement; // in <svg viewBox="0 0 100 100">
const outline = parseIcon(heartOutline).contours;
const solid = parseIcon(heartSolid).contours;

const driver = createMorphDriver(outline, solid);
driver.subscribe((shape) => path.setAttribute("d", renderContours(shape)));
