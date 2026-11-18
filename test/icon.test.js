// Checks the Icon and everything derived from it in the build output: the four
// colour versions, the favicon .ico, the Apple touch icon and the square
// avatar. Run `npm test` (builds first); tests never import generator code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { buildPath, parseSvg, readSource, readVoxels, voxelPicture } from "./lib/output.js";
import { readIco } from "./lib/ico.js";
import { readPdf } from "./lib/pdf.js";

const VERSIONS = ["color-on-light", "color-on-ink", "mono-ink", "mono-white"];
const PNG_WIDTHS = [400, 800, 1200, 2400];
const RAMP = ["#1e3a8a", "#1d4ed8", "#0284c7", "#0ea5e9", "#14b8a6", "#84cc16", "#f59e0b"];
// The ramp applied by column across the Icon's three columns.
const ICON_RAMP = [RAMP[0], RAMP[2], RAMP[4]];
const INK = "#0b1f3a";
const FAVICON_SIZES = [16, 32, 48];

const path = (version, suffix) => buildPath(`logo/icon/ideas-icon-${version}${suffix}`);
const readSvg = (version) => parseSvg(readFileSync(path(version, ".svg"), "utf8"));
const readPng = (file) => PNG.sync.read(readFileSync(buildPath(file)));
const opaqueColours = (png) => {
  const colours = new Set();
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 255) colours.add("#" + [...png.data.subarray(i, i + 3)].map((c) => c.toString(16).padStart(2, "0")).join(""));
  }
  return colours;
};

test("the Icon exists in every colour version and format", () => {
  const expected = VERSIONS.flatMap((version) => [
    path(version, ".svg"),
    path(version, ".pdf"),
    ...PNG_WIDTHS.map((w) => path(version, `-${w}.png`)),
  ]);
  assert.equal(expected.length, 4 * (2 + PNG_WIDTHS.length));
  assert.deepEqual(expected.filter((f) => !existsSync(f)), [], "missing files");
});

test("Icon SVGs parse as SVG with a numeric viewBox and a title", () => {
  for (const version of VERSIONS) {
    const svg = readSvg(version);
    assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg", version);
    assert.match(svg.getAttribute("viewBox"), /^0 0 \d+(\.\d+)? \d+(\.\d+)?$/, version);
    assert.ok(svg.getElementsByTagName("title")[0]?.textContent.startsWith("IDEAS"), `${version} title`);
  }
});

test("Icon PNGs have the expected width and the SVG's proportions", () => {
  for (const version of VERSIONS) {
    const [, , w, h] = readSvg(version).getAttribute("viewBox").split(/\s+/).map(Number);
    for (const width of PNG_WIDTHS) {
      const png = PNG.sync.read(readFileSync(path(version, `-${width}.png`)));
      assert.equal(png.width, width, `${version} ${width}`);
      assert.equal(png.height, Math.round((width * h) / w), `${version} ${width} height`);
    }
  }
});

test("Icon PDFs are one-page vector drawings: paths only, no images, no fonts", () => {
  for (const version of VERSIONS) {
    const pdf = readPdf(readFileSync(path(version, ".pdf")));
    const where = `icon ${version}`;
    assert.equal(pdf.pageCount, 1, `${where} page count`);
    assert.equal(pdf.hasImages, false, `${where} embeds an image`);
    assert.equal(pdf.hasFonts, false, `${where} depends on a font`);
    assert.match(pdf.content, /\s(f|f\*|B|S)\s/, `${where} has no path painting operators`);
    const [x0, y0, x1, y1] = pdf.mediaBox;
    const [, , w, h] = readSvg(version).getAttribute("viewBox").split(/\s+/).map(Number);
    assert.ok(Math.abs((x1 - x0) / (y1 - y0) - w / h) < 0.01, `${where} page proportions differ from the SVG`);
  }
});

test("the Icon's voxel layout matches the source definition", () => {
  const expected = readSource().icon.grid;
  const voxels = readVoxels(readSvg("color-on-light"));

  assert.deepEqual(voxelPicture(voxels), expected, "voxel layout");
  // Pinned so a source edit can't move the mark silently: the Hollow Voxel
  // tittle, the two-cell stem and the full base bar.
  assert.deepEqual(
    voxels.filter((v) => v.hollow).map((v) => [v.row, v.col]),
    [[0, 1]],
    "the tittle is the one Hollow Voxel",
  );
  assert.equal(voxels.filter((v) => !v.hollow).length, 5, "filled Voxels: two stem rows plus the base bar");
  assert.equal(voxels.length, 6, "total Voxel count");
  assert.equal(Math.max(...voxels.map((v) => v.row)) + 1, 5, "grid rows");
  assert.equal(Math.max(...voxels.map((v) => v.col)) + 1, 3, "grid columns");
});

