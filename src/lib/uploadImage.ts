import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export type UploadResult = { url: string | null; error?: string };

// Saves under public/uploads/<subdir>/, served statically at /uploads/<subdir>/<file>.
// Local-disk storage — fine for this app's current single-server setup, but
// won't survive a serverless deploy (e.g. Vercel's read-only/ephemeral
// filesystem). Move to a blob store (Vercel Blob, S3) before deploying there
// — see docs/DEPLOYMENT.md.
export async function saveUploadedImage(file: File, subdir: string): Promise<UploadResult> {
  if (file.size === 0) return { url: null }; // no file selected — not an error
  if (file.size > MAX_SIZE) return { url: null, error: "Image is too large (max 5MB)." };

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return { url: null, error: "Only JPEG, PNG or WebP images are allowed." };

  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return { url: `/uploads/${subdir}/${filename}` };
}

export async function deleteUploadedImage(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;
  try {
    await unlink(path.join(process.cwd(), "public", url));
  } catch {
    // best-effort cleanup; missing file is not an error worth surfacing
  }
}
