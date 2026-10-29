export type SupportedImageMime = "image/png" | "image/jpeg" | "image/webp";
export type InspectedImage = { mime: SupportedImageMime; extension: "png" | "jpg" | "webp"; width: number; height: number };

const MAX_DIMENSION = 14_000;
const MAX_PIXELS = 40_000_000;

function byte(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}
function u16be(bytes: Uint8Array, index: number): number {
  return (byte(bytes, index) << 8) | byte(bytes, index + 1);
}
function u16le(bytes: Uint8Array, index: number): number {
  return byte(bytes, index) | (byte(bytes, index + 1) << 8);
}
function u24le(bytes: Uint8Array, index: number): number {
  return byte(bytes, index) | (byte(bytes, index + 1) << 8) | (byte(bytes, index + 2) << 16);
}
function u32be(bytes: Uint8Array, index: number): number {
  return byte(bytes, index) * 0x1000000 + (byte(bytes, index + 1) << 16) + (byte(bytes, index + 2) << 8) + byte(bytes, index + 3);
}
function u32le(bytes: Uint8Array, index: number): number {
  return (byte(bytes, index) | (byte(bytes, index + 1) << 8) | (byte(bytes, index + 2) << 16) | (byte(bytes, index + 3) << 24)) >>> 0;
}
function ascii(bytes: Uint8Array, start: number, length: number): string {
  return Array.from(bytes.slice(start, start + length), (value) => String.fromCharCode(value)).join("");
}
function saneDimensions(width: number, height: number): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0
    && width <= MAX_DIMENSION && height <= MAX_DIMENSION
    && width * height <= MAX_PIXELS;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i += 1) crc = (CRC_TABLE[(crc ^ byte(bytes, i)) & 0xff]! ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function inspectPng(bytes: Uint8Array): InspectedImage | null {
  const signature = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  if (bytes.length < 45 || signature.some((value, index) => byte(bytes, index) !== value)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let seenIHDR = false;
  let seenIDAT = false;
  let ended = false;

  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    if (length > bytes.length || offset + 12 + length > bytes.length) return null;
    const type = ascii(bytes, offset + 4, 4);
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    if (crc32(bytes, offset + 4, crcOffset) !== u32be(bytes, crcOffset)) return null;

    if (!seenIHDR) {
      if (type !== "IHDR" || length !== 13) return null;
      width = u32be(bytes, dataStart);
      height = u32be(bytes, dataStart + 4);
      if (!saneDimensions(width, height)) return null;
      seenIHDR = true;
    } else if (type === "IHDR") {
      return null;
    }

    if (type === "IDAT") {
      if (length === 0) return null;
      seenIDAT = true;
    }
    offset = crcOffset + 4;
    if (type === "IEND") {
      if (length !== 0 || !seenIDAT || offset !== bytes.length) return null;
      ended = true;
      break;
    }
  }

  return seenIHDR && seenIDAT && ended ? { mime: "image/png", extension: "png", width, height } : null;
}

function inspectJpeg(bytes: Uint8Array): InspectedImage | null {
  if (bytes.length < 16 || byte(bytes, 0) !== 0xff || byte(bytes, 1) !== 0xd8
      || byte(bytes, bytes.length - 2) !== 0xff || byte(bytes, bytes.length - 1) !== 0xd9) return null;
  let offset = 2;
  let width = 0;
  let height = 0;
  let seenScan = false;
  const sofMarkers = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);

  while (offset + 3 < bytes.length - 2) {
    while (offset < bytes.length && byte(bytes, offset) !== 0xff) offset += 1;
    while (offset < bytes.length && byte(bytes, offset) === 0xff) offset += 1;
    const marker = byte(bytes, offset++);
    if (marker === 0xda) { seenScan = true; break; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || offset + 2 > bytes.length) break;
    const length = u16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      if (length < 7) return null;
      height = u16be(bytes, offset + 3);
      width = u16be(bytes, offset + 5);
      if (!saneDimensions(width, height)) return null;
    }
    offset += length;
  }

  return seenScan && saneDimensions(width, height)
    ? { mime: "image/jpeg", extension: "jpg", width, height } : null;
}

function inspectWebp(bytes: Uint8Array): InspectedImage | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  if (u32le(bytes, 4) + 8 !== bytes.length) return null;
  let offset = 12;
  let width = 0;
  let height = 0;
  let seenImageChunk = false;
  let seenExtendedHeader = false;

  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = u32le(bytes, offset + 4);
    const dataStart = offset + 8;
    const end = dataStart + length;
    if (end > bytes.length) return null;
    if (type === "VP8X") {
      if (length < 10 || seenExtendedHeader) return null;
      width = 1 + u24le(bytes, dataStart + 4);
      height = 1 + u24le(bytes, dataStart + 7);
      seenExtendedHeader = true;
    } else if (type === "VP8 ") {
      if (length < 10) return null;
      if (byte(bytes, dataStart + 3) !== 0x9d || byte(bytes, dataStart + 4) !== 0x01 || byte(bytes, dataStart + 5) !== 0x2a) return null;
      width ||= u16le(bytes, dataStart + 6) & 0x3fff;
      height ||= u16le(bytes, dataStart + 8) & 0x3fff;
      seenImageChunk = true;
    } else if (type === "VP8L") {
      if (length < 5 || byte(bytes, dataStart) !== 0x2f) return null;
      const w = 1 + byte(bytes, dataStart + 1) + ((byte(bytes, dataStart + 2) & 0x3f) << 8);
      const h = 1 + ((byte(bytes, dataStart + 2) & 0xc0) >> 6) + (byte(bytes, dataStart + 3) << 2) + ((byte(bytes, dataStart + 4) & 0x0f) << 10);
      width ||= w;
      height ||= h;
      seenImageChunk = true;
    }
    offset = end + (length & 1);
  }

  return offset === bytes.length && seenImageChunk && saneDimensions(width, height)
    ? { mime: "image/webp", extension: "webp", width, height } : null;
}

export function inspectImageBytes(bytes: Uint8Array): InspectedImage | null {
  if (bytes.length < 12) return null;
  return inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes);
}
