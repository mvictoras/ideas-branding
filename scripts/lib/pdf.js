// Renders a scene (see logo.js) as a one-page vector PDF, one drawing unit per point.
import PDFDocument from "pdfkit";

// Fixed metadata so a rebuild with no source change gives the same PDF.
const EPOCH = new Date(Date.UTC(2026, 0, 1));

function draw(doc, nodes, inherited) {
  for (const el of nodes) {
    const fill = el.fill ?? inherited.fill;
    switch (el.type) {
      case "g":
        draw(doc, el.children, { fill, opacity: inherited.opacity * (el.opacity ?? 1) });
        break;
      case "rect":
        doc.save().roundedRect(el.x, el.y, el.width, el.height, el.rx);
        if (el.fill === "none") doc.lineWidth(el.strokeWidth).strokeOpacity(inherited.opacity).stroke(el.stroke);
        else doc.fillOpacity(inherited.opacity).fill(fill);
        doc.restore();
        break;
      case "circle":
        doc.save().circle(el.cx, el.cy, el.r).fillOpacity(inherited.opacity).fill(fill).restore();
        break;
      case "path":
        doc.save().translate(el.x, el.y).path(el.d).fillOpacity(inherited.opacity).fill(fill).restore();
        break;
      default:
        throw new Error(`Unknown scene node "${el.type}"`);
    }
  }
}

export function sceneToPdf({ width, height, title, children }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [width, height],
      margin: 0,
      info: { Title: title, Producer: "ideas-branding", Creator: "ideas-branding", CreationDate: EPOCH, ModDate: EPOCH },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    draw(doc, children, { fill: undefined, opacity: 1 });
    doc.end();
  });
}
