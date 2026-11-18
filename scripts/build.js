// The one build command: `npm run build`. Recreates build/ from src/brand.json.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBrand, layOutWordmark } from "./lib/brand.js";
import { voxelGridSvg } from "./lib/svg.js";
import { svgToPng } from "./lib/png.js";

const PNG_WIDTHS = [1200];
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
const svg = voxelGridSvg(layOutWordmark(brand), { label: brand.wordmark.text });
const name = "logo/wordmark/ideas-wordmark-color-on-light";
write(`${name}.svg`, svg);
for (const width of PNG_WIDTHS) write(`${name}-${width}.png`, svgToPng(svg, width));
