import {AppError} from "./i18n.js";

export const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;

function invalid() { throw new AppError("imageDecodeFailed"); }
function unsupported() { throw new AppError("imageUnsupported"); }
function dimensions(width, height) {
  if (!width || !height) invalid();
  if (width > MAX_IMAGE_PIXELS / height) throw new AppError("imageTooLarge");
  return {width, height};
}
function text(bytes, start, size) { return String.fromCharCode(...bytes.subarray(start, start + size)); }
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png(bytes, view) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => bytes[index] === byte)) invalid();
  let size;
  let imageData = false;
  let offset = signature.length;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const kind = text(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) invalid();
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) invalid();
    if (!size) {
      if (kind !== "IHDR" || length !== 13) invalid();
      size = dimensions(view.getUint32(offset + 8), view.getUint32(offset + 12));
    } else if (kind === "IHDR") invalid();
    if (["acTL", "fcTL", "fdAT"].includes(kind)) unsupported();
    if (kind === "IDAT") imageData = true;
    if (kind === "IEND") {
      if (length || !imageData || end !== bytes.length) invalid();
      return size;
    }
    offset = end;
  }
  invalid();
}

function jpeg(bytes, view) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) invalid();
  let offset = 2;
  let size;
  let scanned = false;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) invalid();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (!size || !scanned || offset !== bytes.length) invalid();
      return size;
    }
    // Only single-frame, fixed-height baseline/extended/progressive JPEG.
    const frame = [0xc0, 0xc1, 0xc2].includes(marker);
    const known = frame || [0xc4, 0xdb, 0xdd, 0xda, 0xfe].includes(marker) || (marker >= 0xe0 && marker <= 0xef);
    if (!known) unsupported();
    if (offset + 2 > bytes.length) invalid();
    const length = view.getUint16(offset);
    const end = offset + length;
    if (length < 2 || end > bytes.length) invalid();
    if (frame) {
      if (size) unsupported();
      if (length < 11 || bytes[offset + 2] !== 8 || bytes[offset + 7] > 4 || length !== 8 + 3 * bytes[offset + 7]) invalid();
      size = dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
    }
    offset = end;
    if (marker === 0xda) {
      if (!size || length < 6) invalid();
      scanned = true;
      // Entropy data contains stuffed FF00 and restart markers, not segments.
      while (offset < bytes.length) {
        if (bytes[offset++] !== 0xff) continue;
        const start = offset - 1;
        while (bytes[offset] === 0xff) offset++;
        const code = bytes[offset];
        if (code === 0 || (code >= 0xd0 && code <= 0xd7)) { offset++; continue; }
        offset = start;
        break;
      }
    }
  }
  invalid();
}

function webp(bytes, view) {
  if (bytes.length < 12 || text(bytes, 0, 4) !== "RIFF" || text(bytes, 8, 4) !== "WEBP" || view.getUint32(4, true) !== bytes.length - 8) invalid();
  const read24 = offset => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
  let canvas;
  let frame;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = text(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    const next = end + length % 2;
    if (next > bytes.length) invalid();
    if (length % 2 && bytes[end] !== 0) invalid();
    if (kind === "ANIM" || kind === "ANMF") unsupported();
    if (kind === "VP8X") {
      if (offset !== 12 || length !== 10 || canvas || frame || (bytes[start] & 0xc1) || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) invalid();
      if (bytes[start] & 0x02) unsupported();
      canvas = dimensions(read24(start + 4) + 1, read24(start + 7) + 1);
    } else if (kind === "VP8 " || kind === "VP8L") {
      if (frame) unsupported();
      if (kind === "VP8 ") {
        if (length < 10 || (bytes[start] & 1) || text(bytes, start + 3, 3) !== "\x9d\x01\x2a") invalid();
        const width = view.getUint16(start + 6, true);
        const height = view.getUint16(start + 8, true);
        if ((width & 0xc000) || (height & 0xc000)) unsupported();
        frame = dimensions(width, height);
      } else {
        if (length < 5 || bytes[start] !== 0x2f) invalid();
        const bits = view.getUint32(start + 1, true);
        if (bits >>> 29) unsupported();
        frame = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      }
    }
    offset = next;
  }
  if (offset !== bytes.length || !frame || (canvas && (canvas.width !== frame.width || canvas.height !== frame.height))) invalid();
  return frame;
}

/** Parse complete bounded containers without invoking any image decoder. */
export function imageDimensions(bytes, mime) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png") return png(bytes, view);
  if (mime === "image/jpeg") return jpeg(bytes, view);
  if (mime === "image/webp") return webp(bytes, view);
  unsupported();
}
