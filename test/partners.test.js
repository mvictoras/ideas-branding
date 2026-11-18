// Checks the institution logos and the Partner Strip in the build output against
// src/partners.json and the official files in assets/partners/raw/. Run
// `npm test` (builds first); tests never import generator code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { ROOT, buildPath } from "./lib/output.js";
import { PNG_DPI, PT_PER_IN, SCREEN_DPI, inkProblems, intrinsicSize, rawPath, readStripConfig, readSlots } from "./lib/partners.js";

const config = readStripConfig();
const institutions = config.institutions;
const SIZES = ["large", "small"];
const VERSIONS = ["on-light", "white-band"];
// The order the IDEAS lead set (#1, #7): Argonne leads, the universities
// alphabetically by full name, then Kitware, then Veeda AI last. Pinned on
// purpose: change it here too when the lead changes the strip's membership or order.
const SPEC_ORDER = ["argonne", "ucdavis", "cincinnati", "uic", "unl", "kitware", "veeda"];
const WHITE = "#ffffff";

const logoPath = (id, ext) => buildPath(`partner-strip/logos/${id}.${ext}`);
const stripPath = (size, version, ext) => buildPath(`partner-strip/ideas-partner-strip-${size}-${version}.${ext}`);
const readStrip = (size, version) => readSlots(readFileSync(stripPath(size, version, "svg"), "utf8"));
const rulesOf = (id) => institutions.find((p) => p.id === id).rules;
const inches = (pt) => pt / PT_PER_IN;
const each = (fn) => SIZES.flatMap((size) => VERSIONS.map((version) => fn(size, version)));

test("the config holds the strip order the IDEAS lead set", () => {
  assert.deepEqual(institutions.map((p) => p.id), SPEC_ORDER);
});

test("every institution has an official file, a source and usage rules on record", () => {
  const sources = readFileSync(rawPath("SOURCES.md"), "utf8");
  for (const p of institutions) {
    assert.ok(existsSync(rawPath(p.file)), `${p.id}: ${p.file} missing`);
    assert.match(p.file, /\.(svg|png)$/, p.id);
    assert.ok(sources.includes(p.file), `${p.id}: ${p.file} not recorded in SOURCES.md`);
    assert.ok(p.name && p.source.length > 0 && p.source.every((s) => s.length > 0), `${p.id}: name and source`);
    const { clearSpace, coBranding, minimum } = p.rules;
    assert.ok(clearSpace.ratio > 0 && clearSpace.basis, `${p.id}: clear space`);
    assert.ok(coBranding, `${p.id}: co-branding`);
    assert.ok(minimum === null || ((minimum.widthIn || minimum.heightIn) && minimum.basis), `${p.id}: minimum`);
  }
});

test("every cleaned logo and strip exists as SVG and PNG", () => {
  const expected = [
    ...institutions.flatMap((p) => [logoPath(p.id, "svg"), logoPath(p.id, "png")]),
    ...each((size, version) => [stripPath(size, version, "svg"), stripPath(size, version, "png")]).flat(),
  ];
  assert.deepEqual(expected.filter((f) => !existsSync(f)), [], "missing files");
});

// Every file in which institution logos appear, with the slots it should hold.
const files = () => [
  ...institutions.map((p) => ({ name: `logo ${p.id}`, svg: logoPath(p.id, "svg"), png: logoPath(p.id, "png"), ids: [p.id], transparent: true })),
  ...each((size, version) => ({
    name: `strip ${size} ${version}`,
    svg: stripPath(size, version, "svg"),
    png: stripPath(size, version, "png"),
    ids: institutions.map((p) => p.id),
    transparent: version === "on-light",
  })),
];

