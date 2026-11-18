# IDEAS Branding

Generates the visual identity of IDEAS (Intelligent Data Exploration Assistant for Science) from one source definition. Terms such as Wordmark, Voxel and Transfer-Function Ramp are defined in [`CONTEXT.md`](CONTEXT.md).

## Requirements

Node.js 22 or later. Install dependencies once:

```sh
npm install
```

## Build

```sh
npm run build
```

This deletes `build/` and regenerates it from scratch. `build/` is the release. Nothing in it is edited by hand, and it is not committed.

Outputs, under `build/logo/<piece>/`:

| Piece | What it is |
|---|---|
| `wordmark` | The Wordmark alone |
| `wordmark-hero` | The Wordmark on the Volume Grid, for large hero uses only |
| `horizontal-lockup` | The Wordmark with the three-line Tagline beside it, as in the website header |
| `stacked-lockup` | The Wordmark with the Tagline beneath it, for square spaces |
| `icon` | The voxel "i" alone, for favicons, avatars and slide corners |

Each piece comes in four colour versions. All have transparent backgrounds:

| Version | Voxels | Tagline and Volume Grid | Use on |
|---|---|---|---|
| `color-on-light` | Transfer-Function Ramp | Ink | white and light backgrounds |
| `color-on-ink` | Transfer-Function Ramp | white | Ink and other dark backgrounds |
| `mono-ink` | Ink | Ink | where colour isn't allowed or doesn't print well |
| `mono-white` | white | white | dark photos and coloured backgrounds |

Every piece and colour version is written as `ideas-<piece>-<version>.svg`, `.pdf` (vector) and `-<width>.png` at 400, 800, 1200 and 2400 px wide. For example, `build/logo/horizontal-lockup/ideas-horizontal-lockup-color-on-ink-1200.png`.

### Favicons and avatar

`build/favicon/` holds everything a website header or an account profile needs. All three files follow the www-ideas prototype favicon: the Icon runs the full height of a solid Ink tile, in chunky square Voxels coloured top to bottom with the ramp. A favicon or an avatar has to survive light and dark backgrounds, so the tile is always Ink. The `.ico` has the prototype's rounded corners. The Apple touch icon and the avatar are flat squares, because iOS flattens transparency to black and each platform crops avatars to its own shape.

| File | What it is |
|---|---|
| `favicon.ico` | One `.ico` containing 16, 32 and 48 px images |
| `apple-touch-icon.png` | 180 × 180, for iOS home screens |
| `avatar-512.png` | 512 × 512 square, for GitHub, Slack and social accounts |

The Icon is designed to stay legible at 16px, and `test/icon.test.js` checks the smallest favicon layer for it.

### Colours

`build/colours/` publishes the brand colours, generated from `src/brand.json`:

| File | What it is |
|---|---|
| `ideas-colours.json` | Ink, Background, white, the seven Transfer-Function Ramp colours and the six Theme Accents |
| `ideas-colours.css` | The same values as CSS custom properties on `:root`: `--ideas-ink`, `--ideas-background`, `--ideas-white`, `--ideas-ramp-1` to `-7`, `--ideas-accent-1` to `-6` |
| `ideas-print-colours.md` | The print table: CMYK and the nearest Pantone ink for Ink, Background and each ramp colour |
| `ideas-print-colours.csv` | The same table for spreadsheets |

Every CMYK and Pantone value is a **nearest match, verify before printing**. CMYK is an uncalibrated conversion, and the Pantone entry is the closest ink in `src/pantone-solid-coated.json` by on-screen colour difference (CIEDE2000, given as ΔE in the table). The Background is near-white, so the table says to print it as unprinted paper rather than as an ink. Proof against a swatch book before printing; the candidate list's own notes say which inks have been cross-checked.

The Theme Accents are ordered for charts: blue, teal, amber, sky, navy, lime. No two neighbours (including 6 back to 1) clash in normal vision or with protanopia, deuteranopia or tritanopia. Keep lime and amber apart if you reorder them.

#### Charts on light and dark backgrounds

Chart marks need 3:1 contrast with the background (WCAG 1.4.11). The Theme Accents are the Logo's ramp colours, so not all of them reach that everywhere:

| Background | Accents at 3:1 or more | Accents below 3:1 |
|---|---|---|
| Background (`#f7f8fb`) | blue `#1d4ed8`, navy `#1e3a8a` | teal, amber, sky, lime (1.9–2.6:1) |
| Ink (`#0b1f3a`) | teal, amber, sky, lime | blue, navy |

When a pale accent sits on a light background, keep it readable without relying on colour alone:

- Use it for filled areas (bars, areas, large markers), not thin lines or small points.
- Give lines at least 2px stroke, and outline small markers in Ink.
- Label series directly, or add patterns or marker shapes, rather than relying on a colour legend.

On Ink, do the same for blue and navy.

`test/colours.test.js` checks that Ink text on the Background and white text on Ink meet WCAG AA. It checks that neighbouring Theme Accents differ by at least ΔE 10, both in normal vision and under simulated colour-vision deficiencies. It also pins the table above.

