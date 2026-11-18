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

// The Slide Template's named layouts, in the order PowerPoint lists them.
const LAYOUTS = ["Navy Title", "Agenda", "Section Divider", "Title + Content", "Two Column", "Comparison", "Title Only", "Full-Bleed Image", "Big Statement / Quote", "Closing", "Blank"];
// Navy layouts: Ink background and the large Partner Strip on a white band.
const NAVY = ["Navy Title", "Section Divider", "Closing"];
// Light layouts: the Background and the content-slide footer.
const LIGHT = LAYOUTS.filter((name) => !NAVY.includes(name));
// The DOE funding acknowledgment (ALCF resources and the ASCR Argonne Base project), as given by the IDEAS lead.
// Pinned here on purpose, as well as in src/brand.json: a wording change is a reviewed change to both.
const ACKNOWLEDGMENT =
  "This research used resources of the Argonne Leadership Computing Facility, which is a U.S. Department of Energy Office of Science User Facility operated under contract DE-AC02-06CH11357. This work was supported by the U.S. Department of Energy, Office of Science, Office of Advanced Scientific Computing Research (ASCR), for the project Argonne Base: Scientific Data Management and Visualization to Advance AI for Science, under Contract DE-AC02-06CH11357.";

const placeholdersOf = (shapeList) => shapeList.filter((s) => s.placeholder);
const kindOf = (s) => `${s.placeholder.type}/${s.placeholder.idx}`;
const assertDistinct = (placeholders) => assert.equal(new Set(placeholders.map(kindOf)).size, placeholders.length, "placeholders are distinct");
const lockupsOn = (shapeList) => shapeList.filter((s) => s.kind === "pic" && sameImage(s, logoImage("horizontal-lockup", "color-on-ink")));
const textOf = (el) => descendants(el, NS.a, "t").map((t) => t.textContent).join("");
/** A layout placeholder's box, or the master placeholder's it inherits (matched by idx). */
const boxOf = (pkg, s) => s.box ?? shapes(pkg, pkg.master).find((m) => m.placeholder?.idx === s.placeholder.idx)?.box;

test("the Slide Template has its 11 named layouts, in order", () => {
  assert.deepEqual(open().layouts.map((l) => l.name), LAYOUTS);
});

test("each layout declares PowerPoint's layout type, so changing a deck's template maps its slides onto the right layout", () => {
  const pkg = open();
  const types = Object.fromEntries(pkg.layouts.map((l) => [l.name, pkg.xml(l.part).documentElement.getAttribute("type")]));
  assert.deepEqual(types, {
    "Navy Title": "title",
    Agenda: "cust",
    "Section Divider": "secHead",
    "Title + Content": "obj",
    "Two Column": "twoObj",
    Comparison: "twoTxTwoObj",
    "Title Only": "titleOnly",
    "Full-Bleed Image": "picTx",
    "Big Statement / Quote": "cust",
    Closing: "cust",
    Blank: "blank",
  });
});

test("Navy Title: the Horizontal Lockup, and title, speaker, venue and date placeholders", () => {
  const { shapes: all } = layoutShapes("Navy Title");
  const lockups = lockupsOn(all);
  assert.equal(lockups.length, 1, "one colour-on-ink Horizontal Lockup");
  const mark = lockups[0].box;
  assert.ok(insideSlide(mark) && bottom(mark) < SLIDE.height / 2, "Horizontal Lockup in the top half");
  const svg = readBuilt("logo/horizontal-lockup/ideas-horizontal-lockup-color-on-ink.svg").toString();
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  assert.ok(Math.abs(mark.width / mark.height / (w / h) - 1) < 0.005, "Horizontal Lockup not stretched");

  const placeholders = placeholdersOf(all);
  const byName = (name) => placeholders.find((s) => s.name === name);
  assert.equal(byName("Title")?.placeholder.type, "ctrTitle", "title placeholder");
  assert.equal(byName("Speaker")?.placeholder.type, "subTitle", "speaker placeholder");
  // Text only: a content placeholder would offer to insert tables and charts.
  for (const name of ["Venue", "Date"]) assert.equal(byName(name)?.placeholder.type, "body", `${name} text placeholder`);
  for (const s of placeholders) assert.ok(!overlaps(s.box, mark), `${s.name} clear of the Horizontal Lockup`);
});

