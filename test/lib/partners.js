// Reads Partner Strip output: each logo is a nested <svg id="logo-<id>"> slot
// whose viewBox crops one embedded <image>. Nothing here knows how it was generated.
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { ROOT, parseSvg } from "./output.js";

export const PT_PER_IN = 72;
export const PNG_DPI = 192;
export const SCREEN_DPI = 96;

export const readStripConfig = () => JSON.parse(readFileSync(`${ROOT}src/partners.json`, "utf8"));
export const rawPath = (file) => `${ROOT}assets/partners/raw/${file}`;

/** Intrinsic size of an official file: the SVG viewBox, or the PNG's pixels. */
export function intrinsicSize(file) {
  const bytes = readFileSync(rawPath(file));
  if (file.endsWith(".png")) {
    const png = PNG.sync.read(bytes);
    return { width: png.width, height: png.height };
  }
  const [, , width, height] = parseSvg(bytes.toString("utf8")).getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);
  return { width, height };
}

const num = (el, a) => parseFloat(el.getAttribute(a));

/** The root <svg>, its size in points (viewBox) and every logo slot in it. */
export function readSlots(svgText) {
  const svg = parseSvg(svgText);
  const [, , width, height] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  const slots = [...svg.getElementsByTagName("svg")]
    .filter((el) => el !== svg)
    .map((el) => {
      const image = el.getElementsByTagName("image")[0];
      const href = image.getAttribute("href");
      const [, mime, data] = href.match(/^data:([^;]+);base64,(.*)$/s) ?? [];
      return {
        id: el.getAttribute("id")?.replace(/^logo-/, ""),
        x: num(el, "x"),
        y: num(el, "y"),
        width: num(el, "width"),
        height: num(el, "height"),
        viewBox: el.getAttribute("viewBox").split(/\s+/).map(Number),
        preserveAspectRatio: el.getAttribute("preserveAspectRatio"),
        image: { width: num(image, "width"), height: num(image, "height"), x: num(image, "x") || 0, y: num(image, "y") || 0, mime, bytes: Buffer.from(data ?? "", "base64") },
      };
    });
  return { svg, width, height, slots };
}

/**
 * Checks a rendered PNG of the file against its slots: no ink outside a slot,
 * and ink reaching every edge of every slot (the slot is the trimmed logo).
 * Returns a list of problems.
 */
export function inkProblems(pngBytes, { width, slots }, tolerancePx = 2) {
  const png = PNG.sync.read(pngBytes);
  const scale = png.width / width;
  const boxes = slots.map((s) => ({ id: s.id, x0: s.x * scale, y0: s.y * scale, x1: (s.x + s.width) * scale, y1: (s.y + s.height) * scale }));
  const reach = boxes.map(() => ({ left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }));
  let stray = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] < 16) continue;
      const i = boxes.findIndex((b) => x + 1 >= b.x0 - tolerancePx && x <= b.x1 + tolerancePx && y + 1 >= b.y0 - tolerancePx && y <= b.y1 + tolerancePx);
      if (i < 0) {
        stray++;
        continue;
      }
      const r = reach[i];
      r.left = Math.min(r.left, x);
      r.right = Math.max(r.right, x + 1);
      r.top = Math.min(r.top, y);
      r.bottom = Math.max(r.bottom, y + 1);
    }
  }
  const problems = stray ? [`${stray} inked pixels outside every slot`] : [];
  boxes.forEach((b, i) => {
    const r = reach[i];
    const gaps = { left: r.left - b.x0, right: b.x1 - r.right, top: r.top - b.y0, bottom: b.y1 - r.bottom };
    for (const [edge, gap] of Object.entries(gaps)) {
      if (!(gap <= tolerancePx)) problems.push(`${b.id}: ink stops ${gap.toFixed(1)}px short of the ${edge} edge`);
    }
  });
  return problems;
}
