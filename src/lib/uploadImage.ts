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

  const filename = `${subdir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const blob = await put(filename, file, { access: "public", addRandomSuffix: false });

  return { url: blob.url };
}

export async function deleteUploadedImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    await del(url);
  } catch {
    // best-effort cleanup; missing/already-deleted blob is not an error worth surfacing
  }
}
