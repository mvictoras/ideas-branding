// Renders a scene (see logo.js) as SVG.

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (pairs) =>
  Object.entries(pairs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join("");

function node(el) {
  switch (el.type) {
    case "g":
      return [`<g${attrs({ id: el.id, fill: el.fill, opacity: el.opacity })}>`, ...el.children.map(node), `</g>`].join("\n");
    case "rect":
      return `<rect${attrs({ x: el.x, y: el.y, width: el.width, height: el.height, rx: el.rx, fill: el.fill, stroke: el.stroke, "stroke-width": el.strokeWidth })}/>`;
    case "circle":
      return `<circle${attrs({ cx: el.cx, cy: el.cy, r: el.r })}/>`;
    case "path":
      return `<path${attrs({ transform: `translate(${el.x} ${el.y})`, d: el.d })}/>`;
    default:
      throw new Error(`Unknown scene node "${el.type}"`);
  }
}

export function sceneToSvg({ width, height, title, children }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(title)}">`,
    `<title>${escape(title)}</title>`,
    ...children.map(node),
    `</svg>`,
    "",
  ].join("\n");
}
