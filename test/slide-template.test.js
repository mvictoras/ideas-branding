// Checks the Slide Template (.potx) in the build output by opening it with a
// PPTX reader. Run `npm test` (builds first); tests never import generator code.
// Every later template ticket extends these checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { ROOT, buildPath } from "./lib/output.js";
import { PT_PER_IN, intrinsicSize, rawPath, readSlots, readStripConfig } from "./lib/partners.js";
import { NS, backgroundFill, child, descendants, openTemplate, shapes, solidFillColour, themeColour } from "./lib/pptx.js";

const TEMPLATE = buildPath("slide-template/ideas-slide-template.potx");
const TEMPLATE_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml";
// The 16:9 Slide Template: 13⅓ × 7.5 in, PowerPoint's Widescreen size exactly.
const SLIDE = { width: 40 / 3, height: 7.5 };
const WIDESCREEN_EMU = { cx: 12192000, cy: 6858000 };

// ADR 0001: Helvetica, shown as Arial (same widths) where it isn't installed.
const ARIAL_PANOSE = "020B0604020202020204";
// A theme holds only heading and body fonts; the code font is a theme extension.
const CODE_FONT_NS = "urn:ideas-branding:slide-template";
const WHITE = "#ffffff";
const institutions = readStripConfig().institutions;

const open = () => openTemplate(TEMPLATE);

test("the Slide Template is in the build output as a 16:9 PowerPoint template", () => {
  assert.ok(existsSync(TEMPLATE), "missing .potx");
  const pkg = open();
  assert.equal(pkg.contentType(pkg.presentation), TEMPLATE_TYPE, "main part is a template, not a presentation");
  const size = child(pkg.xml(pkg.presentation).documentElement, NS.p, "sldSz");
  assert.equal(Number(size.getAttribute("cx")), WIDESCREEN_EMU.cx, "slide width");
  assert.equal(Number(size.getAttribute("cy")), WIDESCREEN_EMU.cy, "slide height");
});

test("the package is complete: every part has a content type and every relationship resolves", () => {
  const pkg = open();
  for (const part of pkg.parts.keys()) {
    if (part.endsWith(".rels") || part === "/[Content_Types].xml") continue;
    assert.ok(pkg.contentType(part), `${part} has no content type`);
    if (part.endsWith(".xml")) pkg.xml(part); // well-formed
    for (const [id, { target }] of pkg.rels(part)) {
      if (target) assert.ok(pkg.parts.has(target), `${part} ${id} -> missing ${target}`);
    }
  }
  for (const [id, { target }] of pkg.rels("/")) if (target) assert.ok(pkg.parts.has(target), `package ${id} -> missing ${target}`);
  // Every r:id used in a part is one of its relationships.
  for (const part of [...pkg.parts.keys()].filter((p) => p.endsWith(".xml") && !p.includes("_rels") && p !== "/[Content_Types].xml")) {
    const rels = pkg.rels(part);
    for (const el of descendants(pkg.xml(part), "*", "*")) {
      for (const attr of [...el.attributes].filter((a) => a.namespaceURI === NS.r)) assert.ok(rels.has(attr.value), `${part}: r:${attr.localName}="${attr.value}" not related`);
    }
  }
});

test("every positioned shape on the master and layouts has geometry (Keynote drops the text of shapes without it)", () => {
  const pkg = open();
  for (const part of [pkg.master, ...pkg.layouts.map((l) => l.part)]) {
    for (const s of shapes(pkg, part).filter((x) => x.box)) {
      assert.ok(child(child(s.el, NS.p, "spPr"), NS.a, "prstGeom"), `${part}: "${s.name}" has no geometry`);
    }
  }
});

// ---- Theme ------------------------------------------------------------------

const tokens = () => JSON.parse(readFileSync(buildPath("colours/ideas-colours.json"), "utf8"));
const fontScheme = (pkg) => descendants(pkg.xml(pkg.theme), NS.a, "fontScheme")[0];

test("theme heading and body fonts are Helvetica (ADR 0001)", () => {
  const scheme = fontScheme(open());
  for (const slot of ["majorFont", "minorFont"]) {
    const latin = child(child(scheme, NS.a, slot), NS.a, "latin");
    assert.equal(latin.getAttribute("typeface"), "Helvetica", slot);
    // Arial's PANOSE: apps without Helvetica show Arial, which has the same widths.
    assert.equal(latin.getAttribute("panose"), ARIAL_PANOSE, `${slot} falls back to Arial`);
  }
});

test("the theme's code font is Consolas (ADR 0001)", () => {
  const codeFont = descendants(fontScheme(open()), CODE_FONT_NS, "codeFont");
  assert.equal(codeFont.length, 1, "one code font in the theme");
  assert.equal(codeFont[0].getAttribute("typeface"), "Consolas");
  assert.equal(codeFont[0].getAttribute("fallback"), "Courier New", "ADR 0001 fallback");
});

test("theme accents 1–6 equal the Theme Accent tokens", () => {
  const pkg = open();
  const { themeAccents } = tokens();
  assert.equal(themeAccents.length, 6);
  themeAccents.forEach((colour, i) => assert.equal(themeColour(pkg, `accent${i + 1}`), colour, `accent${i + 1}`));
});

