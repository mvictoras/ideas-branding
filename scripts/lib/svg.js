// Renders a laid-out Voxel grid as SVG.

const CELL = 10; // SVG units per Voxel
const PAD = 1; // empty Voxels of margin on every side
const INSET = 1; // gap between a Voxel and its cell edge
const STROKE = 1.5; // Hollow Voxel outline width
const RADIUS = 1.5;

const n = (v) => +v.toFixed(3);

function voxelRect({ col, row, hollow, colour }) {
  const x = (col + PAD) * CELL;
  const y = (row + PAD) * CELL;
  if (hollow) {
    // Stroke centred on the path: keep the outer edge flush with a filled Voxel.
    const i = INSET + STROKE / 2;
    const s = CELL - 2 * i;
    return `<rect x="${n(x + i)}" y="${n(y + i)}" width="${n(s)}" height="${n(s)}" rx="${RADIUS}" fill="none" stroke="${colour}" stroke-width="${STROKE}"/>`;
  }
  const s = CELL - 2 * INSET;
  return `<rect x="${x + INSET}" y="${y + INSET}" width="${s}" height="${s}" rx="${RADIUS}" fill="${colour}"/>`;
}

export function voxelGridSvg({ columns, rows, voxels }, { label }) {
  const w = (columns + 2 * PAD) * CELL;
  const h = (rows + 2 * PAD) * CELL;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">`,
    `<title>${label}</title>`,
    ...voxels.map(voxelRect),
    `</svg>`,
    "",
  ].join("\n");
}
