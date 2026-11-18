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

Current outputs:

| File | What it is |
|---|---|
| `build/logo/wordmark/ideas-wordmark-color-on-light.svg` | Wordmark, full colour, for light backgrounds (transparent) |
| `build/logo/wordmark/ideas-wordmark-color-on-light-1200.png` | The same, 1200 px wide |

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

- `transferFunctionRamp`: the seven ramp colours, applied to the Voxels by column from left to right.
- `wordmark.letters`: one five-row grid per letter. `#` is a Voxel, `o` is a Hollow Voxel, `.` is empty.
- `wordmark.letterGap`: empty columns between letters.

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
scripts/         the build (scripts/build.js is the entry point) and the grid preview
test/            checks over build/
assets/partners/ official partner logos and their sources
```
