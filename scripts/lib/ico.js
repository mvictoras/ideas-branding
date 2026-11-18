// Packs rendered PNGs into a Windows .ico container, one PNG-compressed entry
// per image — the encoding every browser reads.
export function icoFromPngs(images) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  let offset = dir.length + entries.length;
  images.forEach(({ size, png }, i) => {
    entries.writeUInt8(size < 256 ? size : 0, i * 16); // width, 0 stands for 256
    entries.writeUInt8(size < 256 ? size : 0, i * 16 + 1); // height
    entries.writeUInt16LE(1, i * 16 + 4); // colour planes
    entries.writeUInt16LE(32, i * 16 + 6); // bits per pixel
    entries.writeUInt32LE(png.length, i * 16 + 8); // bytes in resource
    entries.writeUInt32LE(offset, i * 16 + 12); // image offset
    offset += png.length;
  });

  return Buffer.concat([dir, entries, ...images.map((image) => image.png)]);
}