The Tagline is converted to outlines from `src/fonts/JetBrainsMono-SemiBold.ttf` (SIL Open Font License, see `src/fonts/JetBrainsMono-OFL.txt`), so no output depends on an installed font.

### Partner Strip

`build/partner-strip/` holds the Partner Strip and the cleaned-up logos it is built from (Argonne, which leads IDEAS, and the six Partners), generated from [`src/partners.json`](src/partners.json) and the official files in `assets/partners/raw/` (sources and usage rules in [`SOURCES.md`](assets/partners/raw/SOURCES.md)).

| File | What it is |
|---|---|
| `logos/<id>.svg`, `.png` | One institution's logo, trimmed to its visible edges, 1 in of ink height, with that institution's own clear space around it |
| `ideas-partner-strip-large-on-light.svg`, `.png` | The strip at 12.6 in wide, transparent, for light backgrounds |
| `ideas-partner-strip-large-white-band.svg`, `.png` | The same strip centred on a 13.333 in white band, for the bottom of navy Title and Closing slides |
| `ideas-partner-strip-small-on-light.svg`, `.png` | The strip at 5.8 in wide, for the right of the content-slide footer |
| `ideas-partner-strip-small-white-band.svg`, `.png` | The small strip on a white band |

The SVGs carry their physical size in inches; the PNGs are rendered at 192 dpi.

**No recolouring.** Each logo is the institution's own file, embedded byte for byte and only cropped and scaled uniformly. `test/partners.test.js` checks this for every logo in every file. If a variant is missing, ask the institution for it; never recolour or redraw one.

**Order and membership** come from the order of `institutions` in `src/partners.json`: Argonne first, the universities alphabetically by full name, then Kitware, then Veeda AI last. To add, remove or reorder one, edit that list and run `npm test`. `test/partners.test.js` pins the order the IDEAS lead set, so update its `SPEC_ORDER` in the same change.

**Sizing.** Logos get equal visual weight rather than equal height: a logo whose ink is a times wider than tall is drawn s / √a tall (`strip.opticalWeight` 0.5). Neighbours keep at least `strip.gap` × s between them and never come inside either partner's clear space. Clear space and minimum sizes are each institution's own rules, recorded under its `rules`. A partner's minimum size takes precedence over strip sizing: a logo that would fall below its minimum is drawn at the minimum instead, and the others shrink to fit (in the large strip UNL is held at 0.5 in, in the small one UC Davis at 1 in).

The large strip meets every institution's minimum size. The small strip can't: holding UNL at 0.5 in tall and Cincinnati at 0.75 in (80 px) wide would leave too little width for the rest. Those two are listed in `strip.sizes.small.pendingWaivers` while waivers are requested (#7), so they are not enlarged there. If a waiver is refused, remove that partner from the list: the layout then holds it at its minimum and shrinks the others. The test fails if any logo not on the list is below its minimum.

## Test

```sh
npm test
```

This runs the build, then checks the files in `build/`. The tests only look at the build output, never at generator code, so a refactor that leaves the output unchanged can't break them.

To re-run one test file against an existing build:

```sh
node --test test/wordmark.test.js
```

## Changing the Logo

Everything comes from [`src/brand.json`](src/brand.json):

- `transferFunctionRamp`: the seven ramp colours, applied to the Wordmark's Voxels by column from left to right.
- `wordmark.letters`: one five-row grid per letter. `#` is a Voxel, `o` is a Hollow Voxel, `.` is empty.
- `icon.grid`: the Icon, a single voxel "i" on its own grid, same cell grammar. The tittle is solid, so it stays crisp at 16px. `icon.rampSteps` gives the ramp index for each row: unlike the Wordmark, the Icon's ramp runs top to bottom.
- `wordmark.letterGap`: empty columns between letters.
- `colours`: Ink and white, used by the one-colour versions and for the Tagline, and the light Background.
- `themeAccents`: the six Slide Template accent colours, in chart-series order, also published as tokens. The tests check the order stays distinguishable for colour-blind viewers.
- `tagline.lines`: the Tagline, one entry per line, always lowercase. `tagline.font` is the font it is outlined from.

Edit the file, then run `npm test`.

The grid is option A from the www-ideas prototype, refined and approved in #3: 5×22 Voxels with one hand-placed Hollow Voxel per letter. `test/wordmark.test.js` pins the Hollow Voxel positions and the Voxel counts, so changing the grid means updating that test as well, after review.

### Reviewing a grid change

```sh
npm run preview:grid
```

This writes `review/wordmark-grid.html`, which shows the frozen prototype grid next to the grid in `src/brand.json`. It shows four sizes, on light and on Ink. `review/` is not committed.

## Layout

```
src/brand.json                 single source of truth
src/pantone-solid-coated.json  candidate Pantone inks for the print table
src/fonts/                     the Tagline font (JetBrains Mono, OFL) used for outlining
scripts/                       the build (scripts/build.js is the entry point) and the grid preview
test/                          checks over build/
src/partners.json              the Partner Strip: partners in order, files, usage rules, sizes
assets/partners/raw/           official partner logos and their sources (SOURCES.md)
```