test("no recolouring: every logo embeds its official file byte for byte, scaled uniformly", () => {
  for (const f of files()) {
    const { svg, slots } = readSlots(readFileSync(f.svg, "utf8"));
    assert.deepEqual(slots.map((s) => s.id).sort(), [...f.ids].sort(), `${f.name}: slots`);
    for (const s of slots) {
      const p = institutions.find((q) => q.id === s.id);
      const raw = readFileSync(rawPath(p.file));
      assert.ok(s.image.bytes.equals(raw), `${f.name}: ${s.id} differs from ${p.file}`);
      assert.equal(s.image.mime, p.file.endsWith(".svg") ? "image/svg+xml" : "image/png", `${f.name}: ${s.id} type`);
      // The image fills its intrinsic aspect ratio (no stretching)…
      const size = intrinsicSize(p.file);
      assert.ok(Math.abs(s.image.width / s.image.height - size.width / size.height) < 1e-3, `${f.name}: ${s.id} image aspect`);
      // …and the slot crops it without stretching either.
      const [, , vw, vh] = s.viewBox;
      assert.ok(Math.abs(s.width / s.height - vw / vh) < 1e-3, `${f.name}: ${s.id} slot aspect`);
    }
    // Nothing that could paint over or tint a logo.
    const names = new Set([...svg.getElementsByTagName("*")].map((el) => el.localName));
    assert.deepEqual([...names].filter((n) => !["svg", "title", "rect", "image"].includes(n)), [], `${f.name}: unexpected elements`);
    for (const el of svg.getElementsByTagName("*")) {
      for (const a of ["filter", "mask", "opacity", "style", "clip-path", "fill-opacity"]) assert.equal(el.getAttribute(a) || null, null, `${f.name}: ${a}`);
    }
  }
});

test("each slot is the logo trimmed to its visible edges (checked on the PNG)", () => {
  for (const f of files().filter((x) => x.transparent)) {
    const layout = readSlots(readFileSync(f.svg, "utf8"));
    assert.deepEqual(inkProblems(readFileSync(f.png), layout), [], f.name);
  }
});

test("PNGs are rendered at 192 dpi from the SVG's physical size", () => {
  for (const f of files()) {
    const { svg, width, height } = readSlots(readFileSync(f.svg, "utf8"));
    assert.equal(svg.getAttribute("width"), `${+(inches(width)).toFixed(3)}in`, `${f.name}: width attribute`);
    const png = PNG.sync.read(readFileSync(f.png));
    assert.equal(png.width, Math.round(inches(width) * PNG_DPI), `${f.name}: PNG width`);
    assert.ok(Math.abs(png.height - (inches(height) * PNG_DPI)) <= 1, `${f.name}: PNG height`);
  }
});

test("the strips show the logos in the configured order, centred on one line", () => {
  each((size, version) => {
    const { slots } = readStrip(size, version);
    const byX = [...slots].sort((a, b) => a.x - b.x).map((s) => s.id);
    assert.deepEqual(byX, institutions.map((p) => p.id), `${size} ${version}`);
    const centres = slots.map((s) => s.y + s.height / 2);
    assert.ok(Math.max(...centres) - Math.min(...centres) < 0.01, `${size} ${version}: vertical centres`);
  });
});

test("the strips give the logos consistent visual weight", () => {
  each((size, version) => {
    const { slots } = readStrip(size, version);
    // Equal visual weight, not equal height: wide wordmarks sit lower. A logo
    // enlarged to its partner's minimum size is allowed to stand out.
    const atMinimum = (s) => isAtMinimum(s);
    assert.ok(slots.filter(atMinimum).every((m) => slots.filter((s) => !atMinimum(s)).every((s) => m.width * m.height > s.width * s.height)), `${size} ${version}: enlarged logos`);
    const areas = slots.filter((s) => !atMinimum(s)).map((s) => s.width * s.height);
    assert.ok(Math.max(...areas) / Math.min(...areas) < 1.05, `${size} ${version}: ink areas ${areas.map(Math.round)}`);
    const heights = slots.filter((s) => !atMinimum(s)).map((s) => s.height);
    assert.ok(Math.max(...heights) / Math.min(...heights) < 1.7, `${size} ${version}: heights ${heights.map(Math.round)}`);
  });
});

test("each institution's clear space is kept free in the strips and the cleaned logos", () => {
  for (const f of files()) {
    const { width, height, slots } = readSlots(readFileSync(f.svg, "utf8"));
    const sorted = [...slots].sort((a, b) => a.x - b.x);
    const clear = (s) => rulesOf(s.id).clearSpace.ratio * s.height - 0.01;
    const ok = (gap, need, what) => assert.ok(gap >= need, `${f.name}: ${what} ${gap.toFixed(2)}pt < ${need.toFixed(2)}pt`);
    sorted.forEach((s, i) => {
      ok(s.y, clear(s), `${s.id} top`);
      ok(height - s.y - s.height, clear(s), `${s.id} bottom`);
      if (i === 0) ok(s.x, clear(s), `${s.id} left edge`);
      if (i === sorted.length - 1) ok(width - s.x - s.width, clear(s), `${s.id} right edge`);
      if (i > 0) {
        const prev = sorted[i - 1];
        ok(s.x - prev.x - prev.width, Math.max(clear(s), clear(prev)), `${prev.id}–${s.id} gap`);
      }
    });
  }
});

