export interface Size {
  width: number;
  height: number;
}

const DATA_URL = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/i;

function decodeHead(b64: string, bytes: number): Uint8Array | null {
  try {
    // Enough base64 for `bytes` bytes, rounded to a whole quantum.
    const take = Math.ceil(bytes / 3) * 4;
    const bin = atob(b64.replace(/\s+/g, "").slice(0, take));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function pngSize(b: Uint8Array): Size | null {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const width = dv.getUint32(16);
  const height = dv.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function jpegSize(b: Uint8Array): Size | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    // SOF0..SOF15, less DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (b[i + 5]! << 8) | b[i + 6]!;
      const width = (b[i + 7]! << 8) | b[i + 8]!;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + len;
  }
  return null;
}

/**
 * The intrinsic pixel size of a PNG or JPEG data URL, read from its header, or
 * null. Read synchronously so a page can be laid out before the image decodes:
 * pagination must not change when an image finishes loading.
 */
export function imageSizeFromDataUrl(src: string): Size | null {
  const m = DATA_URL.exec(src);
  if (!m) return null;
  const isPng = m[1]!.toLowerCase() === "png";
  // A JPEG's SOF can sit behind EXIF; 64 KiB covers every real header.
  const head = decodeHead(m[2]!, isPng ? 32 : 65536);
  if (!head) return null;
  return isPng ? pngSize(head) : jpegSize(head);
}

/**
 * The size an image block is drawn at, in CSS px -- the writer's rules
 * (last-word `resolveImageSize`), capped at the text column instead of the
 * writer's fixed maximum so a narrow page does not overflow.
 */
export function resolveImageSize(
  block: { src: string; widthPx?: number; heightPx?: number },
  maxWidthPx: number,
): Size {
  const intrinsic = imageSizeFromDataUrl(block.src);
  const given = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
  let width = given(block.widthPx);
  let height = given(block.heightPx);
  const aspect = intrinsic ? intrinsic.width / intrinsic.height : 1.5;

  if (width === undefined && height === undefined) {
    width = intrinsic?.width ?? 300;
    height = intrinsic?.height ?? 200;
  } else if (width === undefined) {
    width = height! * aspect;
  } else if (height === undefined) {
    height = width / aspect;
  }

  if (width! > maxWidthPx) {
    height = (height! * maxWidthPx) / width!;
    width = maxWidthPx;
  }
  return { width: Math.max(1, Math.round(width!)), height: Math.max(1, Math.round(height!)) };
}
