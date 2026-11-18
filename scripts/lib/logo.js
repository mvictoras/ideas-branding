// Composes each piece of the Logo family, in each colour version, as a
// drawing ("scene") that the SVG and PDF writers render.
//
// A scene is { width, height, title, children }, in drawing units, where each
// child is one of:
//   { type: "g", id?, fill?, opacity?, children }
//   { type: "rect", x, y, width, height, rx, fill } or { ..., fill: "none", stroke, strokeWidth }
//   { type: "circle", cx, cy, r }            (painted by its group)
//   { type: "path", x, y, d }                (a glyph outline at x, y; painted by its group)
import { layOutWordmark } from "./brand.js";
import { outlineTagline } from "./tagline.js";

const CELL = 10; // drawing units per Voxel
const PAD = 1; // empty Voxels of margin on every side
const INSET = 1; // gap between a Voxel and its cell edge
const STROKE = 1.5; // Hollow Voxel outline width
const RADIUS = 1.5;

// Wordmark-hero: the Volume Grid reaches this many Voxels past the Wordmark,
// with a clear margin of PAD beyond it.
const GRID_REACH = 2;
const DOT_RADIUS = 0.6;
const GRID_OPACITY = 0.28;

// Horizontal Lockup: Tagline size and spacing, after the www-ideas prototype
// header (11px Tagline beside 40px-tall letters, 1.25 line height).
const HORIZONTAL_FONT_SIZE = 14;
const HORIZONTAL_GAP = 2 * CELL; // Wordmark to Tagline
// Stacked Lockup: the Tagline's widest line spans the Wordmark.
const STACKED_GAP = 1.5 * CELL; // Wordmark to the Tagline's ascenders
const LINE_HEIGHT = 1.25; // × font size

export const PIECES = ["wordmark", "wordmark-hero", "horizontal-lockup", "stacked-lockup"];
export const COLOUR_VERSIONS = ["color-on-light", "color-on-ink", "mono-ink", "mono-white"];

// Voxels: "ramp" or a single colour. Foreground: the Tagline and the Volume Grid.
function colourScheme(version, { colours }) {
  switch (version) {
    case "color-on-light": return { voxels: "ramp", foreground: colours.ink };
    case "color-on-ink": return { voxels: "ramp", foreground: colours.white };
    case "mono-ink": return { voxels: colours.ink, foreground: colours.ink };
    case "mono-white": return { voxels: colours.white, foreground: colours.white };
    default: throw new Error(`Unknown colour version "${version}"`);
  }
}

const n = (v) => +v.toFixed(3);

function voxelRect({ col, row, hollow, colour }, x0, y0) {
  const x = x0 + col * CELL;
  const y = y0 + row * CELL;
  if (hollow) {
    // Stroke centred on the path: keep the outer edge flush with a filled Voxel.
    const i = INSET + STROKE / 2;
    const s = n(CELL - 2 * i);
    return { type: "rect", x: n(x + i), y: n(y + i), width: s, height: s, rx: RADIUS, fill: "none", stroke: colour, strokeWidth: STROKE };
  }
  const s = CELL - 2 * INSET;
  return { type: "rect", x: x + INSET, y: y + INSET, width: s, height: s, rx: RADIUS, fill: colour };
}

/** The Wordmark's Voxels with the top-left cell at (x0, y0). */
function wordmarkNodes(layout, voxelColour, x0, y0) {
  return layout.voxels.map((v) => voxelRect({ ...v, colour: voxelColour === "ramp" ? v.colour : voxelColour }, x0, y0));
}

function volumeGrid(layout, foreground, x0, y0) {
  const taken = new Set(layout.voxels.map((v) => `${v.col},${v.row}`));
  const dots = [];
  for (let row = -GRID_REACH; row < layout.rows + GRID_REACH; row++) {
    for (let col = -GRID_REACH; col < layout.columns + GRID_REACH; col++) {
      if (taken.has(`${col},${row}`)) continue;
      dots.push({ type: "circle", cx: x0 + (col + 0.5) * CELL, cy: y0 + (row + 0.5) * CELL, r: DOT_RADIUS });
    }
  }
  return { type: "g", id: "volume-grid", fill: foreground, opacity: GRID_OPACITY, children: dots };
}

function taglineGroup({ glyphs }, foreground, x0, y0) {
  return {
    type: "g",
    id: "tagline",
    fill: foreground,
    children: glyphs.map((g) => ({ type: "path", x: n(x0 + g.x), y: n(y0 + g.y), d: g.d })),
  };
}

/** The Wordmark alone. `voxelColour` is "ramp" (colour by column) or one colour. */
export function wordmarkScene(layout, { title, voxelColour = "ramp" }) {
  return {
    width: (layout.columns + 2 * PAD) * CELL,
    height: (layout.rows + 2 * PAD) * CELL,
    title,
    children: wordmarkNodes(layout, voxelColour, PAD * CELL, PAD * CELL),
  };
}

/** One piece of the Logo family in one colour version. */
export function composeLogo(brand, piece, version) {
  const layout = layOutWordmark(brand);
  const { voxels, foreground } = colourScheme(version, brand);
  const markWidth = layout.columns * CELL;
  const markHeight = layout.rows * CELL;
  const name = brand.wordmark.text;
  const fullName = `${name}: ${brand.tagline.lines.join(" ")}`;
  const edge = PAD * CELL;

  switch (piece) {
    case "wordmark":
      return wordmarkScene(layout, { title: name, voxelColour: voxels });

    case "wordmark-hero": {
      const margin = (PAD + GRID_REACH) * CELL;
      return {
        width: markWidth + 2 * margin,
        height: markHeight + 2 * margin,
        title: name,
        children: [volumeGrid(layout, foreground, margin, margin), ...wordmarkNodes(layout, voxels, margin, margin)],
      };
    }

    case "horizontal-lockup": {
      const tagline = outlineTagline(brand, { fontSize: HORIZONTAL_FONT_SIZE, lineHeight: HORIZONTAL_FONT_SIZE * LINE_HEIGHT });
      // Centre the block from the first line's ascenders to the last baseline on the Wordmark.
      const y0 = edge + markHeight / 2 - (tagline.lastBaseline - tagline.ascent) / 2;
      const x0 = edge + markWidth + HORIZONTAL_GAP;
      return {
        width: n(x0 + tagline.width + edge),
        height: markHeight + 2 * edge,
        title: fullName,
        children: [...wordmarkNodes(layout, voxels, edge, edge), taglineGroup(tagline, foreground, x0, y0)],
      };
    }

    case "stacked-lockup": {
      // Advances scale with font size, so set it once at size 1 to find the size that spans the Wordmark.
      const fontSize = markWidth / outlineTagline(brand, { fontSize: 1, lineHeight: LINE_HEIGHT }).width;
      const tagline = outlineTagline(brand, { fontSize, lineHeight: fontSize * LINE_HEIGHT });
      const y0 = edge + markHeight + STACKED_GAP + tagline.ascent;
      return {
        width: markWidth + 2 * edge,
        height: n(y0 + tagline.lastBaseline + tagline.descent + edge),
        title: fullName,
        children: [...wordmarkNodes(layout, voxels, edge, edge), taglineGroup(tagline, foreground, edge, y0)],
      };
    }

    default:
      throw new Error(`Unknown Logo piece "${piece}"`);
  }
}
