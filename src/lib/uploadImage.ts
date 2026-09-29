import { put, del } from "@vercel/blob";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export type UploadResult = { url: string | null; error?: string };

// Stored in Vercel Blob (public access) under <subdir>/<file> -- unlike local
// disk, this survives across deploys and works on Vercel's read-only
// serverless filesystem. Swapped in after discovering Asset photos were
// silently being lost on every redeploy under the old local-disk version of
// this function.
export async function saveUploadedImage(file: File, subdir: string): Promise<UploadResult> {
  if (file.size === 0) return { url: null }; // no file selected — not an error
  if (file.size > MAX_SIZE) return { url: null, error: "Image is too large (max 5MB)." };

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return { url: null, error: "Only JPEG, PNG or WebP images are allowed." };

  // The browser-reported MIME type is just a label the uploader controls, so
  // also confirm the file's actual leading bytes match an allowed image format.
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  const matches = (ext === "jpg" && isJpeg) || (ext === "png" && isPng) || (ext === "webp" && isWebp);
  if (!matches) return { url: null, error: "That file doesn't look like a real JPEG, PNG or WebP image." };

  const filename = `${subdir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    const blob = await put(filename, file, { access: "public", addRandomSuffix: false });
    return { url: blob.url };
  } catch (e) {
    console.error("[upload] image upload failed", e);
    return { url: null, error: "The photo couldn't be uploaded right now. Try again, or save without a photo." };
  }
}

export async function deleteUploadedImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    await del(url);
  } catch {
    // best-effort cleanup; missing/already-deleted blob is not an error worth surfacing
  }
}
