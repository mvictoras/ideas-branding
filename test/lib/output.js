// Helpers for reading the build output. Nothing here knows how it was generated.
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const buildPath = (rel) => `${ROOT}build/${rel}`;

// Parses SVG text and returns the root <svg> element; throws on malformed XML.
export function parseSvg(text) {
  const doc = new DOMParser({
    onError: (level, msg) => {
      throw new Error(`SVG ${level}: ${msg}`);
    },
  }).parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (root?.localName !== "svg") throw new Error(`root element is <${root?.localName}>, not <svg>`);
  return root;
}

export const readSource = () => JSON.parse(readFileSync(`${ROOT}src/brand.json`, "utf8"));

// The Wordmark as the source defines it: letters side by side, letterGap
// empty columns apart. One string per row, '#' Voxel, 'o' Hollow Voxel.
export function sourceWordmarkPicture({ wordmark }) {
  const gap = ".".repeat(wordmark.letterGap);
  const glyphs = [...wordmark.text].map((ch) => wordmark.letters[ch]);
  return glyphs[0].map((_, row) => glyphs.map((g) => g[row]).join(gap));
}

/**
 * Reads the Voxels back out of a rendered SVG: every <rect> is one Voxel,
 * filled (fill colour) or hollow (fill="none", stroke colour). Grid positions
 * are recovered from rect centres, using the smallest spacing between
 * centres as the Voxel pitch, so this doesn't depend on the generator's units.
 */
export function readVoxels(svg) {
  const rects = [...svg.getElementsByTagName("rect")].map((r) => {
    const num = (a) => parseFloat(r.getAttribute(a));
    const hollow = r.getAttribute("fill") === "none";
    return {
      cx: num("x") + num("width") / 2,
      cy: num("y") + num("height") / 2,
      hollow,
      colour: (hollow ? r.getAttribute("stroke") : r.getAttribute("fill")).toLowerCase(),
    };
  });
  const pitchOf = (vals) => {
    const s = [...new Set(vals.map((v) => +v.toFixed(3)))].sort((a, b) => a - b);
    return Math.min(...s.slice(1).map((v, i) => v - s[i]));
  };
  const px = pitchOf(rects.map((r) => r.cx));
  const py = pitchOf(rects.map((r) => r.cy));
  const x0 = Math.min(...rects.map((r) => r.cx));
  const y0 = Math.min(...rects.map((r) => r.cy));
  return rects.map((r) => ({
    ...r,
    col: Math.round((r.cx - x0) / px),
    row: Math.round((r.cy - y0) / py),
  }));
}

export function voxelPicture(voxels) {
  const cols = Math.max(...voxels.map((v) => v.col)) + 1;
  const rows = Math.max(...voxels.map((v) => v.row)) + 1;
  const grid = Array.from({ length: rows }, () => Array(cols).fill("."));
  for (const v of voxels) grid[v.row][v.col] = v.hollow ? "o" : "#";
  return grid.map((r) => r.join(""));
}
