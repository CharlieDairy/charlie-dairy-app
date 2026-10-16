import { isAuthorisedCron } from "@/lib/cronAuth";
import { runWatch } from "@/lib/watch/engine";

// Daily Farm Watch check, started by Vercel Cron (see vercel.json) so the dashboard is fresh every morning even if
// nobody opens the app. It only reads records and refreshes the findings list; it never changes business data.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) return new Response("Unauthorized", { status: 401 });
  try {
    const r = await runWatch({ trigger: "auto", byUser: "Vercel cron" });
    return Response.json({ ok: true, open: r.open, created: r.created, resolved: r.resolved, ruleErrors: r.ruleErrors.length, durationMs: r.durationMs });
  } catch (e) {
    console.error("[watch] cron failed", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "watch failed" }, { status: 500 });
  }
}
