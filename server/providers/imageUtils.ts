import { Buffer } from "node:buffer";

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  );
}

export function sniffImageMimeType(buffer: Buffer): string | undefined {
  if (isPng(buffer)) {
    return "image/png";
  }
  if (isJpeg(buffer)) {
    return "image/jpeg";
  }
  if (isWebp(buffer)) {
    return "image/webp";
  }
  return undefined;
}

const FALLBACK_CONTENT_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/binary",
  "application/octetstream",
  "application/x-binary",
  "octet-stream",
  "*/*",
]);

export function resolveImageMimeType(contentType: string | null | undefined, buffer: Buffer): string | undefined {
  const normalized = contentType?.toLowerCase().trim() ?? "";
  if (normalized.startsWith("image/")) {
    return normalized;
  }

  if (FALLBACK_CONTENT_TYPES.has(normalized)) {
    return sniffImageMimeType(buffer);
  }

  return undefined;
}
