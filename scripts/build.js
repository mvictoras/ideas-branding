// The one build command: `npm run build`. Recreates build/ from src/brand.json.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBrand } from "./lib/brand.js";
import { COLOUR_VERSIONS, PIECES, composeLogo } from "./lib/logo.js";
import { sceneToSvg } from "./lib/svg.js";
import { sceneToPdf } from "./lib/pdf.js";
import { svgToPng } from "./lib/png.js";

const PNG_WIDTHS = [400, 800, 1200, 2400];
const OUT = fileURLToPath(new URL("../build/", import.meta.url));

function write(rel, data) {
  const file = OUT + rel;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`  ${rel}`);
}

rmSync(OUT, { recursive: true, force: true });
console.log("Building build/");

const brand = loadBrand();
for (const piece of PIECES) {
  for (const version of COLOUR_VERSIONS) {
    const scene = composeLogo(brand, piece, version);
    const name = `logo/${piece}/ideas-${piece}-${version}`;
    const svg = sceneToSvg(scene);
    write(`${name}.svg`, svg);
    for (const width of PNG_WIDTHS) write(`${name}-${width}.png`, svgToPng(svg, width));
    write(`${name}.pdf`, await sceneToPdf(scene));
  }
}
