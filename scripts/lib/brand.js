// Reads src/brand.json and lays the Wordmark out as a grid of Voxels.
import { readFileSync } from "node:fs";

const SOURCE = new URL("../../src/brand.json", import.meta.url);

export function loadBrand() {
  return JSON.parse(readFileSync(SOURCE, "utf8"));
}

/** One grid of cells, offset `col0` columns in; `colourOf(col, row)` colours each Voxel. */
function voxelsOfGrid(grid, col0, colourOf) {
  const voxels = [];
  grid.forEach((line, row) => {
    [...line].forEach((cell, x) => {
      if (cell === ".") return;
      if (cell !== "#" && cell !== "o") throw new Error(`Unknown grid cell "${cell}" in src/brand.json`);
      const col = col0 + x;
      voxels.push({ col, row, hollow: cell === "o", colour: colourOf(col, row) });
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

  const byColumn = (col) => ramp[Math.min(ramp.length - 1, Math.floor((col / columns) * ramp.length))];
  const voxels = [];
  let x0 = 0;
  for (const glyph of glyphs) {
    voxels.push(...voxelsOfGrid(glyph, x0, byColumn));
    x0 += glyph[0].length + wordmark.letterGap;
  }
  return { columns, rows, voxels };
}

/** The Icon: a single voxel "i" on its own grid, coloured by row with `icon.rampSteps`. */
export function layOutIcon({ icon, transferFunctionRamp: ramp }) {
  const grid = icon?.grid;
  if (!grid) throw new Error(`No "icon" grid in src/brand.json`);
  const rows = grid.length;
  const columns = grid[0].length;
  if (grid.some((line) => line.length !== columns)) throw new Error(`Icon grid rows must all be ${columns} cells wide`);
  const steps = icon.rampSteps;
  if (steps?.length !== rows) throw new Error(`Icon rampSteps must give one ramp index for each of the ${rows} rows`);
  steps.forEach((step, row) => {
    if (!ramp[step]) throw new Error(`Icon rampSteps[${row}] = ${step} is not a ramp index`);
  });
  return { columns, rows, voxels: voxelsOfGrid(grid, 0, (_, row) => ramp[steps[row]]) };
}
