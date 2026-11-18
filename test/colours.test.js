// Checks the brand colours in the build output: the JSON and CSS tokens, the
// print-code table, and that the colours work for text and charts. Run
// `npm test` (builds first); tests never import generator code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildPath, readSource } from "./lib/output.js";
import { COLOUR_VISION_DEFICIENCIES, cmykToHex, contrastRatio, deltaE2000, simulateColourVision } from "./lib/colour.js";

// The palette as the spec (#1) fixes it. The source must still say this.
// The Theme Accent order was changed in #12 so that no neighbouring pair
// clashes for colour-blind viewers (lime and amber used to sit together).
const INK = "#0b1f3a";
const BACKGROUND = "#f7f8fb";
const WHITE = "#ffffff";
const RAMP = ["#1e3a8a", "#1d4ed8", "#0284c7", "#0ea5e9", "#14b8a6", "#84cc16", "#f59e0b"];
const ACCENTS = ["#1d4ed8", "#14b8a6", "#f59e0b", "#0ea5e9", "#1e3a8a", "#84cc16"];
const PRINT_COLOURS = [INK, BACKGROUND, ...RAMP];

const CAVEAT = "nearest match, verify before printing";
// The Background is near-white: printed as bare paper, not matched to an ink (#14).
const PAPER = "unprinted paper";
const WCAG_AA_TEXT = 4.5;
// WCAG 2.x 1.4.11: chart marks need 3:1 against what they sit on.
const WCAG_GRAPHICS = 3;
// Which Theme Accents reach 3:1 as chart marks on each background (#13).
// The pale ones are kept so charts match the Logo; guidance covers the rest.
const ACCENTS_FOR_CHARTS_ON = {
  background: ["#1d4ed8", "#1e3a8a"],
  ink: ["#14b8a6", "#f59e0b", "#0ea5e9", "#84cc16"],
};
// CIEDE2000. About 2 is the smallest difference most people notice side by
// side; chart series need to read apart at a glance, so ask for far more.
const MIN_ACCENT_DIFFERENCE = 10;

