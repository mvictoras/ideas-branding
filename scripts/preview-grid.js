// `npm run preview:grid`: writes review/wordmark-grid.html, a before/after page
// comparing the www-ideas prototype Wordmark grid with the grid in
// src/brand.json, at several sizes on light and Ink backgrounds. A review aid
// only: review/ is not committed and is not part of the release in build/.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadBrand, layOutWordmark } from "./lib/brand.js";
import { voxelGridSvg } from "./lib/svg.js";

// The www-ideas prototype (option A) as first imported in bb14b03, with the
// Hollow Voxels where the formula (x*7+y*3)%11 put them. Frozen for comparison.
const PROTOTYPE_LETTERS = {
  I: ["o##", ".#.", ".#.", ".#.", "###"],
  D: ["###.", "#..#", "#..o", "#..#", "###."],
  E: ["##o", "o..", "##.", "#..", "###"],
  A: [".##.", "#..#", "####", "#..o", "#..#"],
  S: [".###", "#...", ".##.", "...#", "###."],
};
const INK = "#0b1f3a";
const LIGHT = "#f7f8fb";
const WIDTHS = [720, 320, 160, 80];
const OUT = fileURLToPath(new URL("../review/wordmark-grid.html", import.meta.url));

const brand = loadBrand();
const variant = (name, note, letters) => {
  const layout = layOutWordmark({ ...brand, wordmark: { ...brand.wordmark, letters } });
  return { name, note, layout, svg: voxelGridSvg(layout, { label: brand.wordmark.text }) };
};
const variants = [
  variant("Prototype", "Hollow Voxels placed by formula", PROTOTYPE_LETTERS),
  variant("Refined", "Hand-placed Hollow Voxels (src/brand.json)", brand.wordmark.letters),
];
const backgrounds = [
  { key: "light", label: "On light", colour: LIGHT },
  { key: "ink", label: "On Ink", colour: INK },
];

const picture = ({ columns, rows, voxels }) => {
  const cells = Array.from({ length: rows }, () => Array(columns).fill("·"));
  for (const v of voxels) cells[v.row][v.col] = v.hollow ? "○" : "■";
  return cells.map((row) => row.join(" ")).join("\n");
};

const stats = ({ columns, rows, voxels }) => {
  const hollow = voxels.filter((v) => v.hollow);
  return `${rows}×${columns} grid · ${voxels.length} Voxels, ${hollow.length} of them Hollow Voxels, at ${hollow
    .map((v) => `(${v.row},${v.col})`)
    .join(" ")}`;
};

const panel = ({ key, label, colour }) => `
  <section class="panel ${key}">
    <h2>${label} <span>${colour}</span></h2>
    ${WIDTHS.map(
      (width) => `
    <div class="size">
      <div class="size-label">${width} px wide</div>
      <div class="pair">
        ${variants.map((v) => `<figure style="width:${width}px"><figcaption>${v.name}</figcaption>${v.svg}</figure>`).join("")}
      </div>
    </div>`,
    ).join("")}
  </section>`;

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wordmark Grid Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap">
<style>
/* Layout: one column per background; inside each, prototype and refined side by side per size. */
:root {
  --page: #eef1f6; --fg: ${INK}; --muted: #4a5a73; --rule: #d3d9e4;
  --light: ${LIGHT}; --ink: ${INK}; --on-ink: #c9d3e3;
  --sans: "Inter", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --page: #06121f; --fg: #e3e9f2; --muted: #9aa8bd; --rule: #1f3150; color-scheme: dark } }
:root[data-theme="dark"] { --page: #06121f; --fg: #e3e9f2; --muted: #9aa8bd; --rule: #1f3150; color-scheme: dark }
body { background: var(--page); color: var(--fg); font-family: var(--sans); line-height: 1.5;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 48px; }
main { max-width: 1560px; margin: 0 auto; display: grid; gap: 32px; }
header { display: grid; gap: 8px; max-width: 70ch; }
h1 { font-size: 1.75rem; margin: 0; text-wrap: balance; }
p { margin: 0; color: var(--muted); }
.grids { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 16px; }
.grids > div { min-width: 0; display: grid; gap: 6px; }
.grids h3 { margin: 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; }
pre { margin: 0; font-family: var(--mono); font-size: 0.8rem; line-height: 1.35; overflow-x: auto; padding: 12px; border: 1px solid var(--rule); border-radius: 6px; }
.stats { font-family: var(--mono); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 640px), 1fr)); gap: 16px; }
.panel { min-width: 0; border-radius: 8px; padding: 20px; display: grid; gap: 24px; overflow-x: auto; }
.panel.light { background: var(--light); color: var(--ink); }
.panel.ink { background: var(--ink); color: var(--on-ink); }
.panel h2 { margin: 0; font-size: 1rem; }
.panel h2 span { font-family: var(--mono); font-weight: 400; font-size: 0.8rem; opacity: 0.7; }
.size { display: grid; gap: 8px; }
.size-label, figcaption { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.75; }
.pair { display: flex; flex-wrap: wrap; gap: 24px 40px; align-items: end; }
figure { margin: 0; display: grid; gap: 6px; max-width: 100%; }
figure svg { width: 100%; height: auto; display: block; }
</style>
<main>
  <header>
    <h1>IDEAS Wordmark: prototype vs refined grid</h1>
    <p>Option A, unchanged in spirit. The refined grid hand-places one Hollow Voxel per letter on a stroke end, in a top–bottom–middle–bottom–top rhythm, and restores the E's spine. Colours are the colour-on-light Wordmark on both backgrounds; a colour-on-Ink version comes later, so the navy first step is expected to sit low on Ink.</p>
  </header>
  <div class="grids">
    ${variants
      .map(
        (v) => `<div><h3>${v.name}</h3><p>${v.note}</p><pre aria-label="${v.name} grid">${picture(v.layout)}</pre><p class="stats">${stats(v.layout)}</p></div>`,
      )
      .join("")}
  </div>
  <div class="panels">${backgrounds.map(panel).join("")}</div>
</main>
`;

mkdirSync(fileURLToPath(new URL("../review/", import.meta.url)), { recursive: true });
writeFileSync(OUT, html);
console.log(`Wrote ${OUT}`);
