export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** True for images in this project's public storage bucket (safe to optimize). */
export function isStorageImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const u = new URL(url);
    return u.protocol === "https:" && u.host === base.host && u.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

export type ImageType = { mime: string; ext: string };

/**
 * Detects the real image type from the file's first bytes ("magic numbers").
 * The browser-supplied name and content type are never trusted.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (b.length >= 6) {
    const head = String.fromCharCode(...b.slice(0, 6));
    if (head === "GIF87a" || head === "GIF89a") return { mime: "image/gif", ext: "gif" };
  }
  if (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
