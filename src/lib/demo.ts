// The demo copy of the app runs the same code against a separate "demo" database schema filled with made-up data
// (see scripts/demo). DEMO_MODE=1 switches on the banner and the sign-in hints; nothing else changes.
export const isDemo = process.env.DEMO_MODE === "1";

export const DEMO_LOGINS = [
  { username: "demo-admin", role: "Admin", note: "sees and changes everything" },
  { username: "demo-editor", role: "Editor", note: "adds, edits and deletes; no Admin panel or finance statements" },
  { username: "demo-partner", role: "Partner", note: "read-only, including P&L, Balance Sheet and Cash Flow" },
  { username: "demo-viewer", role: "View Only", note: "read-only, no finance statements" },
];
export const DEMO_PASSWORD = "Demo@1234";
