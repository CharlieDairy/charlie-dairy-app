import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLiveUser } from "@/lib/access";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import { buildNotice, dayActivity, farmManagerNames, lastDays, recentTotals, reviewedDays, validFarmDay } from "@/lib/dailyActivity";
import { ReviewAllButton, ReviewDayButton } from "./ReviewButtons";

export const dynamic = "force-dynamic";

const WINDOW = 14;
const fmtDay = (day: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${day}T00:00:00Z`));
const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(d);

export default async function FarmManagerActivityPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getLiveUser();
  if (user?.role !== "ADMIN") redirect("/admin");

  const today = farmDateKey();
  const [names, { totals }] = await Promise.all([farmManagerNames(), recentTotals(WINDOW)]);
  const days = lastDays(today, WINDOW);
  const reviewed = await reviewedDays(days);
  const notice = buildNotice(today, totals, reviewed, WINDOW);
  const waiting = new Set(notice.pastDays.map((d) => d.day));

  const params = await searchParams;
  const picked = validFarmDay(params.date);
  // Open on the newest day still waiting for you, otherwise on today.
  const selected = picked && days.includes(picked) ? picked : notice.pastDays[0]?.day ?? today;
  const detail = await dayActivity(selected);
  const review = await prisma.activityReview.findUnique({ where: { day: selected } });
  const isPast = selected < today;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Farm manager activity</h1>
        <p className="text-sm text-neutral-500">
          Every day the farm manager enters something, it appears here and as a notice on your dashboard until you mark that day as reviewed.
          It lists new entries by the day they were made (Pakistan time){names.length ? <> by <strong>{names.join(", ")}</strong></> : null}. A later edit to an old record is not counted.
        </p>
      </div>

      {names.length === 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No user has the Editor (farm manager) role yet, so there is nothing to report.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_1fr] gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Last {WINDOW} days</h2>
          </div>
          <ReviewAllButton count={notice.pastDays.length} />
          <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {days.map((day) => {
              const total = totals.get(day) ?? 0;
              const status = day === today ? "so far today" : total === 0 ? "no entries" : reviewed.has(day) ? "reviewed" : "waiting";
              const tone = status === "waiting" ? "bg-amber-100 text-amber-800" : status === "reviewed" ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500";
              return (
                <li key={day} className={`border-t border-neutral-100 first:border-t-0 ${day === selected ? "bg-primary-light" : ""}`}>
                  <Link href={`/admin/activity?date=${day}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-neutral-50">
                    <span className="font-medium text-neutral-900">{fmtDay(day)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-neutral-700">{total}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            {fmtDay(selected)} <span className="ml-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">{detail.total} entr{detail.total === 1 ? "y" : "ies"}</span>
          </h2>
          {detail.lines.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">The farm manager made no entries on this day.</p>
          ) : (
            <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="px-4 py-2 text-left">What was entered</th>
                    <th className="px-4 py-2 text-center">Entries</th>
                    <th className="px-4 py-2 text-left">Total</th>
                    <th className="px-4 py-2 text-left">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.key} className="border-t border-neutral-100 align-top">
                      <td className="px-4 py-2 min-w-[220px]">{l.label}</td>
                      <td className="px-4 py-2 text-center font-semibold tabular-nums">{l.count}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-neutral-700">{l.detail ?? ""}</td>
                      <td className="px-4 py-2"><Link className="link-btn" href={l.href}>Open →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isPast ? (
            <p className="text-sm text-neutral-500">Today is not over yet. This day can be marked as reviewed tomorrow, so entries made later are not missed.</p>
          ) : review ? (
            <p className="text-sm text-green-700">Reviewed by {review.reviewedBy} on {fmtTime(review.reviewedAt)}.</p>
          ) : waiting.has(selected) ? (
            <ReviewDayButton day={selected} />
          ) : null}
        </section>
      </div>
    </div>
  );
}