for (const name of NAVY) {
  test(`${name}: Ink background and the full-colour large Partner Strip, in the configured order, on a white band at the bottom`, () => {
    const { pkg, layout, shapes: all } = layoutShapes(name);
    assert.equal(solidFillColour(pkg, backgroundFill(pkg, layout.part)), tokens().ink, "Ink background");

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

    const placeholders = placeholdersOf(all);
    assert.ok(placeholders.length > 0, "has placeholders");
    assertDistinct(placeholders);
    for (const s of placeholders) {
      assert.ok(insideSlide(s.box), `${s.name} on the slide`);
      assert.ok(bottom(s.box) <= band.y, `${s.name} above the band`);
    }
  });
}

/**
 * The content-slide footer of a layout: the Icon at left, the slide-number
 * field in the centre, the small Partner Strip at right. Returns its top.
 */
function assertContentFooter(pkg, all) {
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

  const strip = assertIsStrip(partnerLogos(all), "small");

  assert.ok(right(icon) < SLIDE.width / 3, "Icon at left");
  assert.ok(strip.x > SLIDE.width / 3 && right(strip) <= SLIDE.width, "strip at right");
  assert.ok(right(number.box) < strip.x && number.box.x > right(icon), "slide number between Icon and strip");
  const middle = centreY(strip);
  for (const [what, box] of [["Icon", icon], ["slide number", number.box]]) assert.ok(near(centreY(box), middle, 0.02), `${what} on the footer's centre line`);
  for (const [what, box] of [["Icon", icon], ["slide number", number.box], ["strip", strip]]) assert.ok(insideSlide(box), `${what} on the slide`);
  return Math.min(icon.y, number.box.y, strip.y);
}

for (const name of LIGHT) {
  test(`${name}: the Background and the content-slide footer (Icon at left, slide number in the centre, small Partner Strip at right)`, () => {
    const { pkg, layout, shapes: all } = layoutShapes(name);
    const fill = backgroundFill(pkg, layout.part) ?? backgroundFill(pkg, pkg.master);
    assert.equal(solidFillColour(pkg, fill), tokens().background, "Background");
    const footerTop = assertContentFooter(pkg, all);

    const placeholders = placeholdersOf(all);
    assertDistinct(placeholders);
    for (const s of placeholders) {
      const box = boxOf(pkg, s);
      assert.ok(box, `${s.name} has a position`);
      assert.ok(insideSlide(box), `${s.name} on the slide`);
      assert.ok(bottom(box) <= footerTop, `${s.name} above the footer`);
    }
    for (const [i, a] of placeholders.entries()) {
      for (const b of placeholders.slice(i + 1)) assert.ok(!overlaps(boxOf(pkg, a), boxOf(pkg, b)), `${a.name} clear of ${b.name}`);
    }
  });
}

/** The placeholders of a layout, as "type/idx" strings in z-order. */
const placeholderKinds = (name) => placeholdersOf(layoutShapes(name).shapes).map(kindOf);

test("Title + Content: the master's title and a content placeholder", () => {
  // A content placeholder: text, or a table, chart or picture.
  assert.deepEqual(placeholderKinds("Title + Content"), ["title/0", "obj/1"]);
});

test("Agenda: a title and a numbered text list", () => {
  assert.deepEqual(placeholderKinds("Agenda"), ["title/0", "body/1"]);
  const { shapes: all } = layoutShapes("Agenda");
  const list = all.find((s) => s.placeholder?.type === "body");
  assert.ok(descendants(list.el, NS.a, "buAutoNum").length > 0, "agenda items are numbered");
});

test("Section Divider: a section title and a subtitle", () => {
  const { shapes: all } = layoutShapes("Section Divider");
  assert.deepEqual(placeholdersOf(all).map((s) => s.placeholder.type), ["title", "body"]);
});

