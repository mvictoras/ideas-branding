// Reads src/brand.json and lays the Wordmark out as a grid of Voxels.
import { readFileSync } from "node:fs";

const SOURCE = new URL("../../src/brand.json", import.meta.url);

export function loadBrand() {
  return JSON.parse(readFileSync(SOURCE, "utf8"));
}

/** One grid of cells, offset `col0` columns in, coloured by column with the ramp. */
function voxelsOfGrid(grid, col0, columns, ramp) {
  const voxels = [];
  grid.forEach((line, row) => {
    [...line].forEach((cell, x) => {
      if (cell === ".") return;
      if (cell !== "#" && cell !== "o") throw new Error(`Unknown grid cell "${cell}" in src/brand.json`);
      const col = col0 + x;
      const step = Math.min(ramp.length - 1, Math.floor((col / columns) * ramp.length));
      voxels.push({ col, row, hollow: cell === "o", colour: ramp[step] });
    });
  });
  return voxels;
}

/**
 * Places each letter of the Wordmark side by side, `letterGap` empty columns
 * apart, and colours every Voxel by its column with the Transfer-Function Ramp.
 * Returns { columns, rows, voxels: [{ col, row, hollow, colour }] }.
 */
export function layOutWordmark({ wordmark, transferFunctionRamp: ramp }) {
  const glyphs = [...wordmark.text].map((ch) => {
    const glyph = wordmark.letters[ch];
    if (!glyph) throw new Error(`No letterform for "${ch}" in src/brand.json`);
    return glyph;
  });
  const rows = glyphs[0].length;
  const columns = glyphs.reduce((w, g) => w + g[0].length, 0) + wordmark.letterGap * (glyphs.length - 1);

  const voxels = [];
  let x0 = 0;
  for (const glyph of glyphs) {
    voxels.push(...voxelsOfGrid(glyph, x0, columns, ramp));
    x0 += glyph[0].length + wordmark.letterGap;
  }
  return { columns, rows, voxels };
}

/** The Icon: a single voxel "i" on its own grid, coloured by column like the Wordmark. */
export function layOutIcon({ icon, transferFunctionRamp: ramp }) {
  const grid = icon?.grid;
  if (!grid) throw new Error(`No "icon" grid in src/brand.json`);
  const rows = grid.length;
  const columns = grid[0].length;
  if (grid.some((line) => line.length !== columns)) throw new Error(`Icon grid rows must all be ${columns} cells wide`);
  return { columns, rows, voxels: voxelsOfGrid(grid, 0, columns, ramp) };
}
