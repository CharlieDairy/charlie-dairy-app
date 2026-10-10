// Runs a command against the DEMO schema: node scripts/demo/run.js seed | dev | start
// The demo schema lives in the same database server as the real farm, but in its own schema ("demo"), so the two
// never touch each other. This launcher takes the connection string from .env (or DATABASE_URL) and adds &schema=demo.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..", "..");
let url = process.env.DATABASE_URL;
if (!url) {
  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .env");
  url = m[1].trim().replace(/^"|"$/g, "");
}
url = url.replace(/([?&])schema=[^&]*&?/, "$1").replace(/[?&]$/, "");
url += (url.includes("?") ? "&" : "?") + "schema=demo";

const env = { ...process.env, DATABASE_URL: url, DEMO_MODE: "1", NEXT_PUBLIC_DEMO_MODE: "1" };
const cmd = process.argv[2];
const args = {
  seed: ["tsx", "scripts/demo/seed_demo.ts"],
  dev: ["next", "dev", "-p", "3100"],
  start: ["next", "start", "-p", "3100"],
}[cmd];
if (!args) { console.error("Usage: node scripts/demo/run.js seed|dev|start"); process.exit(1); }
const child = spawn("npx", args, { cwd: root, env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
