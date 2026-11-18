// Checks the full-colour-on-light Wordmark in the build output.
// Run `npm test` (builds first); tests never import generator code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { buildPath, parseSvg, readSource, readVoxels, sourceWordmarkPicture, voxelPicture } from "./lib/output.js";

const SVG = buildPath("logo/wordmark/ideas-wordmark-color-on-light.svg");
const PNG_1200 = buildPath("logo/wordmark/ideas-wordmark-color-on-light-1200.png");
// The seven-step Transfer-Function Ramp fixed by the spec (#1).
const RAMP = ["#1e3a8a", "#1d4ed8", "#0284c7", "#0ea5e9", "#14b8a6", "#84cc16", "#f59e0b"];
const readWordmarkSvg = () => parseSvg(readFileSync(SVG, "utf8"));
const readWordmarkPng = () => PNG.sync.read(readFileSync(PNG_1200));

test("Wordmark colour-on-light SVG parses as SVG", () => {
  const svg = readWordmarkSvg();
  assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg");
  assert.match(svg.getAttribute("viewBox"), /^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
});

test("Wordmark Voxels and Hollow Voxels sit where the source definition puts them", () => {
  const voxels = readVoxels(readWordmarkSvg());
  const expected = sourceWordmarkPicture(readSource());
  const count = (pic, ch) => pic.join("").split(ch).length - 1;

  assert.equal(voxels.filter((v) => !v.hollow).length, count(expected, "#"), "filled Voxel count");
  assert.equal(voxels.filter((v) => v.hollow).length, count(expected, "o"), "Hollow Voxel count");
  assert.deepEqual(voxelPicture(voxels), expected);
});

test("Wordmark Voxels are coloured by the Transfer-Function Ramp from left to right", () => {
  const voxels = readVoxels(readWordmarkSvg()).sort((a, b) => a.col - b.col);
  const step = (v) => RAMP.indexOf(v.colour);

  for (const v of voxels) assert.notEqual(step(v), -1, `Voxel at column ${v.col} has off-ramp colour ${v.colour}`);
  for (let i = 1; i < voxels.length; i++) {
    const [a, b] = [voxels[i - 1], voxels[i]];
    if (a.col === b.col) assert.equal(b.colour, a.colour, `column ${a.col} mixes colours`);
    else assert.ok(step(b) >= step(a), `column ${b.col} (${b.colour}) steps back from column ${a.col} (${a.colour})`);
  }
  assert.equal(voxels[0].colour, RAMP[0], "leftmost column starts the ramp");
  assert.equal(voxels.at(-1).colour, RAMP.at(-1), "rightmost column ends the ramp");
  assert.deepEqual([...new Set(voxels.map((v) => v.colour))], RAMP, "every ramp step is used, in order");
});

test("Wordmark colour-on-light PNG is 1200px wide with the SVG's proportions", () => {
  const png = readWordmarkPng();
  const [, , w, h] = readWordmarkSvg().getAttribute("viewBox").split(" ").map(Number);
  assert.equal(png.width, 1200);
  assert.equal(png.height, Math.round((1200 * h) / w));
});

test("Wordmark colour-on-light PNG has a transparent background and ramp-coloured Voxels", () => {
  const png = readWordmarkPng();
  const pixel = (x, y) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4)];
  assert.equal(pixel(0, 0)[3], 0, "top-left corner is transparent");
  const opaque = new Set();
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 255) opaque.add("#" + [...png.data.subarray(i, i + 3)].map((c) => c.toString(16).padStart(2, "0")).join(""));
  }
  for (const c of RAMP) assert.ok(opaque.has(c), `no solid ${c} pixels`);
});