test("Two Column: a title and two side-by-side content placeholders of equal size", () => {
  assert.deepEqual(placeholderKinds("Two Column"), ["title/0", "obj/1", "obj/2"]);
  const { shapes: all } = layoutShapes("Two Column");
  const [a, b] = all.filter((s) => s.placeholder?.type === "obj").map((s) => s.box);
  assert.ok(right(a) < b.x, "left column then right column");
  assert.ok(near(a.width, b.width) && near(a.height, b.height) && near(a.y, b.y), "columns match");
});

test("Comparison: a title and two headed columns", () => {
  assert.deepEqual(placeholderKinds("Comparison"), ["title/0", "body/1", "obj/2", "body/3", "obj/4"]);
  const { shapes: all } = layoutShapes("Comparison");
  const box = (idx) => all.find((s) => s.placeholder?.idx === idx).box;
  for (const [heading, content] of [["1", "2"], ["3", "4"]]) {
    assert.ok(bottom(box(heading)) <= box(content).y && near(box(heading).x, box(content).x), `heading ${heading} above its column`);
  }
  assert.ok(right(box("2")) < box("4").x, "columns side by side");
});

test("Title Only: just the title", () => {
  assert.deepEqual(placeholderKinds("Title Only"), ["title/0"]);
});

test("Full-Bleed Image: a picture placeholder running edge to edge from the top, and a caption", () => {
  assert.deepEqual(placeholderKinds("Full-Bleed Image"), ["pic/1", "body/13"]);
  const { shapes: all } = layoutShapes("Full-Bleed Image");
  const [image, caption] = placeholdersOf(all).map((s) => s.box);
  assert.ok(near(image.x, 0) && near(image.y, 0) && near(image.width, SLIDE.width), "image bleeds off the top and sides");
  assert.ok(caption.y >= bottom(image), "caption below the image");
});

test("Big Statement / Quote: one large statement and its attribution", () => {
  assert.deepEqual(placeholderKinds("Big Statement / Quote"), ["body/1", "body/13"]);
  const { shapes: all } = layoutShapes("Big Statement / Quote");
  const [statement, attribution] = placeholdersOf(all);
  const size = (s) => Number(descendants(s.el, NS.a, "defRPr")[0]?.getAttribute("sz")) / 100;
  assert.ok(size(statement) >= 36, "statement set large");
  assert.ok(size(attribution) < size(statement), "attribution smaller than the statement");
  assert.ok(bottom(statement.box) <= attribution.box.y, "attribution below the statement");
});

test("Blank: nothing but the footer", () => {
  assert.deepEqual(placeholderKinds("Blank"), []);
});

test("Closing: the Horizontal Lockup, a title, and the DOE ASCR funding acknowledgment above the white band", () => {
  const { pkg, shapes: all } = layoutShapes("Closing");
  assert.equal(lockupsOn(all).length, 1, "one colour-on-ink Horizontal Lockup");
  assert.ok(placeholdersOf(all).some((s) => s.placeholder.type === "title"), "title placeholder");

  // Fixed text on the layout, not a placeholder someone could delete or retype.
  const acks = all.filter((s) => !s.placeholder && textOf(s.el).includes("DE-AC02-06CH11357"));
  assert.equal(acks.length, 1, "one acknowledgment");
  const ack = acks[0];
  assert.equal(textOf(ack.el), ACKNOWLEDGMENT, "the agreed wording");
  assert.ok(child(child(ack.el, NS.p, "spPr"), NS.a, "prstGeom"), "acknowledgment has geometry");
  const band = all.find((s) => s.name === "White band").box;
  assert.ok(insideSlide(ack.box) && bottom(ack.box) <= band.y, "acknowledgment above the band");
  const colours = descendants(ack.el, NS.a, "rPr").map((r) => solidFillColour(pkg, child(r, NS.a, "solidFill")));
  assert.ok(colours.length && colours.every((c) => c === WHITE), "acknowledgment set in white on Ink");
  for (const s of placeholdersOf(all)) assert.ok(!overlaps(s.box, ack.box), `${s.name} clear of the acknowledgment`);
});

test("README documents the Slide Template and every layout", () => {
  const readme = readFileSync(`${ROOT}README.md`, "utf8");
  assert.match(readme, /build\/slide-template\/ideas-slide-template\.potx/);
  for (const name of LAYOUTS) assert.ok(readme.includes(`| ${name} |`), `README layout table lists ${name}`);
});