// ---- Layouts ----------------------------------------------------------------

const readBuilt = (rel) => readFileSync(buildPath(rel));
const logoImage = (piece, version) => ({ png: readBuilt(`logo/${piece}/ideas-${piece}-${version}-2400.png`), svg: readBuilt(`logo/${piece}/ideas-${piece}-${version}.svg`) });
const sameImage = (pic, image) => pic.image.png.equals(image.png) && (image.svg ? pic.image.svg?.equals(image.svg) : pic.image.svg === null);
const centreY = ({ y, height }) => y + height / 2;
const bottom = ({ y, height }) => y + height;
const right = ({ x, width }) => x + width;
const near = (a, b, tolerance = 0.002) => Math.abs(a - b) < tolerance;
const overlaps = (a, b) => a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);

function layoutShapes(name) {
  const pkg = open();
  const layout = pkg.layout(name);
  assert.ok(layout, `no "${name}" layout`);
  return { pkg, layout, shapes: shapes(pkg, layout.part) };
}

/**
 * The partner logos on a layout: the pictures embedding an official file, in
 * left-to-right order. Checks each is the official file untouched (never
 * recoloured), cropped and scaled uniformly.
 */
function partnerLogos(shapeList) {
  const logos = [];
  for (const pic of shapeList.filter((s) => s.kind === "pic")) {
    const p = institutions.find((q) => {
      const official = readFileSync(rawPath(q.file));
      return q.file.endsWith(".svg") ? pic.image.svg?.equals(official) : pic.image.png.equals(official);
    });
    if (!p) continue;
    // Nothing in the blip that could change colours (duotone, grayscale, alpha…).
    const effects = [...pic.image.blip.childNodes].filter((c) => c.nodeType === 1 && c.localName !== "extLst").map((c) => c.localName);
    assert.deepEqual(effects, [], `${p.id}: colour effects on the logo`);
    // Uniform scaling: the cropped image keeps its aspect ratio in the box.
    const size = intrinsicSize(p.file);
    const { l, t, r, b } = pic.image.crop;
    const cropped = (size.width * (1 - l - r)) / (size.height * (1 - t - b));
    assert.ok(Math.abs(pic.box.width / pic.box.height / cropped - 1) < 0.005, `${p.id}: stretched`);
    // The PNG drawn by apps without SVG support has the official file's shape too.
    const png = PNG.sync.read(pic.image.png);
    assert.ok(Math.abs(png.width / png.height / (size.width / size.height) - 1) < 0.005, `${p.id}: PNG fallback aspect`);
    logos.push({ id: p.id, box: pic.box });
  }
  return logos.sort((a, b) => a.box.x - b.box.x);
}

/** Checks the logos are the published strip of `size`, placed as one block. */
function assertIsStrip(logos, size) {
  assert.deepEqual(logos.map((l) => l.id), institutions.map((p) => p.id), `${size} strip: the configured order`);
  const { slots, width, height } = readSlots(readFileSync(buildPath(`partner-strip/ideas-partner-strip-${size}-on-light.svg`), "utf8"));
  const byId = new Map(slots.map((s) => [s.id, s]));
  const dx = logos[0].box.x - byId.get(logos[0].id).x / PT_PER_IN;
  const dy = logos[0].box.y - byId.get(logos[0].id).y / PT_PER_IN;
  for (const { id, box } of logos) {
    const s = byId.get(id);
    const expected = { x: s.x / PT_PER_IN + dx, y: s.y / PT_PER_IN + dy, width: s.width / PT_PER_IN, height: s.height / PT_PER_IN };
    for (const k of ["x", "y", "width", "height"]) assert.ok(near(box[k], expected[k]), `${size} strip: ${id} ${k} ${box[k]} ≠ ${expected[k]}`);
  }
  return { x: dx, y: dy, width: width / PT_PER_IN, height: height / PT_PER_IN };
}

const insideSlide = (box) => box.x >= -0.001 && box.y >= -0.001 && right(box) <= SLIDE.width + 0.001 && bottom(box) <= SLIDE.height + 0.001;

test("Navy Title: Ink background, the Wordmark, and title, speaker, venue and date placeholders", () => {
  const { pkg, layout, shapes: all } = layoutShapes("Navy Title");
  assert.equal(solidFillColour(pkg, backgroundFill(pkg, layout.part)), tokens().ink, "Ink background");

  const wordmarks = all.filter((s) => s.kind === "pic" && sameImage(s, logoImage("wordmark", "color-on-ink")));
  assert.equal(wordmarks.length, 1, "one colour-on-ink Wordmark");
  const mark = wordmarks[0].box;
  assert.ok(insideSlide(mark) && bottom(mark) < SLIDE.height / 2, "Wordmark in the top half");
  const svg = readBuilt("logo/wordmark/ideas-wordmark-color-on-ink.svg").toString();
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  assert.ok(Math.abs(mark.width / mark.height / (w / h) - 1) < 0.005, "Wordmark not stretched");

  const placeholders = all.filter((s) => s.placeholder);
  const byName = (name) => placeholders.find((s) => s.name === name);
  assert.equal(byName("Title")?.placeholder.type, "ctrTitle", "title placeholder");
  assert.equal(byName("Speaker")?.placeholder.type, "subTitle", "speaker placeholder");
  // Text only: a content placeholder would offer to insert tables and charts.
  for (const name of ["Venue", "Date"]) assert.equal(byName(name)?.placeholder.type, "body", `${name} text placeholder`);
  assert.equal(new Set(placeholders.map((s) => `${s.placeholder.type}/${s.placeholder.idx}`)).size, placeholders.length, "placeholders are distinct");
  for (const s of placeholders) {
    assert.ok(insideSlide(s.box), `${s.name} on the slide`);
    assert.ok(!overlaps(s.box, mark), `${s.name} clear of the Wordmark`);
  }
});

