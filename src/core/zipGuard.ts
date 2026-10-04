// Inspect ZIP directory metadata before handing a DOCX to the mature parser.
// No entries are extracted here. ZIP64 and encrypted containers are deliberately refused.
export function inspectDocx(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('The ZIP container is incomplete.');
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (view.getUint32(end + 4, true) !== 0 || view.getUint16(end + 8, true) !== count || count > 5000 || offset + size > end) {
    throw new Error('This ZIP container exceeds the supported limits.');
  }
  let expanded = 0;
  const names = new Set<string>();
  for (let n = 0; n < count; n++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP directory.');
    const flags = view.getUint16(offset + 8, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 1 || uncompressed > 32 * 1024 * 1024) throw new Error('Encrypted or oversized ZIP entry.');
    expanded += uncompressed;
    if (expanded > 96 * 1024 * 1024) throw new Error('The expanded document is too large (96 MB limit).');
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name.includes('\\') || name.startsWith('/') || name.includes('\0') || name.split('/').includes('..') || names.has(name)) {
      throw new Error('Unsafe or duplicate ZIP entry.');
    }
    if (/vbaProject\.bin$/i.test(name)) throw new Error('Macro-enabled documents are not supported.');
    names.add(name);
    offset = next;
  }
  return names.has('[Content_Types].xml') && names.has('word/document.xml');
}
