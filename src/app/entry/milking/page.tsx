import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMilkingWorklist } from "@/lib/reports/milkingWorklist";
import MilkingForm from "./MilkingForm";
import GroupMilkingForm from "./GroupMilkingForm";
import EntryTabs from "./EntryTabs";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftCell(litres: number | null) {
  return litres !== null ? `${litres.toFixed(1)} L` : "—";
}

export default async function MilkingEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; cowId?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? todayIso();
  const today = todayIso();

  const [cows, worklist] = await Promise.all([
    prisma.cow
      .findMany({ where: { status: { in: ["MILKING", "DRY"] } }, select: { id: true, tag: true } })
      .then((rows) => rows.sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag))),
    getMilkingWorklist(date),
  ]);

  const dayLink = (offset: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return `?date=${d.toISOString().slice(0, 10)}`;
  };

  const statCards = [
    { label: "Morning", value: worklist.sessionTotals.morning, accent: "border-l-green-700" },
    { label: "Afternoon", value: worklist.sessionTotals.afternoon, accent: "border-l-warning" },
    { label: "Evening", value: worklist.sessionTotals.evening, accent: "border-l-info" },
    { label: "Total", value: worklist.sessionTotals.total, accent: "border-l-green-900" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-green-900 to-green-700 px-6 py-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-200">Milk Production and Sale</p>
          <h1 className="text-2xl font-bold text-white mt-1">Milking Entry</h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5">
          <span className="text-xs font-bold tracking-wide text-green-200">DAY</span>
          <Link href={dayLink(-1)} className="px-2 text-white rounded hover:bg-white/10">‹</Link>
          <span className="text-sm font-semibold text-white">{date}</span>
          {date < today && <Link href={dayLink(1)} className="px-2 text-white rounded hover:bg-white/10">›</Link>}
          {date !== today && <Link href="?" className="text-xs text-green-100 underline ml-1">Today</Link>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className={`bg-white border border-border rounded-xl border-l-4 ${c.accent} p-4`}>
            <div className="text-xs font-bold uppercase tracking-wide text-text-muted">{c.label}</div>
            <div className="text-2xl font-bold text-text mt-1">{c.value.toFixed(1)} L</div>
          </div>
        ))}
      </div>
      {worklist.groupTotalLitres > 0 && (
        <p className="text-xs text-text-muted -mt-2">Total includes {worklist.groupTotalLitres.toFixed(1)} L unattributed Herd/Group total</p>
      )}

      {(worklist.missingCount > 0 || worklist.incompleteCount > 0) && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm font-semibold text-warning">
          <span>⚠</span>
          <span>Missing: {worklist.missingCount} · Incomplete: {worklist.incompleteCount}</span>
        </div>
      )}

      <div className="overflow-x-auto bg-white border border-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-primary-light">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Tag</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">DIM</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Morning</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Afternoon</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Evening</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Total</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {worklist.rows.map((r) => (
              <tr key={r.cowId} className={`border-t border-border/60 ${r.recordedShifts === 0 ? "bg-danger-light/40" : !r.complete ? "bg-warning-light/40" : ""}`}>
                <td className="px-3 py-2 font-semibold">{r.tag}</td>
                <td className="px-3 py-2 text-right text-text-muted">{r.dim ?? "—"}</td>
                <td className="px-3 py-2 text-right text-text-muted">{shiftCell(r.morning)}</td>
                <td className="px-3 py-2 text-right text-text-muted">{shiftCell(r.afternoon)}</td>
                <td className="px-3 py-2 text-right text-text-muted">{shiftCell(r.evening)}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.total.toFixed(1)} L</td>
                <td className="px-3 py-2 text-right">
                  {!r.complete && (
                    <Link href={`?date=${date}&cowId=${r.cowId}#individual-entry`} className="inline-block text-xs rounded-full px-3 py-1 bg-primary text-white font-semibold hover:bg-primary-dark">
                      + Add
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {worklist.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-text-muted">No active milking/dry animals.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div id="individual-entry" className="scroll-mt-4">
        <EntryTabs
          individual={<MilkingForm key={params.cowId ?? "none"} cows={cows} preselectedCowId={params.cowId} defaultDate={date} />}
          group={<GroupMilkingForm date={date} />}
        />
      </div>
    </div>
  );
}
