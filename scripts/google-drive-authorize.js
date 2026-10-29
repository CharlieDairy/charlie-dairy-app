// One-time connection of the farm's Google Drive for the weekly backup.
//
//   node scripts/google-drive-authorize.js "E:\Charlie\client_secret_xxx.json"
//
// The JSON file is the "Desktop app" OAuth client downloaded from Google Cloud Console. This opens Google's own consent
// page in your browser (you sign in and press Allow; the permission is "drive.file", i.e. only files this app creates),
// receives the answer on a port that only this computer can reach, and saves GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
// GOOGLE_REFRESH_TOKEN to the linked Vercel project (Production, marked Sensitive). Nothing is printed or written to disk.
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const { spawnSync, exec } = require("child_process");

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/google-drive-authorize.js "<path to the downloaded OAuth client .json>"');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const client = raw.installed || raw.web;
if (!client || !client.client_id || !client.client_secret) {
  console.error("That file does not look like an OAuth client file (no client_id / client_secret).");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");

function setVercelEnv(name, value) {
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "--yes"], { shell: true, stdio: "ignore" });
  const r = spawnSync("npx", ["vercel", "env", "add", name, "production", "--sensitive"], { shell: true, input: value, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`Could not save ${name} to Vercel: ${(r.stderr || r.stdout || "").trim().slice(0, 200)}`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }
  const finish = (code, msg) => {
    res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" }).end(`<p style="font:18px sans-serif;margin:40px">${msg}</p>`);
  };
  try {
    if (url.searchParams.get("error")) throw new Error(`Google said: ${url.searchParams.get("error")}`);
    if (url.searchParams.get("state") !== state) throw new Error("The answer did not match this request. Run the script again.");
    const code = url.searchParams.get("code");
    if (!code) throw new Error("No code came back from Google.");
    const redirect = `http://127.0.0.1:${server.address().port}`;
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: client.client_id, client_secret: client.client_secret, redirect_uri: redirect, grant_type: "authorization_code" }),
    }).then((r) => r.json());
    if (!tok.refresh_token) throw new Error(`Google did not return a refresh token (${tok.error || "unknown"}${tok.error_description ? `: ${tok.error_description}` : ""}).`);
    setVercelEnv("GOOGLE_CLIENT_ID", client.client_id);
    setVercelEnv("GOOGLE_CLIENT_SECRET", client.client_secret);
    setVercelEnv("GOOGLE_REFRESH_TOKEN", tok.refresh_token);
    finish(200, "Google Drive is connected. You can close this tab and go back to Claude.");
    console.log("Connected. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN are saved to Vercel (Production). Redeploy to use them.");
    server.close();
  } catch (e) {
    finish(500, `Something went wrong: ${e.message}`);
    console.error(e.message);
    server.close();
    process.exitCode = 1;
  }
});

server.listen(0, "127.0.0.1", () => {
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const auth =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirect,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file",
      access_type: "offline",
      prompt: "consent",
      state,
    });
  console.log("Opening Google in your browser. If nothing opens, paste this address into the browser:\n" + auth);
  exec(`start "" "${auth}"`);
});
