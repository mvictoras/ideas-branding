// Checks the Logo family's Wordmark and Lockups in the build output: every piece in
// every colour version and format. Run `npm test` (builds first); tests never
// import generator code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { buildPath, parseSvg, readSource, readVoxels, sourceWordmarkPicture, voxelPicture } from "./lib/output.js";
import { readPdf } from "./lib/pdf.js";

// Fixed by the spec (#1, #4).
const PIECES = ["wordmark", "wordmark-hero", "horizontal-lockup", "stacked-lockup"];
const LOCKUPS = ["horizontal-lockup", "stacked-lockup"];
const VERSIONS = ["color-on-light", "color-on-ink", "mono-ink", "mono-white"];
const PNG_WIDTHS = [400, 800, 1200, 2400];
const RAMP = ["#1e3a8a", "#1d4ed8", "#0284c7", "#0ea5e9", "#14b8a6", "#84cc16", "#f59e0b"];
const INK = "#0b1f3a";
const WHITE = "#ffffff";
const TAGLINE = "intelligent data exploration assistant for science";
// The Horizontal Lockup sets the Tagline on these three lines, as the www-ideas
// prototype header wraps it.
const HORIZONTAL_LINES = ["intelligent data", "exploration", "assistant for science"];
// What each colour version paints the Tagline and the Volume Grid in.
const FOREGROUND = { "color-on-light": INK, "color-on-ink": WHITE, "mono-ink": INK, "mono-white": WHITE };

const path = (piece, version, suffix) => buildPath(`logo/${piece}/ideas-${piece}-${version}${suffix}`);
const each = (fn) => PIECES.flatMap((piece) => VERSIONS.map((version) => fn(piece, version)));
const readSvg = (piece, version) => parseSvg(readFileSync(path(piece, version, ".svg"), "utf8"));
const viewBoxOf = (svg) => svg.getAttribute("viewBox").split(/\s+/).map(Number);
const elements = (node) => [...node.getElementsByTagName("*")];
const byId = (svg, id) => elements(svg).find((el) => el.getAttribute("id") === id);
const paints = (node) =>
  new Set(
    [node, ...elements(node)]
      .flatMap((el) => [el.getAttribute("fill"), el.getAttribute("stroke")])
      .filter((p) => p && p !== "none")
      .map((p) => p.toLowerCase()),
  );

test("every piece × colour version × format exists in the build output", () => {
  const expected = each((piece, version) => [
    path(piece, version, ".svg"),
    path(piece, version, ".pdf"),
    ...PNG_WIDTHS.map((w) => path(piece, version, `-${w}.png`)),
  ]).flat();
  assert.equal(expected.length, 4 * 4 * (2 + PNG_WIDTHS.length));
  assert.deepEqual(expected.filter((f) => !existsSync(f)), [], "missing files");
});

test("every SVG parses as SVG with a numeric viewBox and a title", () => {
  each((piece, version) => {
    const svg = readSvg(piece, version);
    assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg", `${piece} ${version}`);
    assert.match(svg.getAttribute("viewBox"), /^0 0 \d+(\.\d+)? \d+(\.\d+)?$/, `${piece} ${version}`);
    assert.ok(svg.getElementsByTagName("title")[0]?.textContent.startsWith("IDEAS"), `${piece} ${version} title`);
  });
});

test("every PNG has the expected width and the SVG's proportions", () => {
  each((piece, version) => {
    const [, , w, h] = viewBoxOf(readSvg(piece, version));
    for (const width of PNG_WIDTHS) {
      const png = PNG.sync.read(readFileSync(path(piece, version, `-${width}.png`)));
      assert.equal(png.width, width, `${piece} ${version} ${width}`);
      assert.equal(png.height, Math.round((width * h) / w), `${piece} ${version} ${width} height`);
    }
  });
});

test("every PDF is a one-page vector drawing: paths only, no images, no fonts", () => {
  each((piece, version) => {
    const pdf = readPdf(readFileSync(path(piece, version, ".pdf")));
    const where = `${piece} ${version}`;
    assert.equal(pdf.pageCount, 1, `${where} page count`);
    assert.equal(pdf.hasImages, false, `${where} embeds an image`);
    assert.equal(pdf.hasFonts, false, `${where} depends on a font`);
    assert.match(pdf.content, /\s(f|f\*|B|S)\s/, `${where} has no path painting operators`);
    assert.match(pdf.content, /\s(c|l|re)\s/, `${where} has no path construction operators`);
    const [x0, y0, x1, y1] = pdf.mediaBox;
    const [, , w, h] = viewBoxOf(readSvg(piece, version));
    assert.ok(Math.abs((x1 - x0) / (y1 - y0) - w / h) < 0.01, `${where} page proportions differ from the SVG`);
  });
});

