// Minimal Google Drive client for the weekly backup (no extra packages: plain fetch).
//
// Sign-in uses a long-lived refresh token created once by scripts/google-drive-authorize.js. The token only has the
// "drive.file" permission, which lets the app see and manage ONLY the files it created itself, never the rest of the
// Drive. The backups go to a folder called "Charlie Backups" that the app creates the first time.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export const DRIVE_FOLDER_NAME = "Charlie Backups";

export function driveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

export class DriveError extends Error {}

async function googleJson(res: Response, what: string): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = body.error;
    const msg = typeof err === "string" ? `${err}${body.error_description ? `: ${body.error_description}` : ""}` : ((err as { message?: string } | undefined)?.message ?? res.statusText);
    throw new DriveError(`${what} failed (${res.status}): ${msg}`.slice(0, 300));
  }
  return body;
}

async function accessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const body = await googleJson(res, "Google sign-in");
  if (typeof body.access_token !== "string") throw new DriveError("Google sign-in returned no access token.");
  return body.access_token;
}

async function findOrCreateFolder(token: string): Promise<string> {
  const auth = { Authorization: `Bearer ${token}` };
  const q = encodeURIComponent(`name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const found = await googleJson(await fetch(`${API}/files?q=${q}&fields=files(id)&pageSize=1`, { headers: auth }), "Finding the backup folder");
  const id = (found.files as { id: string }[] | undefined)?.[0]?.id;
  if (id) return id;
  const made = await googleJson(
    await fetch(`${API}/files?fields=id`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    }),
    "Creating the backup folder"
  );
  return String(made.id);
}

/** Saves one backup file into the "Charlie Backups" folder and deletes all but the newest `keep` backups there. */
export async function uploadToDrive(name: string, data: Buffer, keep: number): Promise<{ fileId: string; removed: number }> {
  const token = await accessToken();
  const folderId = await findOrCreateFolder(token);

  const boundary = `charlie-${Date.now().toString(36)}`;
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const up = await googleJson(
    await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }),
    "Uploading the backup"
  );

  // Retention: only this app's own backup files in this folder are ever listed (drive.file permission), newest first.
  const q = encodeURIComponent(`'${folderId}' in parents and name contains 'charlie-backup-' and trashed = false`);
  const list = await googleJson(
    await fetch(`${API}/files?q=${q}&orderBy=createdTime desc&fields=files(id)&pageSize=200`, { headers: { Authorization: `Bearer ${token}` } }),
    "Listing old backups"
  );
  const old = ((list.files as { id: string }[] | undefined) ?? []).slice(keep);
  for (const f of old) {
    await fetch(`${API}/files/${f.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
  }
  return { fileId: String(up.id), removed: old.length };
}
