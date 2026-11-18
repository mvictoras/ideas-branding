// Minimal PDF reader for build-output checks: just enough to see what a PDF is
// made of (page size, content-stream operators, embedded images and fonts).
import { inflateSync } from "node:zlib";

/**
 * Returns { version, mediaBox: [x0, y0, x1, y1], pageCount, content, colours, hasImages, hasFonts }.
 * `content` is every content stream, decompressed and joined, as latin1 text.
 * `colours` is the set of RGB colours it fills or strokes with, as "#rrggbb".
 */
export function readPdf(buffer) {
  const text = buffer.toString("latin1");
  const version = text.match(/^%PDF-(\d\.\d)/)?.[1];
  if (!version) throw new Error("not a PDF: missing %PDF- header");
  if (!/%%EOF\s*$/.test(text)) throw new Error("PDF is truncated: no %%EOF");

  const streams = [];
  const re = /<<((?:(?!>>\s*stream)[\s\S])*)>>\s*stream\r?\n/g;
  for (let m; (m = re.exec(text)); ) {
    const dict = m[1];
    const start = m.index + m[0].length;
    const length = Number(dict.match(/\/Length (\d+)/)?.[1]);
    const end = Number.isFinite(length) ? start + length : text.indexOf("endstream", start);
    let data = buffer.subarray(start, end);
    if (/\/FlateDecode/.test(dict)) data = inflateSync(data);
    streams.push({ dict, data });
  }
  const mediaBox = text.match(/\/MediaBox\s*\[\s*([-\d.\s]+)\]/)?.[1].trim().split(/\s+/).map(Number);
  const isImage = (s) => /\/Subtype\s*\/Image/.test(s.dict);
  const isContent = (s) => !isImage(s) && !/\/Type\s*\/(XRef|ObjStm|Metadata)|\/Subtype\s*\/(Type1C|OpenType)|\/Length1/.test(s.dict);
  const content = streams.filter(isContent).map((s) => s.data.toString("latin1")).join("\n");
  const hex = (c) => Math.round(Number(c) * 255).toString(16).padStart(2, "0");
  const colours = new Set(
    [...content.matchAll(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(?:sc|scn|SC|SCN|rg|RG)\b/g)].map(([, r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`),
  );
  if (/\b(g|G|k|K)\s*$/m.test(content)) colours.add("non-RGB colour operator");
  return {
    version,
    mediaBox,
    pageCount: (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length,
    content,
    colours,
    hasImages: streams.some(isImage) || /\/Subtype\s*\/Image/.test(text),
    hasFonts: /\/Type\s*\/Font\b/.test(text),
  };
}
