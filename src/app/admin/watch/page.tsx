import Link from "next/link";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, getLiveUser } from "@/lib/access";
import { runWatch } from "@/lib/watch/engine";
import { aiConfigured, type Review } from "@/lib/watch/ai";
import { CATEGORY_LABEL, type Category } from "@/lib/watch/types";
import FindingActions from "./FindingActions";
import { AiReviewButton, RunCheckButton } from "./WatchControls";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEV_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 } as const;
const SEV_STYLE: Record<string, { badge: string; bar: string; label: string }> = {
  HIGH: { badge: "bg-red-100 text-red-800", bar: "border-l-red-500", label: "High" },
  MEDIUM: { badge: "bg-amber-100 text-amber-800", bar: "border-l-amber-500", label: "Medium" },
  LOW: { badge: "bg-sky-100 text-sky-800", bar: "border-l-sky-400", label: "Low" },
  INFO: { badge: "bg-neutral-200 text-neutral-700", bar: "border-l-neutral-300", label: "Info" },
};

// Wrapped so the clock is read in one place (server component, request time).
const nowMs = () => Date.now();

function ago(d: Date): string {
  const mins = Math.round((nowMs() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

export default async function WatchPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const user = await getLiveUser();
  if (!user) return null;
  const isAdmin = user.role === "ADMIN";
  const canAct = canWrite(user);

  const lastRun = await prisma.watchRun.findFirst({ orderBy: { startedAt: "desc" } });
  // Refresh in the background when the last check is old, so the page opens at once.
  const stale = !lastRun || nowMs() - lastRun.startedAt.getTime() > 6 * 3_600_000;
  if (stale) after(() => runWatch({ trigger: "auto" }).catch((e) => console.error("[watch] background run failed", e)));

  const visible = isAdmin ? {} : { financeOnly: false };
  const [all, resolvedRecently, review] = await Promise.all([
    prisma.watchFinding.findMany({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] }, ...visible } }),
    prisma.watchFinding.count({ where: { status: "RESOLVED", resolvedAt: { gte: new Date(nowMs() - 7 * 86_400_000) }, ...visible } }),
    isAdmin ? prisma.watchReview.findFirst({ orderBy: { createdAt: "desc" } }) : Promise.resolve(null),
  ]);

  const sorted = [...all].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  const open = sorted.filter((f) => f.status === "OPEN");
  const handled = sorted.filter((f) => f.status !== "OPEN");
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of open) counts[f.severity]++;
  const cats = [...new Set(open.map((f) => f.category))];
  const shown = cat ? open.filter((f) => f.category === cat) : open;

  const rec = review?.recommendations as { priorities?: Review["priorities"]; usage?: Review["usage"] } | null | undefined;
  const gaps = (review?.gaps ?? []) as Review["gaps"];
  const questions = (review?.questions ?? []) as string[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-6 rounded-2xl bg-gradient-to-br from-green-900 to-green-700 px-6 py-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-green-200">Virtual farm manager &amp; accountant</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Farm Watch</h1>
          <p className="mt-2 text-sm text-green-100">It reads every record, lists what is wrong or missing, and says what to do about it. It never changes your data.</p>
        </div>
        <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-green-50">
          {lastRun ? (
            <>
              <div className="font-semibold">Last checked {ago(lastRun.startedAt)}</div>
              <div className="text-xs text-green-200">{lastRun.byUser ? `by ${lastRun.byUser}` : "automatically"} · {(lastRun.durationMs / 1000).toFixed(1)}s</div>
            </>
          ) : (
            <div className="font-semibold">First check is running…</div>
          )}
        </div>
      </div>

      {canAct && (
        <div className="flex flex-wrap items-start gap-4">
          <RunCheckButton />
          {isAdmin && <AiReviewButton configured={aiConfigured()} />}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["HIGH", "MEDIUM", "LOW", "INFO"] as const).map((s) => (
          <div key={s} className={`rounded-xl border border-border border-l-4 bg-white p-4 ${SEV_STYLE[s].bar}`}>
            <div className="text-xs font-bold uppercase tracking-wide text-text-muted">{SEV_STYLE[s].label}</div>
            <div className="mt-1 text-3xl font-bold text-text">{counts[s]}</div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <section className="rounded-2xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-text">AI review</h2>
            {review && <span className="text-xs text-text-muted">{ago(review.createdAt)} · {review.model} · {((review.inputTokens ?? 0) + (review.outputTokens ?? 0)).toLocaleString()} tokens</span>}
          </div>
          {!review ? (
            <p className="mt-2 text-sm text-text-muted">
              No review yet. {aiConfigured() ? "Press Generate AI review: it reads the findings and your data coverage and writes a plain-language brief, the gaps in the app, and how to use it better." : "Once an Anthropic API key is added to the Vercel project, this page can write a plain-language brief, list the gaps in the app, and recommend how to use it better. The checks below already work without it."}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-5">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-text">{review.brief}</p>

              {!!rec?.priorities?.length && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Do these first</h3>
                  <ol className="mt-2 flex flex-col gap-2">
                    {rec.priorities.map((p, i) => (
                      <li key={i} className="rounded-lg border border-border bg-neutral-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                          <span className="font-semibold text-text">{p.title}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-text-muted ring-1 ring-border">{p.owner}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-text-muted ring-1 ring-border">{p.when}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-text-muted">{p.why}</p>
                        <p className="mt-1 text-sm text-text"><b>Action:</b> {p.action}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {gaps.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Gaps in the app</h3>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {gaps.map((g, i) => (
                      <div key={i} className="rounded-lg border border-border p-3 text-sm">
                        <div className="font-semibold text-text">{g.area}</div>
                        <p className="mt-1 text-text-muted">{g.gap}</p>
                        <p className="mt-1 text-text-muted"><b>Impact:</b> {g.impact}</p>
                        <p className="mt-1 text-text"><b>Recommended:</b> {g.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!rec?.usage?.length && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">How to use the app from here</h3>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {rec.usage.map((u, i) => (
                      <li key={i} className="rounded-lg border border-border p-3">
                        <span className="font-semibold text-text">{u.practice}.</span> <span className="text-text-muted">{u.recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {questions.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Questions for you</h3>
                  <ul className="mt-2 list-disc pl-5 text-sm text-text">{questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </div>
              )}
              <p className="text-xs text-text-muted">Written by AI from the findings and totals above. Check anything important against the records before acting.</p>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-bold text-text">What needs attention ({open.length})</h2>
          <Link href="/admin/watch" className={`rounded-full border px-3 py-1.5 text-xs ${!cat ? "border-primary bg-primary text-white" : "border-border text-text-muted hover:bg-primary-light"}`}>All</Link>
          {cats.map((c) => (
            <Link key={c} href={`/admin/watch?cat=${c}`} className={`rounded-full border px-3 py-1.5 text-xs ${cat === c ? "border-primary bg-primary text-white" : "border-border text-text-muted hover:bg-primary-light"}`}>
              {CATEGORY_LABEL[c as Category] ?? c}
            </Link>
          ))}
        </div>

        {shown.length === 0 && <p className="rounded-xl border border-border bg-white p-5 text-sm text-text-muted">Nothing needs attention here.</p>}

        {shown.map((f) => (
          <article key={f.id} className={`rounded-xl border border-border border-l-4 bg-white p-4 ${SEV_STYLE[f.severity].bar}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEV_STYLE[f.severity].badge}`}>{SEV_STYLE[f.severity].label}</span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-text-muted">{CATEGORY_LABEL[f.category as Category] ?? f.category}</span>
              {f.financeOnly && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">Admin only</span>}
            </div>
            <h3 className="mt-2 text-base font-semibold text-text">{f.title}</h3>
            <p className="mt-1 text-sm text-text-muted">{f.detail}</p>
            {f.suggestion && <p className="mt-2 rounded-lg bg-primary-light px-3 py-2 text-sm text-text"><b>What to do:</b> {f.suggestion}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-text-muted">First seen {ago(f.firstSeen)} · seen in {f.seenCount} check{f.seenCount === 1 ? "" : "s"}</span>
              <FindingActions id={f.id} status={f.status} canAct={canAct && (!f.financeOnly || isAdmin)} />
            </div>
          </article>
        ))}
      </section>

      {handled.length > 0 && (
        <details className="rounded-xl border border-border bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-text">Acknowledged or hidden ({handled.length})</summary>
          <div className="mt-3 flex flex-col gap-2">
            {handled.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">{f.title}</div>
                  <div className="text-xs text-text-muted">{f.status === "SNOOZED" && f.snoozedUntil ? `Hidden until ${f.snoozedUntil.toISOString().slice(0, 10)}` : "Acknowledged"}{f.acknowledgedBy ? ` by ${f.acknowledgedBy}` : ""}</div>
                </div>
                <FindingActions id={f.id} status={f.status} canAct={canAct && (!f.financeOnly || isAdmin)} />
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-xs text-text-muted">{resolvedRecently} item{resolvedRecently === 1 ? "" : "s"} cleared in the last 7 days. The check runs automatically when this page is opened and the last check is more than 6 hours old.</p>
    </div>
  );
}