const read = (rel) => readFileSync(buildPath(`colours/${rel}`), "utf8");
const readJsonTokens = () => JSON.parse(read("ideas-colours.json"));
const readCssTokens = () => {
  const css = read("ideas-colours.css");
  assert.match(css, /:root\s*\{/, "tokens are declared on :root");
  return Object.fromEntries([...css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
};
// RFC 4180 fields: bare, or double-quoted with "" for a quote. No line breaks in fields.
const csvFields = (line) => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map(([, q, bare]) => (q !== undefined ? q.replaceAll('""', '"') : bare));
const readPrintCsv = () => {
  const [header, ...rows] = read("ideas-print-colours.csv").trim().split(/\r?\n/).map(csvFields);
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
};

test("colour token and print files exist", () => {
  const files = ["ideas-colours.json", "ideas-colours.css", "ideas-print-colours.csv", "ideas-print-colours.md"];
  assert.deepEqual(files.filter((f) => !existsSync(buildPath(`colours/${f}`))), [], "missing files");
});

test("the source defines the palette the spec fixes", () => {
  const { colours, transferFunctionRamp, themeAccents } = readSource();
  assert.equal(colours.ink, INK);
  assert.equal(colours.background, BACKGROUND);
  assert.equal(colours.white, WHITE);
  assert.deepEqual(transferFunctionRamp, RAMP);
  assert.deepEqual(themeAccents, ACCENTS);
});

test("JSON tokens match the source definition", () => {
  const { colours, transferFunctionRamp, themeAccents } = readSource();
  const tokens = readJsonTokens();
  assert.equal(tokens.ink, colours.ink);
  assert.equal(tokens.background, colours.background);
  assert.equal(tokens.white, colours.white);
  assert.deepEqual(tokens.transferFunctionRamp, transferFunctionRamp);
  assert.deepEqual(tokens.themeAccents, themeAccents);
});

test("CSS custom properties match the source definition", () => {
  const { colours, transferFunctionRamp, themeAccents } = readSource();
  const expected = {
    "ideas-ink": colours.ink,
    "ideas-background": colours.background,
    "ideas-white": colours.white,
    ...Object.fromEntries(transferFunctionRamp.map((c, i) => [`ideas-ramp-${i + 1}`, c])),
    ...Object.fromEntries(themeAccents.map((c, i) => [`ideas-accent-${i + 1}`, c])),
  };
  assert.deepEqual(readCssTokens(), expected);
});

test("every brand colour has a print entry: CMYK, and Pantone or paper", () => {
  const rows = readPrintCsv();
  assert.deepEqual(rows.map((r) => r.hex), PRINT_COLOURS, "one row per brand colour, in order");
  for (const r of rows) {
    const cmyk = ["c", "m", "y", "k"].map((k) => Number(r[k]));
    assert.ok(cmyk.every((v) => Number.isInteger(v) && v >= 0 && v <= 100), `${r.hex} CMYK ${cmyk}`);
    if (r.hex === BACKGROUND) {
      assert.deepEqual(cmyk, [0, 0, 0, 0], "the Background prints no ink");
      assert.equal(r.pantone, PAPER);
      assert.equal(r.pantone_hex, "");
      assert.equal(r.delta_e, "");
      assert.match(r.note, /unprinted paper/, "the Background note says to print it as paper");
      continue;
    }
    // An uncalibrated conversion, but it must at least be for this colour.
    assert.ok(deltaE2000(cmykToHex(cmyk), r.hex) < 1.5, `${r.hex} CMYK ${cmyk} is a different colour`);
    assert.match(r.pantone, /^PANTONE .+ C$/, `${r.hex} Pantone`);
    assert.match(r.pantone_hex, /^#[0-9a-f]{6}$/, `${r.hex} Pantone screen value`);
    assert.ok(Math.abs(deltaE2000(r.hex, r.pantone_hex) - Number(r.delta_e)) < 0.1, `${r.hex} delta_e`);
    assert.equal(r.note, CAVEAT, `${r.hex} caveat`);
  }
});

test("the Markdown print table lists every brand colour with the caveat", () => {
  const md = read("ideas-print-colours.md");
  assert.ok(md.toLowerCase().includes(CAVEAT), "caveat");
  for (const r of readPrintCsv()) {
    const line = md.split("\n").find((l) => l.startsWith("|") && l.includes(r.hex));
    assert.ok(line, `${r.hex} row`);
    assert.ok(line.includes(`${r.c} / ${r.m} / ${r.y} / ${r.k}`), `${r.hex} CMYK`);
    assert.ok(line.toLowerCase().includes(r.pantone.toLowerCase()), `${r.hex} Pantone`);
  }
});

test("Ink text on the Background meets WCAG AA", () => {
  const { ink, background } = readJsonTokens();
  const ratio = contrastRatio(ink, background);
  assert.ok(ratio >= WCAG_AA_TEXT, ratio.toFixed(2));
});

test("white text on Ink meets WCAG AA", () => {
  const { ink, white } = readJsonTokens();
  const ratio = contrastRatio(white, ink);
  assert.ok(ratio >= WCAG_AA_TEXT, ratio.toFixed(2));
});

test("adjacent Theme Accents are distinguishable, including 6 back to 1", () => {
  const { themeAccents: a } = readJsonTokens();
  for (let i = 0; i < a.length; i++) {
    const [x, y] = [a[i], a[(i + 1) % a.length]];
    const d = deltaE2000(x, y);
    assert.ok(d >= MIN_ACCENT_DIFFERENCE, `accent ${i + 1} ${x} vs ${y}: ΔE2000 ${d.toFixed(1)}`);
  }
});

test("adjacent Theme Accents stay distinguishable with colour-vision deficiencies", () => {
  const { themeAccents: a } = readJsonTokens();
  for (const deficiency of COLOUR_VISION_DEFICIENCIES) {
    const seen = a.map((c) => simulateColourVision(c, deficiency));
    for (let i = 0; i < a.length; i++) {
      const d = deltaE2000(seen[i], seen[(i + 1) % a.length]);
      assert.ok(d >= MIN_ACCENT_DIFFERENCE, `${deficiency}: accent ${i + 1} ${a[i]} vs ${a[(i + 1) % a.length]}: ΔE2000 ${d.toFixed(1)}`);
    }
  }
});

test("each Theme Accent reaches 3:1 for chart marks on the backgrounds the guidance says", () => {
  const { themeAccents, background, ink } = readJsonTokens();
  const passing = (bg) => themeAccents.filter((c) => contrastRatio(c, bg) >= WCAG_GRAPHICS);
  assert.deepEqual(passing(background), ACCENTS_FOR_CHARTS_ON.background, "on the Background");
  assert.deepEqual(passing(ink), ACCENTS_FOR_CHARTS_ON.ink, "on Ink");
  const nowhere = themeAccents.filter((c) => !passing(background).includes(c) && !passing(ink).includes(c));
  assert.deepEqual(nowhere, [], "every accent works on at least one background");
});
