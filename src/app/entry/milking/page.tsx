import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMilkingWorklist, getMilkingLog } from "@/lib/reports/milkingWorklist";
import { periodRange } from "@/lib/reports/herd";
import { resolvePeriod } from "@/lib/period";
import PeriodBar from "@/components/PeriodBar";
import { getLiveUser, hasPermission } from "@/lib/access";
import MilkEntryPanel, { type DisplayRow } from "./MilkEntryPanel";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function MilkingEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const user = await getLiveUser();
  const canEdit = !!user && hasPermission(user, "milk", "EDIT");
  const canDelete = !!user && hasPermission(user, "milk", "DELETE");
  const today = todayIso();
  const { period, from, to } = await resolvePeriod(params, "day");
  const date = params.date ?? today;

  const cows = await prisma.cow
    .findMany({ where: { status: { in: ["MILKING", "DRY"] } }, select: { id: true, tag: true } })
    .then((rows) => rows.sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag)));

  const todayWorklist = await getMilkingWorklist(today);

  let displayRows: DisplayRow[];
  let sessionTotals: { morning: number; afternoon: number; evening: number; total: number };
  let groupTotalLitres = 0;
  let logTruncated = false;

  if (period === "day") {
    const dayWorklist = date === today ? todayWorklist : await getMilkingWorklist(date);
    displayRows = dayWorklist.rows.map((r) => ({
      key: r.cowId,
      cowId: r.cowId,
      tag: r.tag,
      date,
      dim: r.dim,
      morning: r.morning,
      afternoon: r.afternoon,
      evening: r.evening,
      total: r.total,
      showAdd: !r.complete,
    }));
    sessionTotals = dayWorklist.sessionTotals;
    groupTotalLitres = dayWorklist.groupTotalLitres;
  } else {
    const { rows: log, truncated } = await getMilkingLog(periodRange(period, new Date(), from, to));
    logTruncated = truncated;
    displayRows = log.map((r) => ({
      key: r.key,
      cowId: r.cowId,
      tag: r.tag,
      date: r.date,
      dim: r.dim,
      morning: r.morning,
      afternoon: r.afternoon,
      evening: r.evening,
      total: r.total,
      showAdd: false,
    }));
    sessionTotals = log.reduce(
      (acc, r) => ({
        morning: acc.morning + (r.morning ?? 0),
        afternoon: acc.afternoon + (r.afternoon ?? 0),
        evening: acc.evening + (r.evening ?? 0),
        total: acc.total + r.total,
      }),
      { morning: 0, afternoon: 0, evening: 0, total: 0 }
    );
    groupTotalLitres = log.filter((r) => r.cowId === null).reduce((n, r) => n + r.total, 0);
  }

  const dayLink = (offset: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return `?period=day&date=${d.toISOString().slice(0, 10)}`;
  };

  const statCards = [
    { label: "Morning", value: sessionTotals.morning, accent: "border-l-green-700" },
    { label: "Afternoon", value: sessionTotals.afternoon, accent: "border-l-warning" },
    { label: "Evening", value: sessionTotals.evening, accent: "border-l-info" },
    { label: "Total", value: sessionTotals.total, accent: "border-l-green-900" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-gradient-to-br from-green-900 to-green-700 px-6 py-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-200">Milk Production and Sale</p>
          <h1 className="text-2xl font-bold text-white mt-1">Milking Entry</h1>
        </div>
        {period === "day" && (
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5">
            <span className="text-xs font-bold tracking-wide text-green-200">DAY</span>
            <Link href={dayLink(-1)} className="px-2 text-white rounded hover:bg-white/10">‹</Link>
            <span className="text-sm font-semibold text-white">{date}</span>
            {date < today && <Link href={dayLink(1)} className="px-2 text-white rounded hover:bg-white/10">›</Link>}
            {date !== today && <Link href="?period=day" className="ml-1 rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20">Today</Link>}
          </div>
        )}
      </div>

      <PeriodBar period={period} from={from} to={to} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className={`bg-white border border-border rounded-xl border-l-4 ${c.accent} p-4`}>
            <div className="text-xs font-bold uppercase tracking-wide text-text-muted">{c.label}</div>
            <div className="text-2xl font-bold text-text mt-1">{c.value.toFixed(1)} L</div>
          </div>
        ))}
      </div>
      {groupTotalLitres > 0 && (
        <p className="text-xs text-text-muted -mt-2">Includes {groupTotalLitres.toFixed(1)} L from earlier Herd/Group entries (tagged &quot;Group&quot; in the table).</p>
      )}

      {(todayWorklist.missingCount > 0 || todayWorklist.incompleteCount > 0) && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm font-semibold text-warning">
          <span>⚠</span>
          <span>Missing today: {todayWorklist.missingCount} · Incomplete today: {todayWorklist.incompleteCount}</span>
        </div>
      )}
      {logTruncated && <p className="text-xs text-text-muted">Showing the most recent 300 records for this period.</p>}

      <MilkEntryPanel cows={cows} rows={displayRows} mode={period === "day" ? "day" : "log"} defaultDate={date} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
