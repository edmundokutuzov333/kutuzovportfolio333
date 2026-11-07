const MP4_BRANDS = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "iso8", "iso9", "mp41", "mp42", "avc1", "dash", "M4V ", "MSNV"]);

export function isMp4Source(source) {
  try {
    return /\.mp4$/i.test(decodeURIComponent(new URL(source, "https://assets.invalid").pathname));
  } catch {
    return false;
  }
}

export function inspectArtworkBytes(source, contentType, bytes, expectedSize) {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (!bytes.byteLength) throw new Error("Empty media response.");
  if (expectedSize != null && bytes.byteLength !== expectedSize) {
    throw new Error(`expected ${expectedSize} bytes, received ${bytes.byteLength}`);
  }
  if (!isMp4Source(source)) {
    if (!mime.startsWith("image/")) throw new Error(`expected image bytes, received ${mime || "unknown content type"}`);
    return "image";
  }
  if (mime !== "video/mp4") throw new Error(`expected video/mp4, received ${mime || "unknown content type"}`);
  if (bytes.length < 20) throw new Error("Truncated MP4 file type box.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxSize = view.getUint32(0);
  const ascii = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (ascii(4) !== "ftyp" || boxSize < 16 || boxSize > bytes.length || boxSize % 4 !== 0) {
    throw new Error("Invalid MP4 file type box.");
  }
  const brands = [ascii(8)];
  for (let offset = 16; offset < boxSize; offset += 4) brands.push(ascii(offset));
  if (!brands.some((brand) => MP4_BRANDS.has(brand))) throw new Error("Unsupported MP4 brand.");
  return "video";
}
