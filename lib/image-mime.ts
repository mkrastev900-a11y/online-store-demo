export function detectImageMime(buffer: Buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function detectSupportFileMime(buffer: Buffer) {
  const imageMime = detectImageMime(buffer);
  if (imageMime) return imageMime;

  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);
    for (let offset = 8; offset + 4 <= Math.min(buffer.length, 40); offset += 4) {
      if (brands.has(buffer.toString("ascii", offset, offset + 4).toLowerCase())) return "image/heic";
    }
  }
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08))
  ) {
    return "application/zip";
  }
  return null;
}
