// The Slide Template: a 16:9 PowerPoint template (.potx) written as Office Open
// XML from the brand source, the Logo build and the Partner Strip layout.
//
// The package holds one slide master and its layouts, and no slides: opening
// the .potx starts a new presentation with the IDEAS theme and layouts.
// Pictures carry a PNG (read by every app) and, where there is one, the SVG
// as PowerPoint's svgBlip extension, so PowerPoint draws them as vectors.
import { zipSync, strToU8 } from "fflate";
import { escape } from "./svg.js";
import { Resvg } from "@resvg/resvg-js";
import { PT_PER_IN } from "./partners.js";

const EMU_PER_IN = 914400;
// PowerPoint's Widescreen 16:9 size, exactly 12192000 × 6858000 EMU.
const SLIDE = { widthIn: 40 / 3, heightIn: 7.5 };

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_ASVG = "http://schemas.microsoft.com/office/drawing/2016/SVG/main";
const SVG_BLIP_EXT = "{96DAC541-7B7A-43D3-8B79-37D633B846F1}";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const CT = "application/vnd.openxmlformats-officedocument.";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const ROOT_NS = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;

const emu = (inches) => Math.round(inches * EMU_PER_IN);
const hex = (colour) => colour.replace(/^#/, "").toUpperCase();
const srgb = (colour) => `<a:srgbClr val="${hex(colour)}"/>`;
const solidFill = (colour) => `<a:solidFill>${srgb(colour)}</a:solidFill>`;

// ---- Package --------------------------------------------------------------

/** Collects parts, their content types and relationships, then zips them. */
class Package {
  parts = new Map(); // name -> { type, body, rels: [{ id, type, target }] }
  media = new Map(); // bytes key -> part name, so identical images are stored once
  defaults = new Map([["rels", "application/vnd.openxmlformats-package.relationships+xml"], ["xml", "application/xml"]]);

  add(name, type, body) {
    this.parts.set(name, { type, body, rels: [] });
    return name;
  }

  setBody(name, body) {
    this.parts.get(name).body = body;
  }

  /** Relates `from` to `to`; returns the relationship id. */
  relate(from, type, to) {
    const rels = from === "/" ? (this.rootRels ??= []) : this.parts.get(from).rels;
    const id = `rId${rels.length + 1}`;
    rels.push({ id, type, target: to });
    return id;
  }

  /** Stores an image once and relates it to `from`. */
  image(from, bytes, ext) {
    const key = `${ext}:${bytes.toString("base64")}`;
    if (!this.media.has(key)) {
      const name = `/ppt/media/image${this.media.size + 1}.${ext}`;
      this.parts.set(name, { body: bytes, rels: [] });
      this.media.set(key, name);
      this.defaults.set(ext, ext === "svg" ? "image/svg+xml" : `image/${ext}`);
    }
    return this.relate(from, "image", this.media.get(key));
  }

  zip() {
    const relsXml = (fromDir, rels) =>
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels
        .map(({ id, type, target }) => `<Relationship Id="${id}" Type="${type.startsWith("http") ? type : REL + type}" Target="${relative(fromDir, target)}"/>`)
        .join("")}</Relationships>`;
    const files = {};
    const put = (name, body) => (files[name.slice(1)] = typeof body === "string" ? strToU8(body) : new Uint8Array(body));
    const types = [
      ...[...this.defaults].map(([ext, type]) => `<Default Extension="${ext}" ContentType="${type}"/>`),
      ...[...this.parts].filter(([, p]) => p.type).map(([name, p]) => `<Override PartName="${name}" ContentType="${p.type}"/>`),
    ];
    put("/[Content_Types].xml", `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${types.join("")}</Types>`);
    put("/_rels/.rels", relsXml("/", this.rootRels));
    for (const [name, part] of this.parts) {
      put(name, part.body);
      if (part.rels.length) put(`${dir(name)}/_rels/${name.split("/").at(-1)}.rels`, relsXml(dir(name), part.rels));
    }
    return Buffer.from(zipSync(files, { level: 6 }));
  }
}

const dir = (name) => name.slice(0, name.lastIndexOf("/")) || "/";
function relative(fromDir, target) {
  const from = fromDir.split("/").filter(Boolean);
  const to = target.split("/").filter(Boolean);
  let i = 0;
  while (i < from.length && from[i] === to[i]) i++;
  return [...from.slice(i).map(() => ".."), ...to.slice(i)].join("/");
}

// ---- Theme ----------------------------------------------------------------

// ADR 0001: Helvetica for headings and body. Arial's PANOSE tells Windows
// PowerPoint and Google Slides to show Arial, which has the same widths.
const HELVETICA = { typeface: "Helvetica", panose: "020B0604020202020204" };
const CODE_FONT = { typeface: "Consolas", panose: "020B0609020204030204", fallback: "Courier New" };
// A theme has only heading and body fonts, so the code font is recorded in the
// theme as an extension: apps that don't know it ignore it, and later layouts
// with code placeholders set their text in it. See README.
const CODE_FONT_EXT = "{6A9E5B38-6F2E-4C39-9D2B-1D5E0A7C1E01}";
const NS_IDEAS = "urn:ideas-branding:slide-template";

function themeXml({ colours, themeAccents }) {
  const font = ({ typeface, panose }) => `<a:latin typeface="${typeface}" panose="${panose}"/><a:ea typeface=""/><a:cs typeface=""/>`;
  const slot = (name, colour) => `<a:${name}>${srgb(colour)}</a:${name}>`;
  const lineStyle = (w) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  return `${XML_HEAD}<a:theme xmlns:a="${NS_A}" name="IDEAS"><a:themeElements>
<a:clrScheme name="IDEAS">${slot("dk1", colours.ink)}${slot("lt1", colours.white)}${slot("dk2", colours.ink)}${slot("lt2", colours.background)}${themeAccents
    .map((c, i) => slot(`accent${i + 1}`, c))
    .join("")}${slot("hlink", themeAccents[0])}${slot("folHlink", themeAccents[4])}</a:clrScheme>
<a:fontScheme name="IDEAS"><a:majorFont>${font(HELVETICA)}</a:majorFont><a:minorFont>${font(HELVETICA)}</a:minorFont><a:extLst><a:ext uri="${CODE_FONT_EXT}"><ideas:codeFont xmlns:ideas="${NS_IDEAS}" typeface="${CODE_FONT.typeface}" panose="${CODE_FONT.panose}" fallback="${CODE_FONT.fallback}"/></a:ext></a:extLst></a:fontScheme>
<a:fmtScheme name="IDEAS"><a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst><a:lnStyleLst>${lineStyle(6350)}${lineStyle(12700)}${lineStyle(19050)}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst></a:fmtScheme>
</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

// ---- Shapes ---------------------------------------------------------------

/** Numbers each shape on a slide, layout or master (id 1 is the tree itself). */
class ShapeTree {
  next = 2;
  items = [];
  add(fn) {
    this.items.push(fn(this.next++));
    return this;
  }
  xml() {
    return `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${this.items.join("")}</p:spTree>`;
  }
}

// Every positioned shape needs geometry: Keynote drops the text of shapes without it.
const RECT = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
const xfrm = ({ x, y, width, height }) => `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm>`;

/**
 * A placeholder. `box` and `text` are optional: a layout placeholder without
 * them inherits position and formatting from the master. `text` is
 * { size (pt), colour, bold, font: "+mj-lt"|"+mn-lt", align, anchor,
 * bullet (false for none, "numbered" for 1. 2. 3.), prompt }.
 */
function placeholder(id, { name, type, idx, box, text = {} }) {
  const ph = `<p:ph${type ? ` type="${type}"` : ""}${idx !== undefined ? ` idx="${idx}"` : ""}/>`;
  const run = [text.size && `sz="${Math.round(text.size * 100)}"`, text.bold !== undefined && `b="${text.bold ? 1 : 0}"`].filter(Boolean).join(" ");
  const runProps = text.colour || text.font || run ? `<a:defRPr${run ? ` ${run}` : ""}>${text.colour ? solidFill(text.colour) : ""}${text.font ? `<a:latin typeface="${text.font}"/>` : ""}</a:defRPr>` : "";
  const indent = { false: ' marL="0" indent="0"', numbered: ` marL="${emu(0.45)}" indent="-${emu(0.45)}"` }[text.bullet] ?? "";
  const bullet = { false: "<a:buNone/>", numbered: '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' }[text.bullet] ?? "";
  const lvl = runProps || text.align || bullet ? `<a:lvl1pPr${text.align ? ` algn="${text.align}"` : ""}${indent}>${bullet}${runProps}</a:lvl1pPr>` : "";
  const bodyPr = `<a:bodyPr${text.anchor ? ` anchor="${text.anchor}"` : ""}/>`;
  const paragraph = (text.prompt ? `<a:p><a:r><a:rPr lang="en-US"/><a:t>${escape(text.prompt)}</a:t></a:r></a:p>` : '<a:p><a:endParaRPr lang="en-US"/></a:p>');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escape(name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${box ? xfrm(box) + RECT : ""}</p:spPr><p:txBody>${bodyPr}<a:lstStyle>${lvl}</a:lstStyle>${paragraph}</p:txBody></p:sp>`;
}

/**
 * The slide number: a text box on the layout holding the slide-number field,
 * which each app fills in with the slide's own number. A text box rather than
 * a slide-number placeholder, which shows only once someone turns slide
 * numbers on: the footer always shows it, like the Icon and the Partner Strip.
 * Centred across the slide at height `middle`.
 */
const SLIDE_NUMBER_SIZE = 12; // pt
const slideNumber = (id, brand, middle) => {
  const box = { x: (SLIDE.widthIn - SLIDE_NUMBER_BOX.width) / 2, y: middle - SLIDE_NUMBER_BOX.height / 2, ...SLIDE_NUMBER_BOX };
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Slide Number"/><p:cNvSpPr txBox="1"/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>${xfrm(box)}${RECT}<a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="en-US" sz="${SLIDE_NUMBER_SIZE * 100}">${solidFill(brand.colours.ink)}<a:latin typeface="+mn-lt"/></a:rPr><a:t>‹#›</a:t></a:fld></a:p></p:txBody></p:sp>`;
};

/** Fixed text on a layout: a text box, not a placeholder, so it can't be deleted or retyped on a slide. */
const textBox = (id, { name, box, text, size, colour, anchor = "t" }) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>${xfrm(box)}${RECT}<a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="${Math.round(size * 100)}">${solidFill(colour)}<a:latin typeface="+mn-lt"/></a:rPr><a:t>${escape(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;

/** A filled rectangle (no outline). */
const rect = (id, { name, box, colour }) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escape(name)}"/><p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>${xfrm(box)}${RECT}${solidFill(colour)}<a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;

/**
 * A picture. `image` is { png, svg? } bytes; `crop` (fractions of the image
 * per edge) trims it without scaling it unevenly.
 */
function picture(pkg, part, id, { name, description, box, image, crop }) {
  const png = pkg.image(part, image.png, "png");
  const svg = image.svg ? pkg.image(part, image.svg, "svg") : null;
  const ext = svg ? `<a:extLst><a:ext uri="${SVG_BLIP_EXT}"><asvg:svgBlip xmlns:asvg="${NS_ASVG}" r:embed="${svg}"/></a:ext></a:extLst>` : "";
  const pct = (f) => Math.round(f * 100000);
  const srcRect = crop ? `<a:srcRect l="${pct(crop.l)}" t="${pct(crop.t)}" r="${pct(crop.r)}" b="${pct(crop.b)}"/>` : "";
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${escape(name)}" descr="${escape(description ?? name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr userDrawn="1"/></p:nvPicPr><p:blipFill><a:blip r:embed="${png}">${ext}</a:blip>${srcRect}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(box)}${RECT}</p:spPr></p:pic>`;
}

const background = (colour) => `<p:bg><p:bgPr>${solidFill(colour)}<a:effectLst/></p:bgPr></p:bg>`;
const cSld = (name, bg, tree) => `<p:cSld${name ? ` name="${escape(name)}"` : ""}>${bg ?? ""}${tree.xml()}</p:cSld>`;
const COLOUR_MAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

// ---- Master ---------------------------------------------------------------

const MARGIN = 0.6; // in, left and right content margin
const TITLE_BOX = { x: MARGIN, y: 0.4, width: SLIDE.widthIn - 2 * MARGIN, height: 1 };
const BODY_BOX = { x: MARGIN, y: 1.55, width: SLIDE.widthIn - 2 * MARGIN, height: 4.6 };

/** The slide master; `layoutIds` are its <p:sldLayoutId> entries. */
function masterXml(brand, tree, layoutIds) {
  const { ink } = brand.colours;
  const level = (n, size, marL) =>
    `<a:lvl${n}pPr marL="${emu(marL)}" indent="-${emu(0.25)}" algn="l"><a:spcBef><a:spcPts val="600"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="${size * 100}">${solidFill(ink)}<a:latin typeface="+mn-lt"/></a:defRPr></a:lvl${n}pPr>`;
  const levels = [24, 20, 18, 16, 16].map((size, i) => level(i + 1, size, 0.25 + i * 0.4)).join("");
  return `${XML_HEAD}<p:sldMaster ${ROOT_NS}>${cSld(null, background(brand.colours.background), tree)}${COLOUR_MAP}<p:sldLayoutIdLst>${layoutIds.join("")}</p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:defRPr sz="3600" b="1">${solidFill(ink)}<a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle>${levels}</p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr>${solidFill(ink)}<a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
}

// ---- Partner Strip ----------------------------------------------------------

// The PNG drawn by apps without SVG support (and Keynote, Google Slides):
// an official SVG is rasterised so its ink is this many pixels wide.
const FALLBACK_INK_PX = 2400;

/** A picture's PNG (and SVG, when the official file is one) for an official partner file. */
function officialImage({ official, ink }) {
  if (official.mime === "image/png") return { png: official.bytes };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${official.width} ${official.height}"><image width="${official.width}" height="${official.height}" href="data:image/svg+xml;base64,${official.bytes.toString("base64")}"/></svg>`;
  const width = Math.min(8000, Math.round((FALLBACK_INK_PX * official.width) / ink.width));
  return { png: Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng()), svg: official.bytes };
}

/**
 * The Partner Strip as one picture per logo, in strip order, with its
 * top-left at (x0, y0) in inches. Each picture is the official file, cropped
 * to its ink and scaled uniformly: never recoloured.
 */
function partnerStrip(pkg, part, tree, strip, x0, y0) {
  for (const { institution, x, y, height } of strip.items) {
    const { official, ink } = institution;
    const crop = { l: ink.x / official.width, t: ink.y / official.height, r: 1 - (ink.x + ink.width) / official.width, b: 1 - (ink.y + ink.height) / official.height };
    const box = { x: x0 + x / PT_PER_IN, y: y0 + y / PT_PER_IN, width: (height * institution.aspect) / PT_PER_IN, height: height / PT_PER_IN };
    tree.add((id) => picture(pkg, part, id, { name: `Partner Strip: ${institution.name}`, description: institution.name, box, image: officialImage(institution), crop }));
  }
}

const sizeIn = (strip) => ({ width: strip.width / PT_PER_IN, height: strip.height / PT_PER_IN });

/** Width over height of a built SVG (its viewBox). */
function svgAspect(svg) {
  const [, , w, h] = String(svg).match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  return w / h;
}

// ---- Layouts ----------------------------------------------------------------
//
// Navy Layouts (Navy Title, Section Divider, Closing) have the Ink background
// and the large Partner Strip on a white band across the bottom. Light Layouts
// (all the others) have the master's Background and the content-slide footer.

const TEXT_WIDTH = SLIDE.widthIn - 2 * MARGIN;

/** The white band across the bottom of a navy layout, sized to hold the large strip and its padding. */
function whiteBandBox(strip, whiteBand) {
  const height = sizeIn(strip).height + 2 * whiteBand.paddingIn;
  return { x: 0, y: SLIDE.heightIn - height, width: SLIDE.widthIn, height };
}

/**
 * A navy layout: `content(tree, pkg, part, band)` adds its shapes above the white band,
 * then the band and the large Partner Strip centred on it are drawn on top.
 */
function navyLayout(name, type, brand, strip, whiteBand, content) {
  return {
    name,
    type,
    write(pkg, part) {
      const tree = new ShapeTree();
      const band = whiteBandBox(strip, whiteBand);
      content(tree, pkg, part, band);
      tree.add((id) => rect(id, { name: "White band", box: band, colour: brand.colours.white }));
      partnerStrip(pkg, part, tree, strip, (SLIDE.widthIn - sizeIn(strip).width) / 2, band.y + whiteBand.paddingIn);
      return { tree, bg: background(brand.colours.ink) };
    },
  };
}

/** A white text placeholder for a navy layout. */
const navyText = (brand, { size, bold = false, font = "+mn-lt", anchor = "t", prompt }) => ({ size, bold, colour: brand.colours.white, font, align: "l", anchor, bullet: false, prompt });
/** A navy layout's title: large, bold, in the heading font, sitting on its box's bottom edge. */
const navyTitle = (brand, prompt) => navyText(brand, { size: 44, bold: true, font: "+mj-lt", anchor: "b", prompt });

// Navy Title: the Horizontal Lockup, title, speaker, venue and date. The
// Lockup is sized by height, so the Wordmark inside it is as tall as it was on
// its own. Closing has the Lockup in the same place.
const TITLE_LOCKUP = { x: MARGIN, y: 0.6, height: 1 };

function addLockup(tree, pkg, part, brand, lockup) {
  const box = { ...TITLE_LOCKUP, width: TITLE_LOCKUP.height * svgAspect(lockup.svg) };
  tree.add((id) => picture(pkg, part, id, { name: "Horizontal Lockup", description: `${brand.wordmark.text}: ${brand.tagline.lines.join(" ")}`, box, image: lockup }));
  return box;
}

function navyTitleLayout(brand, lockup, strip, whiteBand) {
  return navyLayout("Navy Title", "title", brand, strip, whiteBand, (tree, pkg, part, band) => {
    const fields = [
      { name: "Speaker", type: "subTitle", idx: 1, height: 0.5, size: 22, bold: true },
      { name: "Venue", type: "body", idx: 13, height: 0.4, size: 16 },
      { name: "Date", type: "body", idx: 14, height: 0.4, size: 16 },
    ];
    // The fields stack up from just above the band; the title sits on top of them.
    let y = band.y - 0.35 - fields.reduce((sum, f) => sum + f.height, 0);
    const title = { x: MARGIN, y: y - 0.15 - 1.6, width: TEXT_WIDTH, height: 1.6 };
    const mark = addLockup(tree, pkg, part, brand, lockup);
    if (title.y < mark.y + mark.height) throw new Error("Navy Title: the title overlaps the Horizontal Lockup");
    tree.add((id) => placeholder(id, { name: "Title", type: "ctrTitle", box: title, text: navyTitle(brand, "Presentation title") }));
    for (const f of fields) {
      const box = { x: MARGIN, y, width: TEXT_WIDTH, height: f.height };
      y += f.height;
      tree.add((id) => placeholder(id, { name: f.name, type: f.type, idx: f.idx, box, text: navyText(brand, { size: f.size, bold: !!f.bold, prompt: f.name }) }));
    }
  });
}

// Section Divider: a large section title and a subtitle, low on the slide.
function sectionDividerLayout(brand, strip, whiteBand) {
  return navyLayout("Section Divider", "secHead", brand, strip, whiteBand, (tree, pkg, part, band) => {
    const subtitle = { x: MARGIN, y: band.y - 0.6 - 0.6, width: TEXT_WIDTH, height: 0.6 };
    const title = { x: MARGIN, y: subtitle.y - 0.1 - 1.8, width: TEXT_WIDTH, height: 1.8 };
    if (title.y < 0.5) throw new Error("Section Divider: the title runs off the top");
    tree.add((id) => placeholder(id, { name: "Section Title", type: "title", box: title, text: navyTitle(brand, "Section title") }));
    tree.add((id) => placeholder(id, { name: "Subtitle", type: "body", idx: 1, box: subtitle, text: navyText(brand, { size: 20, prompt: "Subtitle" }) }));
  });
}

// Closing: the Horizontal Lockup, a title and contact line, and the DOE funding
// acknowledgment (fixed text from src/brand.json, about three lines) above the band.
const ACKNOWLEDGMENT_SIZE = 11; // pt

function closingLayout(brand, lockup, strip, whiteBand) {
  return navyLayout("Closing", "cust", brand, strip, whiteBand, (tree, pkg, part, band) => {
    const ack = { x: MARGIN, y: band.y - 0.25 - 0.75, width: TEXT_WIDTH, height: 0.75 };
    const contact = { x: MARGIN, y: ack.y - 0.3 - 0.5, width: TEXT_WIDTH, height: 0.5 };
    const title = { x: MARGIN, y: contact.y - 0.1 - 1.2, width: TEXT_WIDTH, height: 1.2 };
    const mark = addLockup(tree, pkg, part, brand, lockup);
    if (title.y < mark.y + mark.height) throw new Error("Closing: the title overlaps the Horizontal Lockup");
    tree.add((id) => placeholder(id, { name: "Title", type: "title", box: title, text: navyTitle(brand, "Thank you") }));
    tree.add((id) => placeholder(id, { name: "Contact", type: "body", idx: 1, box: contact, text: navyText(brand, { size: 18, prompt: "Name · email · website" }) }));
    tree.add((id) => textBox(id, { name: "Funding acknowledgment", box: ack, text: brand.fundingAcknowledgment.text, size: ACKNOWLEDGMENT_SIZE, colour: brand.colours.white, anchor: "b" }));
  });
}

// The content-slide footer: the Icon at left, the slide number in the centre
// and the small Partner Strip at right.
const FOOTER_BOTTOM = 0.1; // in, from the strip's clear space to the slide edge
const FOOTER_RIGHT = 0.35; // in, from the strip's clear space to the slide edge
const FOOTER_ICON_HEIGHT = 0.5;
const SLIDE_NUMBER_BOX = { width: 1, height: 0.4 };

/** Where the content-slide footer sits: the strip's top, its centre line and the footer's top edge, in inches. */
function footer(strip) {
  const stripTop = SLIDE.heightIn - FOOTER_BOTTOM - sizeIn(strip).height;
  const middle = stripTop + sizeIn(strip).height / 2;
  return { stripTop, middle, top: Math.min(stripTop, middle - FOOTER_ICON_HEIGHT / 2, middle - SLIDE_NUMBER_BOX.height / 2) };
}

/**
 * A light layout: `content(tree, footerTop)` adds its placeholders, which must
 * end above `footerTop`, then the footer is drawn.
 */
function contentLayout(name, type, brand, icon, strip, content) {
  return {
    name,
    type,
    write(pkg, part) {
      const tree = new ShapeTree();
      const { stripTop, middle, top } = footer(strip);
      if (BODY_BOX.y + BODY_BOX.height > top) throw new Error(`${name}: the master's text overlaps the footer`);
      content(tree, top);
      tree.add((id) => slideNumber(id, brand, middle));
      const iconBox = { x: MARGIN, y: middle - FOOTER_ICON_HEIGHT / 2, width: FOOTER_ICON_HEIGHT * svgAspect(icon.svg), height: FOOTER_ICON_HEIGHT };
      tree.add((id) => picture(pkg, part, id, { name: "Icon", description: brand.wordmark.text, box: iconBox, image: icon }));
      partnerStrip(pkg, part, tree, strip, SLIDE.widthIn - FOOTER_RIGHT - sizeIn(strip).width, stripTop);
      return { tree };
    },
  };
}

/** The master's title, inherited. */
const masterTitle = (tree) => tree.add((id) => placeholder(id, { name: "Title", type: "title" }));
const COLUMN_GAP = 0.4; // in
/** Two equal columns across the master's text area, COLUMN_GAP apart, from `top` down `height` inches. */
const columns = (top = BODY_BOX.y, height = BODY_BOX.height) => {
  const width = (BODY_BOX.width - COLUMN_GAP) / 2;
  return [BODY_BOX.x, BODY_BOX.x + width + COLUMN_GAP].map((x) => ({ x, y: top, width, height }));
};

function lightLayouts(brand, icon, strip) {
  const layout = (name, type, content) => contentLayout(name, type, brand, icon, strip, content);
  return {
    // A title and a numbered list of agenda items.
    agenda: layout("Agenda", "cust", (tree) => {
      masterTitle(tree);
      tree.add((id) => placeholder(id, { name: "Agenda", type: "body", idx: 1, text: { bullet: "numbered", prompt: "Agenda item" } }));
    }),
    // The master's title and a content placeholder (text, table, chart or picture).
    titleAndContent: layout("Title + Content", "obj", (tree) => {
      masterTitle(tree);
      tree.add((id) => placeholder(id, { name: "Text", idx: 1 }));
    }),
    twoColumn: layout("Two Column", "twoObj", (tree) => {
      masterTitle(tree);
      columns().forEach((box, i) => tree.add((id) => placeholder(id, { name: i ? "Right Column" : "Left Column", idx: i + 1, box })));
    }),
    // Two columns, each with a heading above its content.
    comparison: layout("Comparison", "twoTxTwoObj", (tree) => {
      masterTitle(tree);
      const HEADING = 0.5;
      const headings = columns(BODY_BOX.y, HEADING);
      const contents = columns(BODY_BOX.y + HEADING + 0.1, BODY_BOX.height - HEADING - 0.1);
      ["Left", "Right"].forEach((side, i) => {
        tree.add((id) => placeholder(id, { name: `${side} Heading`, type: "body", idx: 2 * i + 1, box: headings[i], text: { size: 20, bold: true, anchor: "b", bullet: false, prompt: "Heading" } }));
        tree.add((id) => placeholder(id, { name: `${side} Content`, idx: 2 * i + 2, box: contents[i] }));
      });
    }),
    titleOnly: layout("Title Only", "titleOnly", masterTitle),
    // A picture running off the top and sides, and a one-line caption above the footer.
    fullBleedImage: layout("Full-Bleed Image", "picTx", (tree, top) => {
      const caption = { x: MARGIN, y: top - 0.15 - 0.45, width: TEXT_WIDTH, height: 0.45 };
      const image = { x: 0, y: 0, width: SLIDE.widthIn, height: caption.y - 0.1 };
      tree.add((id) => placeholder(id, { name: "Image", type: "pic", idx: 1, box: image, text: { prompt: "Drag an image here" } }));
      tree.add((id) => placeholder(id, { name: "Caption", type: "body", idx: 13, box: caption, text: { size: 14, anchor: "ctr", bullet: false, prompt: "Caption" } }));
    }),
    // One large statement or quote, and who said it.
    bigStatement: layout("Big Statement / Quote", "cust", (tree, top) => {
      const statement = { x: MARGIN + 0.4, y: 0.9, width: TEXT_WIDTH - 0.8, height: 3.7 };
      const attribution = { ...statement, y: statement.y + statement.height + 0.2, height: 0.6 };
      if (attribution.y + attribution.height > top) throw new Error("Big Statement / Quote: the attribution runs into the footer");
      tree.add((id) => placeholder(id, { name: "Statement", type: "body", idx: 1, box: statement, text: { size: 40, bold: true, font: "+mj-lt", anchor: "b", bullet: false, prompt: "A big statement or quote" } }));
      tree.add((id) => placeholder(id, { name: "Attribution", type: "body", idx: 13, box: attribution, text: { size: 18, anchor: "t", bullet: false, prompt: "— Name, affiliation" } }));
    }),
    blank: layout("Blank", "blank", () => {}),
  };
}

// ---- Template ---------------------------------------------------------------

/**
 * Builds the .potx from the brand source, the built Logo pieces and the
 * Partner Strip layouts: `lockup` and `icon` are { svg, png } (the
 * color-on-ink Horizontal Lockup and the color-on-light Icon), `strips` is
 * { large, small } from layOutStrip and `whiteBand` is strip.whiteBand from
 * src/partners.json. Returns the zipped package as a Buffer.
 */
export function slideTemplate({ brand, lockup, icon, strips, whiteBand }) {
  const light = lightLayouts(brand, icon, strips.small);
  const layouts = [
    navyTitleLayout(brand, lockup, strips.large, whiteBand),
    light.agenda,
    sectionDividerLayout(brand, strips.large, whiteBand),
    light.titleAndContent,
    light.twoColumn,
    light.comparison,
    light.titleOnly,
    light.fullBleedImage,
    light.bigStatement,
    closingLayout(brand, lockup, strips.large, whiteBand),
    light.blank,
  ];
  const pkg = new Package();
  const presentation = pkg.add("/ppt/presentation.xml", `${CT}presentationml.template.main+xml`, "");
  pkg.relate("/", "officeDocument", presentation);
  const core = pkg.add("/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml", coreXml());
  pkg.relate("/", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", core);
  const app = pkg.add("/docProps/app.xml", `${CT}extended-properties+xml`, appXml());
  pkg.relate("/", "extended-properties", app);

  const master = pkg.add("/ppt/slideMasters/slideMaster1.xml", `${CT}presentationml.slideMaster+xml`, "");
  const masterRel = pkg.relate(presentation, "slideMaster", master);
  const theme = pkg.add("/ppt/theme/theme1.xml", `${CT}theme+xml`, themeXml(brand));

  const masterTree = new ShapeTree()
    .add((id) => placeholder(id, { name: "Title", type: "title", box: TITLE_BOX, text: { anchor: "b", prompt: "Click to edit the title" } }))
    .add((id) => placeholder(id, { name: "Text", type: "body", idx: 1, box: BODY_BOX, text: { prompt: "Click to edit the text" } }));

  const layoutIds = layouts.map((layout, i) => {
    const part = pkg.add(`/ppt/slideLayouts/slideLayout${i + 1}.xml`, `${CT}presentationml.slideLayout+xml`, "");
    pkg.relate(part, "slideMaster", master);
    const { tree, bg } = layout.write(pkg, part);
    pkg.setBody(part, `${XML_HEAD}<p:sldLayout ${ROOT_NS} type="${layout.type}" preserve="1" userDrawn="1">${cSld(layout.name, bg, tree)}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
    return `<p:sldLayoutId id="${2147483649 + i}" r:id="${pkg.relate(master, "slideLayout", part)}"/>`;
  });
  pkg.relate(master, "theme", theme);
  pkg.setBody(master, masterXml(brand, masterTree, layoutIds));

  const presProps = pkg.add("/ppt/presProps.xml", `${CT}presentationml.presProps+xml`, `${XML_HEAD}<p:presentationPr ${ROOT_NS}/>`);
  pkg.relate(presentation, "presProps", presProps);
  const viewProps = pkg.add("/ppt/viewProps.xml", `${CT}presentationml.viewProps+xml`, `${XML_HEAD}<p:viewPr ${ROOT_NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  pkg.relate(presentation, "viewProps", viewProps);
  const tableStyles = pkg.add("/ppt/tableStyles.xml", `${CT}presentationml.tableStyles+xml`, `${XML_HEAD}<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  pkg.relate(presentation, "tableStyles", tableStyles);
  pkg.relate(presentation, "theme", theme);

  pkg.setBody(presentation, `${XML_HEAD}<p:presentation ${ROOT_NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="${masterRel}"/></p:sldMasterIdLst><p:sldSz cx="${emu(SLIDE.widthIn)}" cy="${emu(SLIDE.heightIn)}"/><p:notesSz cx="${emu(7.5)}" cy="${emu(10)}"/>${defaultTextStyle(brand)}</p:presentation>`);
  return pkg.zip();
}

function defaultTextStyle({ colours }) {
  const lvl = (n) => `<a:lvl${n}pPr marL="${(n - 1) * 457200}" algn="l"><a:defRPr sz="1800">${solidFill(colours.ink)}<a:latin typeface="+mn-lt"/></a:defRPr></a:lvl${n}pPr>`;
  return `<p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl).join("")}</p:defaultTextStyle>`;
}

const coreXml = () =>
  `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>IDEAS Slide Template</dc:title><dc:creator>IDEAS</dc:creator></cp:coreProperties>`;
const appXml = () =>
  `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office PowerPoint</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>0</Slides></Properties>`;

