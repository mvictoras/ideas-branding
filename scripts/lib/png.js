// Rasterises SVG to PNG at a given pixel width (height follows the aspect ratio).
import { Resvg } from "@resvg/resvg-js";

export function svgToPng(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render().asPng();
}
