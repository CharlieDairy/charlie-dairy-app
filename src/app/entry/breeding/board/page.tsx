import Link from "next/link";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import { getBreedingSummary } from "@/lib/breeding/herdState";
import { FOLLOW_UP, NEEDS_ACTION_ORDER, type BreedingCode } from "@/lib/breeding/status";
import BoardClient, { type BoardRow, type BoardSection } from "./BoardClient";

export const dynamic = "force-dynamic";

export default async function BreedingBoardPage() {
  const { rows, counts } = await getBreedingSummary();
  const withTag = rows.flatMap((r): BoardRow[] => (r.breeding ? [{ id: r.id, tag: r.tag, breeding: r.breeding }] : []));
  const order = (code: string) => {
    const i = NEEDS_ACTION_ORDER.indexOf(code as BreedingCode);
    return i === -1 ? 99 : i;
  };
  const byAge = (a: BoardRow, b: BoardRow) => order(a.breeding.code) - order(b.breeding.code) || (b.breeding.days ?? 0) - (a.breeding.days ?? 0) || Number(a.tag) - Number(b.tag);
  const inCodes = (...codes: BreedingCode[]) => withTag.filter((r) => codes.includes(r.breeding.code as BreedingCode));

  const sections: BoardSection[] = [
    { key: "action", title: "Needs action now", hint: "Confirm results first, then heats to serve, then animals to watch for heat.", rows: withTag.filter((r) => r.breeding.needsAction).sort(byAge) },
    { key: "progress", title: "In progress", hint: `Inseminated animals are checked from day ${FOLLOW_UP.checkDueDays}. Calved animals start heat watch after the waiting period.`, rows: inCodes("INSEMINATED", "CALVED").sort((a, b) => (b.breeding.days ?? 0) - (a.breeding.days ?? 0)) },
    { key: "pregnant", title: "Pregnant", hint: "Confirmed pregnant, with the expected calving date.", rows: inCodes("PREGNANT").sort((a, b) => Number(a.tag) - Number(b.tag)) },
    { key: "young", title: "Not yet bred", hint: "Young heifers, not yet old enough to breed.", rows: inCodes("NOT_YET_BRED").sort((a, b) => Number(a.tag) - Number(b.tag)) },
  ];

  const chip = (label: string, n: number | undefined, urgent = false) => (
    <span key={label} className={`rounded-full px-3 py-1 text-xs font-semibold ${n && urgent ? "bg-red-100 text-red-800" : n ? "bg-neutral-100 text-neutral-800" : "bg-neutral-50 text-neutral-400"}`}>
      {label} {n ?? 0}
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Breeding Board</h1>
        <p className="text-sm text-neutral-500">
          Where every animal is in the breeding cycle, and what to do next. Calved, then waiting for heat, then inseminated. The pregnancy check is due on day {FOLLOW_UP.checkDueDays}
          and must be confirmed by day {FOLLOW_UP.confirmByDays}. One tap records the update; the full forms are on{" "}
          <Link className="link-btn" href="/entry/breeding/reproduction">Reproduction Entry</Link>.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {chip("Confirm overdue", counts.CHECK_OVERDUE, true)}
        {chip("Check due", counts.CHECK_DUE, true)}
        {chip("In heat", counts.IN_HEAT, true)}
        {chip("Waiting for heat", (counts.WAITING_FOR_HEAT ?? 0) + (counts.OPEN ?? 0))}
        {chip("Inseminated", counts.INSEMINATED)}
        {chip("Pregnant", (counts.PREGNANT ?? 0) + (counts.DUE_TO_CALVE ?? 0))}
        {chip("Calved", counts.CALVED)}
      </div>
      <BoardClient sections={sections} today={farmDateKey()} />
    </div>
  );
}
