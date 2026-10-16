import { timingSafeEqual } from "node:crypto";

// Vercel Cron calls a route with "Authorization: Bearer <CRON_SECRET>" when a CRON_SECRET environment variable is set
// on the project. Without that variable (or with a short one) every cron route refuses all requests, so a missing
// setting can never leave a route open to the internet.
export function isAuthorisedCron(req: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
