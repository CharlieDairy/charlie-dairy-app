import { get } from "@vercel/blob";
import { getLiveUser } from "@/lib/access";
import { BACKUP_PREFIX } from "@/lib/backup";

// Admin-only download of one cloud backup from the private Blob store. The route checks the signed-in Admin itself
// (the middleware does not cover /api) and only serves files named like our own backups.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getLiveUser();
  if (!user || user.role !== "ADMIN") return new Response("Only an Admin can download backups.", { status: 403 });

  const token = process.env.BACKUP_BLOB_TOKEN;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!token) return new Response("Backup storage is not set up.", { status: 503 });
  if (!name.startsWith(BACKUP_PREFIX) || !/^backups\/charlie-backup-[0-9_-]+\.json\.gz$/.test(name)) return new Response("Not a backup file.", { status: 400 });

  const file = await get(name, { access: "private", token, useCache: false });
  if (!file || file.statusCode !== 200) return new Response("Backup not found.", { status: 404 });

  return new Response(file.stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name.slice(BACKUP_PREFIX.length)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
