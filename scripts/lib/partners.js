// The Partner Strip and the cleaned-up institution logos it is built from, from
// src/partners.json and the official files in assets/partners/raw/.
//
// No recolouring: each official file is embedded byte for byte as an <image>,
// inside a nested <svg> ("slot") whose viewBox crops it to its visible ink.
// The only changes are uniform scaling and the space around it. Embedding as
// an image also keeps each file's own CSS (class names like .st0) from
// leaking into the other logos.
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { PNG } from "pngjs";
import { escape } from "./svg.js";

const CONFIG = new URL("../../src/partners.json", import.meta.url);
const RAW = new URL("../../assets/partners/raw/", import.meta.url);

export const PT_PER_IN = 72;
const LOGO_INK_HEIGHT = PT_PER_IN; // cleaned logos: 1 in of ink height
const MEASURE_WIDTH = 4000; // px, for finding a logo's ink bounds

const n = (v) => +v.toFixed(3);

export function loadStripConfig() {
  const config = JSON.parse(readFileSync(CONFIG, "utf8"));
  const ids = new Set();
  for (const p of config.institutions) {
    if (ids.has(p.id)) throw new Error(`"${p.id}" is listed twice in src/partners.json`);
    ids.add(p.id);
  }
  for (const [size, spec] of Object.entries(config.strip.sizes)) {
    for (const id of spec.pendingWaivers) if (!ids.has(id)) throw new Error(`strip.sizes.${size}.pendingWaivers names unknown institution "${id}"`);
  }
  return config;
}

/** The official file's bytes and intrinsic size (SVG viewBox or PNG pixels). */
function readOfficial(file) {
  const bytes = readFileSync(new URL(file, RAW));
  if (file.endsWith(".png")) {
    const { width, height } = PNG.sync.read(bytes);
    return { bytes, mime: "image/png", width, height };
  }
  if (!file.endsWith(".svg")) throw new Error(`Partner file ${file} must be .svg or .png`);
  const root = bytes.toString("utf8").match(/<svg\b[^>]*>/s)?.[0] ?? "";
  const viewBox = root.match(/viewBox\s*=\s*"([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!viewBox) throw new Error(`${file} has no viewBox`);
  return { bytes, mime: "image/svg+xml", width: viewBox[2], height: viewBox[3] };
}

const imageNode = ({ bytes, mime, width, height }) =>
  `<image width="${width}" height="${height}" href="data:${mime};base64,${bytes.toString("base64")}"/>`;

/** The visible ink of an official file, in its own units: { x, y, width, height }. */
function inkBounds(official) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${official.width} ${official.height}">${imageNode(official)}</svg>`;
  const png = PNG.sync.read(new Resvg(svg, { fitTo: { mode: "width", value: MEASURE_WIDTH } }).render().asPng());
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("official file renders nothing");
  const unit = official.width / png.width;
  return { x: x0 * unit, y: y0 * unit, width: (x1 + 1 - x0) * unit, height: (y1 + 1 - y0) * unit };
}

/** Each institution from the config with its official file and ink bounds. */
export function prepareInstitutions(config) {
  return config.institutions.map((p) => {
    const official = readOfficial(p.file);
    const ink = inkBounds(official);
    return { ...p, official, ink, aspect: ink.width / ink.height, clearSpace: p.rules.clearSpace.ratio };
  });
}

/** A slot: one institution's ink box at (x, y), `height` tall, in points. */
function slotNode({ institution, x, y, height }) {
  const { ink, official } = institution;
  const width = height * institution.aspect;
  return [
    `<svg id="logo-${institution.id}" x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" viewBox="${n(ink.x)} ${n(ink.y)} ${n(ink.width)} ${n(ink.height)}">`,
    imageNode(official),
    `</svg>`,
  ].join("");
}

/** The file's SVG text, and its width in inches for sizing the PNG. */
function document(width, height, title, body) {
  const inch = (pt) => `${n(pt / PT_PER_IN)}in`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${inch(width)}" height="${inch(height)}" role="img" aria-label="${escape(title)}">`,
    `<title>${escape(title)}</title>`,
    ...body,
    `</svg>`,
    "",
  ].join("\n");
  return { svg, widthIn: width / PT_PER_IN };
}

/** One logo trimmed to its ink, 1 in tall, with its own clear space around it. */
export function cleanedLogo(institution) {
  const h = LOGO_INK_HEIGHT;
  const pad = institution.clearSpace * h;
  return document(h * institution.aspect + 2 * pad, h + 2 * pad, institution.name, [slotNode({ institution, x: pad, y: pad, height: h })]);
}

/**
 * Lays the strip out `widthIn` wide. A logo of ink aspect a is s / a^k tall
 * (k = opticalWeight), so all logos carry similar visual weight. Neighbours are
 * at least gap × s apart and never inside either one's clear space; the ends
 * and the top and bottom keep each logo's clear space too. Everything scales
 * with s, so lay out at s = 1 and scale to the width.
 */
export function layOutStrip(institutions, { opticalWeight, gap }, widthIn) {
  const items = institutions.map((p) => {
    const h = p.aspect ** -opticalWeight;
    return { institution: p, h, w: h * p.aspect, clear: p.clearSpace * h };
  });
  let x = items[0].clear;
  items.forEach((it, i) => {
    if (i > 0) {
      const prev = items[i - 1];
      x += Math.max(gap, prev.clear, it.clear);
    }
    it.x = x;
    x += it.w;
  });
  const unitWidth = x + items.at(-1).clear;
  const unitHeight = Math.max(...items.map((it) => it.h + 2 * it.clear));
  const s = (widthIn * PT_PER_IN) / unitWidth;
  return {
    width: unitWidth * s,
    height: unitHeight * s,
    items: items.map((it) => ({ institution: it.institution, x: it.x * s, y: ((unitHeight - it.h) / 2) * s, height: it.h * s })),
  };
}

const STRIP_TITLE = "IDEAS partners";

/** The strip alone, transparent, for light backgrounds. */
export function stripOnLight(layout) {
  return document(layout.width, layout.height, STRIP_TITLE, layout.items.map(slotNode));
}

/** The strip centred on a white band, for the bottom of navy slides. */
export function stripOnWhiteBand(layout, { widthIn, paddingIn }) {
  const width = widthIn * PT_PER_IN;
  if (layout.width > width) throw new Error(`The strip (${layout.width / PT_PER_IN} in) is wider than the white band (${widthIn} in)`);
  const pad = paddingIn * PT_PER_IN;
  const height = layout.height + 2 * pad;
  const dx = (width - layout.width) / 2;
  return document(width, height, STRIP_TITLE, [
    `<rect x="0" y="0" width="${n(width)}" height="${n(height)}" fill="#ffffff"/>`,
    ...layout.items.map((it) => slotNode({ ...it, x: dx + it.x, y: pad + it.y })),
  ]);
}
