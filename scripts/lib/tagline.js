// Converts the Tagline to glyph outlines, so no exported file needs the font installed.
import { readFileSync } from "node:fs";
import opentype from "opentype.js";

const SOURCE_DIR = new URL("../../src/", import.meta.url);
const fonts = new Map();

function loadFont(file) {
  if (!fonts.has(file)) {
    const buf = readFileSync(new URL(file, SOURCE_DIR));
    fonts.set(file, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  return fonts.get(file);
}

/**
 * Sets the Tagline's lines in its font at `fontSize`, `lineHeight` apart, with
 * the first baseline at y = 0 and each line starting at x = 0. Returns
 * { glyphs: [{ x, y, d }], width, lastBaseline, ascent, descent }: one outline
 * per visible character (`d` is path data relative to the glyph origin at x, y),
 * the widest line's advance, the last line's baseline, and how far the ink
 * rises above the first baseline and falls below the last one.
 */
export function outlineTagline({ tagline }, { fontSize, lineHeight }) {
  const font = loadFont(tagline.font);
  const scale = fontSize / font.unitsPerEm;
  const glyphs = [];
  let width = 0;
  let ascent = 0;
  let descent = 0;

  tagline.lines.forEach((line, i) => {
    const y = i * lineHeight;
    let x = 0;
    for (const ch of line) {
      const glyph = font.charToGlyph(ch);
      if (glyph.index === 0) throw new Error(`The Tagline font has no glyph for "${ch}"`);
      if (ch !== " ") {
        const box = glyph.getBoundingBox();
        if (i === 0) ascent = Math.max(ascent, box.y2 * scale);
        if (i === tagline.lines.length - 1) descent = Math.max(descent, -box.y1 * scale);
        glyphs.push({ x, y, d: glyph.getPath(0, 0, fontSize).toPathData(3) });
      }
      x += glyph.advanceWidth * scale;
    }
    width = Math.max(width, x);
  });
  return { glyphs, width, lastBaseline: (tagline.lines.length - 1) * lineHeight, ascent, descent };
}
