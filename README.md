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

The Tagline is converted to outlines from `src/fonts/JetBrainsMono-SemiBold.ttf` (SIL Open Font License, see `src/fonts/JetBrainsMono-OFL.txt`), so no output depends on an installed font.

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
- `colours`: Ink and white, used by the one-colour versions and for the Tagline.
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
src/brand.json   single source of truth
src/fonts/       the Tagline font (JetBrains Mono, OFL) used for outlining
scripts/         the build (scripts/build.js is the entry point) and the grid preview
test/            checks over build/
assets/partners/ official partner logos and their sources
```
