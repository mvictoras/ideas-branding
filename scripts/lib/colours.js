// The brand colours as published files: JSON and CSS tokens, and the print
// table with CMYK and the nearest Pantone ink for each brand colour.
import { readFileSync } from "node:fs";

const PANTONE = new URL("../../src/pantone-solid-coated.json", import.meta.url);
const PRINT_CAVEAT = "nearest match, verify before printing";
// The Background is near-white, so it is printed as bare paper, not as an ink (#14).
const PAPER = "unprinted paper";
const PAPER_NOTE = "no ink, print as unprinted paper";

export function loadPantoneInks() {
  return JSON.parse(readFileSync(PANTONE, "utf8")).inks;
}

// ---- Tokens ---------------------------------------------------------------

export function colourTokensJson({ colours, transferFunctionRamp, themeAccents }) {
  const tokens = {
    $comment: "IDEAS brand colours. Generated from src/brand.json by `npm run build`; do not edit.",
    ink: colours.ink,
    background: colours.background,
    white: colours.white,
    transferFunctionRamp,
    themeAccents,
  };
  return JSON.stringify(tokens, null, 2) + "\n";
}

export function colourTokensCss({ colours, transferFunctionRamp, themeAccents }) {
  const prop = (name, value) => `  --ideas-${name}: ${value};`;
  return [
    "/* IDEAS brand colours. Generated from src/brand.json by `npm run build`; do not edit. */",
    ":root {",
    prop("ink", colours.ink),
    prop("background", colours.background),
    prop("white", colours.white),
    ...transferFunctionRamp.map((c, i) => prop(`ramp-${i + 1}`, c)),
    ...themeAccents.map((c, i) => prop(`accent-${i + 1}`, c)),
    "}",
    "",
  ].join("\n");
}

// ---- Colour maths ---------------------------------------------------------

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`"${hex}" is not a #rrggbb colour`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Uncalibrated sRGB -> CMYK, whole percentages. A starting point, not a print profile. */
function hexToCmyk(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  const pct = (v) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return [pct(r), pct(g), pct(b), Math.round(k * 100)];
}

function toLab(hex) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hexToRgb(hex).map((v) => lin(v / 255));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const fy = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const fz = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 difference between two sRGB colours. */
function deltaE2000(hexA, hexB) {
  const [L1, a1, b1] = toLab(hexA);
  const [L2, a2, b2] = toLab(hexB);
  const rad = Math.PI / 180;
  const hue = (b, a) => (Math.atan2(b, a) / rad + 360) % 360;
  const Cm7 = ((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 25 ** 7)));
  const [ap1, ap2] = [a1 * (1 + G), a2 * (1 + G)];
  const [C1, C2] = [Math.hypot(ap1, b1), Math.hypot(ap2, b2)];
  const [h1, h2] = [C1 ? hue(b1, ap1) : 0, C2 ? hue(b2, ap2) : 0];
  const chroma = C1 * C2 !== 0;
  let dh = chroma ? h2 - h1 : 0;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2;
  const Cm = (C1 + C2) / 2;
  let hm = h1 + h2;
  if (chroma) hm = Math.abs(h1 - h2) > 180 ? (hm + (hm < 360 ? 360 : -360)) / 2 : hm / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad)
    + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cm;
  const SH = 1 + 0.015 * Cm * T;
  const RT = -2 * Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  const [l, c, h] = [(L2 - L1) / SL, (C2 - C1) / SC, dH / SH];
  return Math.sqrt(l * l + c * c + h * h + RT * c * h);
}

// ---- Print table ----------------------------------------------------------

/** The colours a printer may be asked to match, in table order. */
function printColours({ colours, transferFunctionRamp, themeAccents }) {
  return [
    { name: "Ink", hex: colours.ink },
    { name: "Background", hex: colours.background, paper: true },
    ...transferFunctionRamp.map((hex, i) => {
      const accent = themeAccents.indexOf(hex);
      return { name: `Ramp ${i + 1}${accent >= 0 ? ` (Accent ${accent + 1})` : ""}`, hex };
    }),
  ];
}

/**
 * One row per brand colour: CMYK, and the candidate Pantone ink closest by
 * CIEDE2000. A paper colour gets no ink: CMYK 0/0/0/0 and no Pantone.
 */
export function printTable(brand, pantoneInks) {
  const inks = Object.entries(pantoneInks);
  if (!inks.length) throw new Error("No Pantone inks to match against");
  return printColours(brand).map(({ name, hex, paper }) => {
    if (paper) return { name, hex, cmyk: [0, 0, 0, 0], paper: true };
    const nearest = inks
      .map(([pantone, inkHex]) => ({ pantone, pantoneHex: inkHex.toLowerCase(), deltaE: deltaE2000(hex, inkHex) }))
      .reduce((best, ink) => (ink.deltaE < best.deltaE ? ink : best));
    return { name, hex, cmyk: hexToCmyk(hex), ...nearest };
  });
}

// RFC 4180: quote a field holding a comma, quote or line break.
const csvField = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));

export function printTableCsv(rows) {
  const header = "name,hex,c,m,y,k,pantone,pantone_hex,delta_e,note";
  const lines = rows.map((r) => {
    const ink = r.paper ? [PAPER, "", "", PAPER_NOTE] : [r.pantone, r.pantoneHex, r.deltaE.toFixed(1), PRINT_CAVEAT];
    return [r.name, r.hex, ...r.cmyk, ...ink].map(csvField).join(",");
  });
  return [header, ...lines, ""].join("\n");
}

export function printTableMarkdown(rows) {
  return [
    "# IDEAS print colours",
    "",
    `**Every Pantone and CMYK value is a ${PRINT_CAVEAT}.** CMYK is an uncalibrated conversion from the screen colour, and each Pantone entry is the closest Solid Coated ink by on-screen colour difference (CIEDE2000, ΔE; under about 2 is hard to tell apart, larger means a visibly different ink). Proof against a physical Pantone swatch book and your printer's profile before any print run.`,
    "",
    "The Background is near-white, so it is printed as unprinted paper, with no ink.",
    "",
    "Generated from `src/brand.json` by `npm run build`; do not edit.",
    "",
    "| Colour | Screen (hex) | CMYK (C / M / Y / K) | Nearest Pantone (verify before printing) | ΔE |",
    "|---|---|---|---|---|",
    ...rows.map((r) => {
      const ink = r.paper ? `Unprinted paper (no ink) | –` : `${r.pantone} (\`${r.pantoneHex}\`) | ${r.deltaE.toFixed(1)}`;
      return `| ${r.name} | \`${r.hex}\` | ${r.cmyk.join(" / ")} | ${ink} |`;
    }),
    "",
  ].join("\n");
}
