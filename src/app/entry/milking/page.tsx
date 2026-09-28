import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMilkingWorklist } from "@/lib/reports/milkingWorklist";
import MilkingForm from "./MilkingForm";
import GroupMilkingForm from "./GroupMilkingForm";

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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Milking Entry</h1>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
        <span className="text-xs font-semibold text-neutral-500">DAY</span>
        <Link href={dayLink(-1)} className="px-2 rounded hover:bg-neutral-100">‹</Link>
        <span className="text-sm font-medium">{date}</span>
        {date < today && <Link href={dayLink(1)} className="px-2 rounded hover:bg-neutral-100">›</Link>}
        {date !== today && <Link href="?" className="text-xs text-primary underline ml-2">Today</Link>}
      </div>

      {(worklist.missingCount > 0 || worklist.incompleteCount > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Missing: {worklist.missingCount} · Incomplete: {worklist.incompleteCount}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-neutral-200 rounded-lg p-3">
          <div className="text-xs uppercase text-neutral-500">Morning</div>
          <div className="text-xl font-semibold">{worklist.sessionTotals.morning.toFixed(1)} L</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-3">
          <div className="text-xs uppercase text-neutral-500">Afternoon</div>
          <div className="text-xl font-semibold">{worklist.sessionTotals.afternoon.toFixed(1)} L</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-3">
          <div className="text-xs uppercase text-neutral-500">Evening</div>
          <div className="text-xl font-semibold">{worklist.sessionTotals.evening.toFixed(1)} L</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-3">
          <div className="text-xs uppercase text-neutral-500">Total</div>
          <div className="text-xl font-semibold">{worklist.sessionTotals.total.toFixed(1)} L</div>
          {worklist.groupTotalLitres > 0 && (
            <div className="text-xs text-neutral-400 mt-0.5">includes {worklist.groupTotalLitres.toFixed(1)} L unattributed Herd/Group total</div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-right px-3 py-2">DIM</th>
              <th className="text-right px-3 py-2">Morning</th>
              <th className="text-right px-3 py-2">Afternoon</th>
              <th className="text-right px-3 py-2">Evening</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {worklist.rows.map((r) => (
              <tr key={r.cowId} className={`border-t border-neutral-100 ${r.recordedShifts === 0 ? "bg-red-50/40" : !r.complete ? "bg-amber-50/40" : ""}`}>
                <td className="px-3 py-2 font-medium">{r.tag}</td>
                <td className="px-3 py-2 text-right">{r.dim ?? "—"}</td>
                <td className="px-3 py-2 text-right">{shiftCell(r.morning)}</td>
                <td className="px-3 py-2 text-right">{shiftCell(r.afternoon)}</td>
                <td className="px-3 py-2 text-right">{shiftCell(r.evening)}</td>
                <td className="px-3 py-2 text-right font-medium">{r.total.toFixed(1)} L</td>
                <td className="px-3 py-2">
                  {!r.complete && (
                    <Link href={`?date=${date}&cowId=${r.cowId}#individual-entry`} className="text-xs rounded px-2 py-1 border border-primary text-primary hover:bg-primary/5">
                      + Add
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {worklist.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-400">No active milking/dry animals.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div id="individual-entry" className="grid grid-cols-1 lg:grid-cols-2 gap-4 scroll-mt-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">Individual Entry</h2>
          <MilkingForm key={params.cowId ?? "none"} cows={cows} preselectedCowId={params.cowId} defaultDate={date} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">Herd / Group Total</h2>
          <GroupMilkingForm date={date} />
        </div>
      </div>
    </div>
  );
}