test("Navy Title: the full-colour large Partner Strip, in the configured order, on a white band at the bottom", () => {
  const { pkg, shapes: all } = layoutShapes("Navy Title");
  const bands = all.filter((s) => s.kind === "sp" && !s.placeholder && solidFillColour(pkg, child(child(s.el, NS.p, "spPr"), NS.a, "solidFill")) === WHITE);
  assert.equal(bands.length, 1, "one white band");
  const band = bands[0].box;
  assert.ok(near(band.x, 0) && near(band.width, SLIDE.width) && near(bottom(band), SLIDE.height), "band spans the bottom of the slide");

  const logos = partnerLogos(all);
  const strip = assertIsStrip(logos, "large");
  assert.ok(strip.y >= band.y - 0.001 && bottom(strip) <= bottom(band) + 0.001, "strip, with its clear space, on the band");
  assert.ok(near(strip.x + strip.width / 2, SLIDE.width / 2, 0.01), "strip centred");
  // The band is drawn first, so the logos sit on top of it.
  const z = (box) => all.findIndex((s) => s.box === box);
  assert.ok(logos.every((l) => z(l.box) > z(band)), "logos above the band");
  for (const s of all.filter((x) => x.placeholder)) assert.ok(bottom(s.box) <= band.y, `${s.name} above the band`);
});

test("Title + Content: the master's title and text on the Background", () => {
  const { pkg, layout, shapes: all } = layoutShapes("Title + Content");
  const fill = backgroundFill(pkg, layout.part) ?? backgroundFill(pkg, pkg.master);
  assert.equal(solidFillColour(pkg, fill), tokens().background, "Background");
  assert.ok(all.some((s) => s.placeholder?.type === "title"), "title placeholder");
  // A content placeholder: text, or a table, chart or picture.
  assert.ok(all.some((s) => s.placeholder?.type === "obj" && s.placeholder.idx === "1"), "content placeholder");
});

test("Title + Content footer: the Icon at left, the slide-number field in the centre, the small Partner Strip at right", () => {
  const { pkg, shapes: all } = layoutShapes("Title + Content");
  const icons = all.filter((s) => s.kind === "pic" && sameImage(s, logoImage("icon", "color-on-light")));
  assert.equal(icons.length, 1, "one colour-on-light Icon");
  const icon = icons[0].box;

  const numbers = all.filter((s) => s.kind === "sp" && descendants(s.el, NS.a, "fld").some((f) => f.getAttribute("type") === "slidenum"));
  assert.equal(numbers.length, 1, "one slide-number field");
  const number = numbers[0];
  // On the layout itself, not a placeholder that shows only when slide numbers are switched on.
  assert.equal(number.placeholder, null, "slide number always shown");
  assert.ok(near(number.box.x + number.box.width / 2, SLIDE.width / 2, 0.01), "slide number centred");
  assert.equal(child(descendants(number.el, NS.a, "p")[0], NS.a, "pPr")?.getAttribute("algn"), "ctr", "slide number text centred");

  const logos = partnerLogos(all);
  const strip = assertIsStrip(logos, "small");

  assert.ok(right(icon) < SLIDE.width / 3, "Icon at left");
  assert.ok(strip.x > SLIDE.width / 3 && right(strip) <= SLIDE.width, "strip at right");
  assert.ok(right(number.box) < strip.x && number.box.x > right(icon), "slide number between Icon and strip");
  const middle = centreY(strip);
  for (const [what, box] of [["Icon", icon], ["slide number", number.box]]) assert.ok(near(centreY(box), middle, 0.02), `${what} on the footer's centre line`);

  // The footer sits below the master's text area and on the slide.
  const body = shapes(pkg, pkg.master).find((s) => s.placeholder?.type === "body");
  for (const [what, box] of [["Icon", icon], ["slide number", number.box], ["strip", strip]]) {
    assert.ok(box.y >= bottom(body.box), `${what} below the text`);
    assert.ok(insideSlide(box), `${what} on the slide`);
  }
});

test("README documents the Slide Template", () => {
  const readme = readFileSync(`${ROOT}README.md`, "utf8");
  assert.match(readme, /build\/slide-template\/ideas-slide-template\.potx/);
  assert.match(readme, /Navy Title/);
  assert.match(readme, /Title \+ Content/);
});
