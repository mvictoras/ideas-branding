// A small PPTX/POTX reader for checking the Slide Template in the build output.
// It reads the package as PowerPoint would: [Content_Types].xml, relationships,
// the theme, the slide master and its layouts. Nothing here knows how the
// package was generated.
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { DOMParser } from "@xmldom/xmldom";

export const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
  asvg: "http://schemas.microsoft.com/office/drawing/2016/SVG/main",
};
export const EMU_PER_IN = 914400;
const REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";

const parseXml = (text, name) =>
  new DOMParser({
    onError: (level, msg) => {
      throw new Error(`${name}: XML ${level}: ${msg}`);
    },
  }).parseFromString(text, "application/xml");

export const children = (el, ns, local) => [...el.childNodes].filter((c) => c.nodeType === 1 && c.namespaceURI === ns && c.localName === local);
export const child = (el, ns, local) => (el ? children(el, ns, local)[0] : undefined);
export const descendants = (el, ns, local) => [...el.getElementsByTagNameNS(ns, local)];

/** Opens a .pptx/.potx: its parts, content types and relationships. */
export function openPackage(path) {
  const files = unzipSync(readFileSync(path));
  const parts = new Map(Object.entries(files).map(([name, bytes]) => [`/${name}`, Buffer.from(bytes)]));
  const docs = new Map();
  const xml = (part) => {
    if (!docs.has(part)) {
      if (!parts.has(part)) throw new Error(`no part ${part}`);
      docs.set(part, parseXml(strFromU8(parts.get(part)), part));
    }
    return docs.get(part);
  };

  const types = xml("/[Content_Types].xml").documentElement;
  const defaults = new Map(children(types, NS.ct, "Default").map((d) => [d.getAttribute("Extension").toLowerCase(), d.getAttribute("ContentType")]));
  const overrides = new Map(children(types, NS.ct, "Override").map((o) => [o.getAttribute("PartName"), o.getAttribute("ContentType")]));
  const contentType = (part) => overrides.get(part) ?? defaults.get(posix.extname(part).slice(1).toLowerCase());

  /** The relationships of `part` (or of the package for "/"), as id -> { type, target part }. */
  const rels = (part) => {
    const relsPart = part === "/" ? "/_rels/.rels" : `${posix.dirname(part)}/_rels/${posix.basename(part)}.rels`;
    if (!parts.has(relsPart)) return new Map();
    const base = part === "/" ? "/" : posix.dirname(part);
    return new Map(
      children(xml(relsPart).documentElement, NS.rel, "Relationship").map((r) => [
        r.getAttribute("Id"),
        { type: r.getAttribute("Type").replace(REL_TYPE, ""), target: r.getAttribute("TargetMode") === "External" ? null : posix.resolve(base, r.getAttribute("Target")) },
      ]),
    );
  };
  const relOfType = (part, type) => [...rels(part).values()].filter((r) => r.type === type).map((r) => r.target);

  return { parts, xml, contentType, rels, relOfType };
}

/** The Slide Template's main parts: presentation, theme, master and layouts by name. */
export function openTemplate(path) {
  const pkg = openPackage(path);
  const presentation = pkg.relOfType("/", "officeDocument")[0];
  const master = pkg.relOfType(presentation, "slideMaster")[0];
  const theme = pkg.relOfType(master, "theme")[0];
  const layouts = pkg.relOfType(master, "slideLayout").map((part) => ({ part, name: child(pkg.xml(part).documentElement, NS.p, "cSld").getAttribute("name") }));
  return { ...pkg, presentation, master, theme, layouts, layout: (name) => layouts.find((l) => l.name === name) };
}

/** The theme's colour of `name` (accent1, dk2…) as lowercase #rrggbb. */
export function themeColour(pkg, name) {
  const scheme = descendants(pkg.xml(pkg.theme), NS.a, "clrScheme")[0];
  const slot = child(scheme, NS.a, name);
  const srgb = child(slot, NS.a, "srgbClr")?.getAttribute("val");
  return srgb ? `#${srgb.toLowerCase()}` : undefined;
}

/** A solid fill's colour, resolving theme colours: lowercase #rrggbb. */
export function solidFillColour(pkg, fill) {
  if (!fill) return undefined;
  const srgb = child(fill, NS.a, "srgbClr");
  if (srgb) return `#${srgb.getAttribute("val").toLowerCase()}`;
  const scheme = child(fill, NS.a, "schemeClr")?.getAttribute("val");
  const alias = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" }[scheme] ?? scheme;
  return scheme ? themeColour(pkg, alias) : undefined;
}

const box = (spPr) => {
  const xfrm = child(spPr, NS.a, "xfrm");
  const off = child(xfrm, NS.a, "off");
  const ext = child(xfrm, NS.a, "ext");
  if (!off || !ext) return undefined;
  const inch = (el, a) => Number(el.getAttribute(a)) / EMU_PER_IN;
  return { x: inch(off, "x"), y: inch(off, "y"), width: inch(ext, "cx"), height: inch(ext, "cy") };
};

/**
 * The shapes on a slide, layout or master, in z-order: { kind ("sp"|"pic"),
 * name, placeholder ({ type, idx } or null), box (inches), el }. Pictures also
 * carry `image`: { png, svg (bytes or null), crop, blip }.
 */
export function shapes(pkg, part) {
  const tree = descendants(pkg.xml(part), NS.p, "spTree")[0];
  const rels = pkg.rels(part);
  return [...tree.childNodes]
    .filter((el) => el.nodeType === 1 && (el.localName === "sp" || el.localName === "pic"))
    .map((el) => {
      const nv = child(el, NS.p, el.localName === "sp" ? "nvSpPr" : "nvPicPr");
      const cNvPr = child(nv, NS.p, "cNvPr");
      const ph = child(child(nv, NS.p, "nvPr"), NS.p, "ph");
      const shape = {
        kind: el.localName,
        name: cNvPr.getAttribute("name"),
        description: cNvPr.getAttribute("descr"),
        // A placeholder without a type is a content placeholder ("obj") in OOXML.
        placeholder: ph ? { type: ph.getAttribute("type") || "obj", idx: ph.getAttribute("idx") || "0" } : null,
        box: box(child(el, NS.p, "spPr")),
        el,
      };
      if (el.localName === "pic") {
        const blipFill = child(el, NS.p, "blipFill");
        const blip = child(blipFill, NS.a, "blip");
        const bytesOf = (id) => pkg.parts.get(rels.get(id).target);
        const svgBlip = descendants(blip, NS.asvg, "svgBlip")[0];
        const crop = child(blipFill, NS.a, "srcRect");
        const pct = (a) => Number(crop?.getAttribute(a) || 0) / 100000;
        shape.image = {
          png: bytesOf(blip.getAttributeNS(NS.r, "embed")),
          svg: svgBlip ? bytesOf(svgBlip.getAttributeNS(NS.r, "embed")) : null,
          crop: { l: pct("l"), t: pct("t"), r: pct("r"), b: pct("b") },
          blip,
        };
      }
      return shape;
    });
}

/** The background fill of a slide, layout or master (<p:bg><p:bgPr>), or undefined. */
export function backgroundFill(pkg, part) {
  const bg = descendants(pkg.xml(part), NS.p, "bg")[0];
  return child(child(bg, NS.p, "bgPr"), NS.a, "solidFill");
}