test("every piece contains the Wordmark exactly as the source defines it", () => {
  const expected = sourceWordmarkPicture(readSource());
  each((piece, version) => assert.deepEqual(voxelPicture(readVoxels(readSvg(piece, version))), expected, `${piece} ${version}`));
});

test("colour versions colour the Voxels with the ramp; one-colour versions use Ink or white", () => {
  each((piece, version) => {
    const colours = new Set(readVoxels(readSvg(piece, version)).map((v) => v.colour));
    const expected = version.startsWith("color") ? RAMP : [FOREGROUND[version]];
    assert.deepEqual([...colours].sort(), [...expected].sort(), `${piece} ${version}`);
  });
});

test("one-colour SVGs contain exactly one fill colour, Ink or white", () => {
  for (const piece of PIECES) {
    for (const version of ["mono-ink", "mono-white"]) {
      const svg = readSvg(piece, version);
      assert.deepEqual([...paints(svg)], [FOREGROUND[version]], `${piece} ${version}`);
      assert.equal(elements(svg).filter((el) => el.hasAttribute("style") || el.localName === "style").length, 0, "no CSS");
    }
  }
});

test("one-colour PDFs paint with exactly one colour, Ink or white", () => {
  for (const piece of PIECES) {
    for (const version of ["mono-ink", "mono-white"]) {
      const { colours } = readPdf(readFileSync(path(piece, version, ".pdf")));
      assert.deepEqual([...colours], [FOREGROUND[version]], `${piece} ${version}`);
    }
  }
});

test("one-colour PNGs contain only Ink or only white pixels", () => {
  for (const piece of PIECES) {
    for (const version of ["mono-ink", "mono-white"]) {
      const want = FOREGROUND[version].match(/\w\w/g).map((h) => parseInt(h, 16));
      const png = PNG.sync.read(readFileSync(path(piece, version, "-800.png")));
      let painted = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const alpha = png.data[i + 3];
        if (alpha === 0) continue;
        painted++;
        // Un-premultiplying a faint edge pixel rounds its colour by up to 255/alpha.
        const tolerance = Math.ceil(255 / alpha);
        for (let c = 0; c < 3; c++) {
          assert.ok(Math.abs(png.data[i + c] - want[c]) <= tolerance, `${piece} ${version}: off-colour pixel at byte ${i}`);
        }
      }
      assert.ok(painted > 0, `${piece} ${version} is empty`);
    }
  }
});

test("the Volume Grid appears only in the Wordmark-hero files, on empty Voxel positions", () => {
  each((piece, version) => {
    const svg = readSvg(piece, version);
    const grid = byId(svg, "volume-grid");
    const where = `${piece} ${version}`;
    if (piece !== "wordmark-hero") {
      assert.equal(grid, undefined, `${where} has a Volume Grid`);
      assert.equal(svg.getElementsByTagName("circle").length, 0, `${where} has dots`);
      return;
    }
    assert.ok(grid, `${where} has no Volume Grid`);
    const dots = [...grid.getElementsByTagName("circle")];
    const voxels = readVoxels(svg);
    assert.ok(dots.length > voxels.length, `${where}: the Volume Grid should outnumber the Voxels`);
    assert.deepEqual([...paints(grid)], [FOREGROUND[version]], `${where} Volume Grid colour`);
    assert.ok(Number(grid.getAttribute("opacity") ?? dots[0].getAttribute("opacity")) < 0.5, `${where} Volume Grid is not faint`);

    // Dots sit on the Voxel pitch and never under a Voxel.
    const [x0, y0] = [Math.min(...voxels.map((v) => v.cx)), Math.min(...voxels.map((v) => v.cy))];
    const pitch = (Math.max(...voxels.map((v) => v.cx)) - x0) / Math.max(...voxels.map((v) => v.col));
    const taken = new Set(voxels.map((v) => `${v.col},${v.row}`));
    for (const d of dots) {
      const col = (Number(d.getAttribute("cx")) - x0) / pitch;
      const row = (Number(d.getAttribute("cy")) - y0) / pitch;
      assert.ok(Math.abs(col - Math.round(col)) < 0.01 && Math.abs(row - Math.round(row)) < 0.01, `${where}: dot off the Voxel grid`);
      assert.ok(!taken.has(`${Math.round(col)},${Math.round(row)}`), `${where}: dot under a Voxel`);
    }
  });
});

test("Lockup SVGs contain no live text: the Tagline is outlined", () => {
  for (const piece of LOCKUPS) {
    for (const version of VERSIONS) {
      const svg = readSvg(piece, version);
      const live = elements(svg).filter((el) => ["text", "tspan", "textPath", "foreignObject", "style", "font"].includes(el.localName));
      assert.deepEqual(live.map((el) => el.localName), [], `${piece} ${version}`);
      assert.equal(elements(svg).filter((el) => el.hasAttribute("font-family")).length, 0, `${piece} ${version} font-family`);
      assert.ok(byId(svg, "tagline")?.getElementsByTagName("path").length > 0, `${piece} ${version} has no outlined Tagline`);
    }
  }
});