/** The slot's size in inches and its institution's minimum size rule. */
function sizeAndMinimum(s) {
  return { w: inches(s.width), h: inches(s.height), min: rulesOf(s.id).minimum };
}

/** Whether the logo is drawn exactly at its partner's minimum size (held there by the layout). */
function isAtMinimum(s) {
  const { w, h, min } = sizeAndMinimum(s);
  if (!min) return false;
  const near = (a, b) => b && Math.abs(a - b) < 0.002;
  return near(w, min.widthIn) || near(w * SCREEN_DPI, min.widthPx) || near(h, min.heightIn);
}

/** Institutions whose minimum size the strip breaks. */
function belowMinimum(slots) {
  return slots
    .filter((s) => {
      const min = rulesOf(s.id).minimum;
      if (!min) return false;
      const w = inches(s.width);
      const h = inches(s.height);
      return (min.widthIn && w < min.widthIn) || (min.widthPx && w * SCREEN_DPI < min.widthPx) || (min.heightIn && h < min.heightIn);
    })
    .map((s) => s.id)
    .sort();
}

test("each institution's minimum size holds at Slide Template sizes, except waivers pending on #7", () => {
  for (const size of SIZES) {
    const { width, slots } = readStrip(size, "on-light");
    const spec = config.strip.sizes[size];
    assert.ok(Math.abs(inches(width) - spec.widthIn) < 0.001, `${size}: strip width ${inches(width)}in`);
    assert.deepEqual(belowMinimum(slots), [...spec.pendingWaivers].sort(), `${size}: logos below their own minimum`);
  }
  assert.deepEqual(config.strip.sizes.large.pendingWaivers, [], "the large strip meets every rule");
});

test("the white-band strips sit on a full-width white band; the light strips are transparent", () => {
  for (const size of SIZES) {
    const band = readStrip(size, "white-band");
    const light = readStrip(size, "on-light");
    assert.ok(Math.abs(inches(band.width) - config.strip.whiteBand.widthIn) < 0.001, `${size}: band width`);
    const rects = [...band.svg.getElementsByTagName("rect")];
    assert.equal(rects.length, 1, `${size}: one band`);
    const r = rects[0];
    assert.deepEqual(["x", "y", "width", "height"].map((a) => +r.getAttribute(a)), [0, 0, band.width, band.height], `${size}: band covers the file`);
    assert.equal(r.getAttribute("fill").toLowerCase(), WHITE, `${size}: band colour`);
    assert.equal(light.svg.getElementsByTagName("rect").length, 0, `${size}: light strip has no background`);
    // The strip itself is the same on both, only placed on the band.
    const offset = band.slots[0].x - light.slots[0].x;
    band.slots.forEach((s, i) => assert.ok(Math.abs(s.x - offset - light.slots[i].x) < 0.01 && Math.abs(s.width - light.slots[i].width) < 0.01, `${size}: ${s.id} matches the light strip`));
    const png = PNG.sync.read(readFileSync(stripPath(size, "white-band", "png")));
    // One pixel in from the corner, clear of edge anti-aliasing.
    const i = (png.width + 1) * 4;
    assert.deepEqual([...png.data.subarray(i, i + 4)], [255, 255, 255, 255], `${size}: band is opaque white`);
  }
});

test("cleaned logos share one ink height", () => {
  const heights = institutions.map((p) => readSlots(readFileSync(logoPath(p.id, "svg"), "utf8")).slots[0].height);
  assert.ok(heights.every((h) => Math.abs(h - heights[0]) < 0.01), `ink heights ${heights}`);
});

test("README documents the Partner Strip outputs", () => {
  const readme = readFileSync(`${ROOT}README.md`, "utf8");
  assert.match(readme, /build\/partner-strip\//);
  assert.match(readme, /src\/partners\.json/);
});