test("colour versions colour the Voxels by column with the ramp; one-colour versions use Ink or white", () => {
  const byColumn = (version) => {
    const columns = new Map();
    for (const v of readVoxels(readSvg(version)).sort((a, b) => a.col - b.col)) {
      if (!columns.has(v.col)) columns.set(v.col, new Set());
      columns.get(v.col).add(v.colour);
    }
    return [...columns.values()].map((set) => [...set]);
  };

  for (const version of ["color-on-light", "color-on-ink"]) {
    assert.deepEqual(byColumn(version), ICON_RAMP.map((c) => [c]), `${version}: one ramp colour per column, left to right`);
  }
  for (const version of ["mono-ink", "mono-white"]) {
    const colour = version === "mono-ink" ? INK : "#ffffff";
    assert.deepEqual([...new Set(readVoxels(readSvg(version)).map((v) => v.colour))], [colour], version);
  }
});

test("the favicon .ico contains exactly 16, 32 and 48 px images", () => {
  const entries = readIco(readFileSync(buildPath("favicon/favicon.ico")));
  assert.deepEqual(entries.map((e) => [e.width, e.height]), FAVICON_SIZES.map((s) => [s, s]));
});

// The favicon layers are the Icon on a solid Ink tile. "Legible at 16px" means
// the mark is clearly there against the Ink and the stem reads as a vertical
// stroke even at 16px.
function isMark(png) {
  const ink = [0x0b, 0x1f, 0x3a];
  return (x, y) => {
    const i = (y * png.width + x) * 4;
    return png.data[i + 3] >= 128 && ink.some((c, ch) => Math.abs(png.data[i + ch] - c) > 40);
  };
}

test("the favicon layers show the Icon on Ink, most clearly checked at 16px", () => {
  const entries = readIco(readFileSync(buildPath("favicon/favicon.ico")));
  for (const entry of entries) {
    const { width, height, data } = entry.png;
    assert.equal(opaqueColours(entry.png).has(INK), true, `${width}px: no Ink background`);
    if (width >= 48) {
      for (const c of ICON_RAMP) assert.ok(opaqueColours(entry.png).has(c), `${width}px: no solid ${c} pixels`);
    }
    assert.equal(width * height, data.length / 4, `${width}px: unexpected buffer shape`);
  }

  const [small] = entries;
  const mark = isMark(small.png);
  let markPixels = 0;
  for (let y = 0; y < small.png.height; y++) for (let x = 0; x < small.png.width; x++) if (mark(x, y)) markPixels++;
  const fraction = markPixels / (small.png.width * small.png.height);
  assert.ok(fraction >= 0.03, `16px layer: the mark is barely there (${(fraction * 100).toFixed(1)}%)`);
  assert.ok(fraction <= 0.9, "16px layer: the tile is not mostly background");

  // The stem: a vertical run of mark pixels near the centre of the tile.
  const run = (x) => {
    let longest = 0;
    let current = 0;
    for (let y = 0; y < small.png.height; y++) {
      current = mark(x, y) ? current + 1 : 0;
      longest = Math.max(longest, current);
    }
    return longest;
  };
  const centre = Math.max(...[6, 7, 8, 9].map(run));
  assert.ok(centre >= 4, `16px layer: the stem doesn't read as a stroke (longest run ${centre}px)`);
});

test("the Apple touch icon is a flat 180px square: no transparency, Ink ground, ramp Voxels", () => {
  const png = readPng("favicon/apple-touch-icon.png");
  assert.equal(png.width, 180);
  assert.equal(png.height, 180);
  for (let i = 3; i < png.data.length; i += 4) assert.equal(png.data[i], 255, `transparent pixel at byte ${i}`);
  assert.equal(opaqueColours(png).has(INK), true, "no Ink background");
  for (const c of ICON_RAMP) assert.ok(opaqueColours(png).has(c), `no solid ${c} pixels`);
});

test("the avatar is a flat 512px square: no transparency, Ink ground, ramp Voxels", () => {
  const png = readPng("favicon/avatar-512.png");
  assert.equal(png.width, 512);
  assert.equal(png.height, 512);
  for (let i = 3; i < png.data.length; i += 4) assert.equal(png.data[i], 255, `transparent pixel at byte ${i}`);
  assert.equal(opaqueColours(png).has(INK), true, "no Ink background");
  for (const c of ICON_RAMP) assert.ok(opaqueColours(png).has(c), `no solid ${c} pixels`);
});