/**
 * Reads the outlined Tagline back out of a Lockup. Each glyph is a <path>
 * placed by translate(x y) at its origin. Lines are grouped by baseline; in a
 * monospaced font a glyph's character index is its offset over the advance,
 * so word spaces show up as skipped indices.
 */
function readTaglineGlyphs(svg) {
  const glyphs = [...byId(svg, "tagline").getElementsByTagName("path")].map((p) => {
    const [, x, y] = p.getAttribute("transform").match(/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/).map(Number);
    return { x, y, d: p.getAttribute("d") };
  });
  const xs = [...new Set(glyphs.map((g) => +g.x.toFixed(3)))].sort((a, b) => a - b);
  const advance = Math.min(...xs.slice(1).map((x, i) => x - xs[i]));
  const baselines = [...new Set(glyphs.map((g) => +g.y.toFixed(3)))].sort((a, b) => a - b);
  return baselines.map((y) => {
    const line = glyphs.filter((g) => +g.y.toFixed(3) === y);
    const x0 = Math.min(...line.map((g) => g.x));
    return line.map((g) => ({ ...g, index: Math.round((g.x - x0) / advance) })).sort((a, b) => a.index - b.index);
  });
}

test("the Tagline reads exactly 'intelligent data exploration assistant for science', lowercase", () => {
  for (const piece of LOCKUPS) {
    for (const version of VERSIONS) {
      const svg = readSvg(piece, version);
      const where = `${piece} ${version}`;
      assert.equal(svg.getElementsByTagName("title")[0].textContent, `IDEAS: ${TAGLINE}`, `${where} title`);
      assert.equal(svg.getAttribute("aria-label"), `IDEAS: ${TAGLINE}`, `${where} aria-label`);
      assert.deepEqual([...paints(byId(svg, "tagline"))], [FOREGROUND[version]], `${where} Tagline colour`);

      const lines = readTaglineGlyphs(svg);
      if (piece === "horizontal-lockup") assert.equal(lines.length, 3, `${where} should set the Tagline on three lines`);
      // Split the Tagline at word boundaries into lines with the same glyph counts.
      const words = TAGLINE.split(" ");
      const expectedLines = [];
      for (const line of lines) {
        const take = [];
        while (words.length && take.join("").length + words[0].length <= line.length) take.push(words.shift());
        expectedLines.push(take.join(" "));
      }
      assert.equal(expectedLines.join(" "), TAGLINE, `${where}: glyph counts don't break the Tagline into whole words`);
      if (piece === "horizontal-lockup") assert.deepEqual(expectedLines, HORIZONTAL_LINES, where);

      // Glyph positions match the characters, and identical glyphs ⇔ identical characters.
      const glyphFor = new Map();
      const charFor = new Map();
      lines.forEach((line, i) => {
        const chars = [...expectedLines[i]].map((ch, index) => ({ ch, index })).filter((c) => c.ch !== " ");
        assert.deepEqual(line.map((g) => g.index), chars.map((c) => c.index), `${where} line ${i + 1}: glyphs don't sit where the letters and spaces go`);
        line.forEach((g, k) => {
          const { ch } = chars[k];
          assert.equal(glyphFor.get(ch) ?? g.d, g.d, `${where}: two different glyphs for "${ch}"`);
          assert.equal(charFor.get(g.d) ?? ch, ch, `${where}: "${charFor.get(g.d)}" and "${ch}" share a glyph`);
          glyphFor.set(ch, g.d);
          charFor.set(g.d, ch);
        });
      });
    }
  }
});

test("the Tagline sits clear of the Wordmark: beside it in the Horizontal Lockup, beneath it in the Stacked Lockup", () => {
  for (const version of VERSIONS) {
    for (const piece of LOCKUPS) {
      const svg = readSvg(piece, version);
      const rects = [...svg.getElementsByTagName("rect")];
      const right = Math.max(...rects.map((r) => Number(r.getAttribute("x")) + Number(r.getAttribute("width"))));
      const bottom = Math.max(...rects.map((r) => Number(r.getAttribute("y")) + Number(r.getAttribute("height"))));
      const glyphs = readTaglineGlyphs(svg).flat();
      if (piece === "horizontal-lockup") {
        assert.ok(Math.min(...glyphs.map((g) => g.x)) > right, `${version}: Tagline overlaps the Wordmark`);
        const top = Math.min(...rects.map((r) => Number(r.getAttribute("y"))));
        assert.ok(glyphs.every((g) => g.y > top && g.y <= bottom), `${version}: Tagline baselines fall outside the Wordmark's height`);
      } else {
        assert.ok(Math.min(...glyphs.map((g) => g.y)) > bottom, `${version}: Tagline is not beneath the Wordmark`);
      }
    }
  }
});
