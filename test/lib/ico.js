// Reads a Windows .ico back: one entry per image, each decoded as a PNG
// (which also verifies the embedded image really is a PNG).
import { PNG } from "pngjs";

export function readIco(buffer) {
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) throw new Error("not an .ico");
  const count = buffer.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const e = 6 + 16 * i;
    const length = buffer.readUInt32LE(e + 8);
    const offset = buffer.readUInt32LE(e + 12);
    entries.push({
      width: buffer.readUInt8(e) || 256,
      height: buffer.readUInt8(e + 1) || 256,
      png: PNG.sync.read(buffer.subarray(offset, offset + length)),
    });
  }
  return entries;
}
