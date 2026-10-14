import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLiveUser } from "@/lib/access";
import { formatRs } from "@/lib/format";
import { periodRange } from "@/lib/reports/herd";
import { resolvePeriod } from "@/lib/period";
import { getAnimalPnl, type Line } from "@/lib/reports/animalPnl";
import PeriodBar from "@/components/PeriodBar";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["MILKING", "DRY", "INSEMINATED", "HEIFER", "CALF", "SOLD", "DEAD"];
const fmtL = (n: number) => `${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })} L`;
const tone = (n: number) => (n >= 0 ? "text-green-700" : "text-red-600");

function Row({ line, negative }: { line: Line; negative?: boolean }) {
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-4 py-2">
        {line.label}
        {line.note && <div className="text-xs text-neutral-400">{line.note}</div>}
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap">{negative && line.amount ? `− ${formatRs(line.amount)}` : formatRs(line.amount)}</td>
    </tr>
  );
}

export default async function AnimalPnlPage({ searchParams }: { searchParams: Promise<{ cow?: string; period?: string; from?: string; to?: string }> }) {
  const user = await getLiveUser();
  if (user?.role !== "ADMIN") redirect("/admin");

  const params = await searchParams;
  // "life" is this page's own choice: from the animal's first record to today.
  const isLife = params.period === "life";
  const { period, from, to } = await resolvePeriod(isLife ? { ...params, period: undefined } : params, "year");
  let range = periodRange(period, new Date(), from, to);
  if (isLife) {
    const today = periodRange("day", new Date());
    const [c, firstMilk, firstCash] = params.cow
      ? await Promise.all([
          prisma.cow.findUnique({ where: { id: params.cow }, select: { dateOfBirth: true, purchaseDate: true } }),
          prisma.milkingRecord.aggregate({ where: { cowId: params.cow }, _min: { date: true } }),
          prisma.cashTransaction.aggregate({ _min: { date: true } }),
        ])
      : [null, null, null];
    const dates = [c?.dateOfBirth, c?.purchaseDate, firstMilk?._min.date].filter((d): d is Date => !!d);
    const start = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : (firstCash?._min.date ?? new Date("2020-01-01T00:00:00Z"));
    range = { start, end: today.end };
  }

  const cows = await prisma.cow.findMany({ select: { id: true, tag: true, status: true, breed: true } });
  cows.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  const result = params.cow ? await getAnimalPnl(params.cow, range.start, range.end) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Animal P&amp;L</h1>
        <p className="text-sm text-neutral-500">What one animal earned and cost over a period: its milk, its calves, its own costs and its share of the farm&apos;s common costs. Visible to the Admin only.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-3" method="get">
        <input type="hidden" name="period" value={isLife ? "life" : period} />
        {period === "custom" && from && <input type="hidden" name="from" value={from} />}
        {period === "custom" && to && <input type="hidden" name="to" value={to} />}
        <div className="flex flex-col gap-1">
          <label htmlFor="cow" className="text-xs font-semibold text-text-muted">ANIMAL</label>
          <select id="cow" name="cow" defaultValue={params.cow ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-sm min-w-[260px]">
            <option value="">Choose an animal…</option>
            {cows.map((c) => (
              <option key={c.id} value={c.id}>{c.tag} · {c.status.charAt(0) + c.status.slice(1).toLowerCase()}{c.breed ? ` · ${c.breed}` : ""}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-800">Show P&amp;L</button>
      </form>
      <PeriodBar
        period={isLife ? "life" : period}
        from={from}
        to={to}
        extraParams={params.cow ? { cow: params.cow } : undefined}
        labels={{ year: "Year to date" }}
        extraOptions={[{ key: "life", label: "Whole life at the farm" }]}
      />

      {!params.cow && <p className="text-sm text-neutral-500">Choose an animal above to see its profit and loss for the selected period.</p>}
      {params.cow && !result && <p className="text-sm text-red-600">That animal was not found.</p>}

      {result && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Animal {result.cow.tag}</h2>
              <p className="text-sm text-neutral-500">
                {[result.cow.breed, result.cow.gender.charAt(0) + result.cow.gender.slice(1).toLowerCase(), result.cow.status.charAt(0) + result.cow.status.slice(1).toLowerCase(), result.cow.dob ? `born ${result.cow.dob}` : null, result.cow.lactation ? `lactation ${result.cow.lactation}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-sm text-neutral-500 text-right">
              {isLife ? "Whole life at the farm · " : period === "year" ? "Year to date · " : ""}{result.period.from} to {result.period.to} · {result.daysInHerd} days in the herd
              <div><Link href={`/admin/cows/${result.cow.id}`} className="link-btn">Open the animal&apos;s profile</Link></div>
            </div>
          </div>

          {result.warnings.length > 0 && (
            <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 list-disc list-inside">
              {result.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}

          {/* Production summary */}
          <section>
            <h3 className="font-semibold text-neutral-900 mb-2">What this animal produced</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Milk produced" value={fmtL(result.milk.litres)} />
              <StatCard label="Days milked" value={String(result.milk.milkingDays)} />
              <StatCard label="Average per milking day" value={`${result.milk.avgPerMilkingDay.toFixed(1)} L`} tone={result.milk.herdAvgPerMilkingDay && result.milk.avgPerMilkingDay >= result.milk.herdAvgPerMilkingDay ? "positive" : "negative"} />
              <StatCard label="Milk value" value={formatRs(result.milk.value)} />
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Herd average per milking day: {result.milk.herdAvgPerMilkingDay.toFixed(1)} L
              {result.milk.bestDay ? ` · best day ${result.milk.bestDay.litres.toFixed(1)} L on ${result.milk.bestDay.date}` : ""}
              {result.milk.rate ? ` · valued at Rs ${result.milk.rate.toFixed(0)} per litre, the farm's average selling price in this period` : ""}
            </p>
          </section>

          {/* Calves */}
          <section>
            <h3 className="font-semibold text-neutral-900 mb-2">Calves (all time)</h3>
            {result.calves.total === 0 ? (
              <p className="text-sm text-neutral-500">No calves recorded for this animal.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard label="Calves born" value={String(result.calves.total)} />
                  <StatCard label="Girls / Boys" value={`${result.calves.girls} / ${result.calves.boys}`} />
                  <StatCard label="Still with us" value={String(result.calves.withUs)} tone="positive" />
                  <StatCard label="Sold" value={String(result.calves.sold)} />
                  <StatCard label="Died or stillborn" value={String(result.calves.died)} tone={result.calves.died ? "negative" : undefined} />
                </div>
                {result.calves.unlinked > 0 && <p className="text-xs text-neutral-500 mt-2">{result.calves.unlinked} calf record{result.calves.unlinked === 1 ? " is" : "s are"} not linked to an animal profile, so where {result.calves.unlinked === 1 ? "it is" : "they are"} now is not known.</p>}
                <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg mt-3">
                  <table className="min-w-full text-sm">
                    <thead className="bg-neutral-100 text-left">
                      <tr>
                        <th className="px-4 py-2">Calf</th><th className="px-4 py-2">Born</th><th className="px-4 py-2">Sex</th><th className="px-4 py-2">Where it is</th><th className="px-4 py-2 text-right">Sold for</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.calves.rows.map((c, i) => (
                        <tr key={i} className="border-t border-neutral-100">
                          <td className="px-4 py-2">{c.tag ?? "no tag"}{c.bornInPeriod ? <span className="ml-2 text-xs rounded-full bg-green-50 text-green-700 px-2 py-0.5">born this period</span> : null}</td>
                          <td className="px-4 py-2">{c.born}</td>
                          <td className="px-4 py-2">{c.sex === "FEMALE" ? "Girl" : c.sex === "MALE" ? "Boy" : "Not recorded"}</td>
                          <td className="px-4 py-2">{c.where === "WITH US" ? "With us" : c.where === "SOLD" ? "Sold" : c.where === "DEAD" ? "Died" : "Not tracked as an animal"}</td>
                          <td className="px-4 py-2 text-right">{c.saleAmount ? `about ${formatRs(c.saleAmount)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* P&L */}
          <section>
            <h3 className="font-semibold text-neutral-900 mb-2">Profit and loss for the period</h3>
            <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
              <table className="min-w-full text-sm">
                <tbody>
                  <tr className="bg-neutral-100"><td className="px-4 py-2 font-semibold" colSpan={2}>Income</td></tr>
                  {result.income.map((l) => <Row key={l.label} line={l} />)}
                  <tr className="border-t border-neutral-300 font-semibold"><td className="px-4 py-2">Total income</td><td className="px-4 py-2 text-right">{formatRs(result.totals.income)}</td></tr>

                  <tr className="bg-neutral-100"><td className="px-4 py-2 font-semibold" colSpan={2}>Costs charged straight to this animal</td></tr>
                  {result.directCosts.map((l) => <Row key={l.label} line={l} negative />)}
                  <tr className="border-t border-neutral-300 font-medium"><td className="px-4 py-2">Direct costs</td><td className="px-4 py-2 text-right">− {formatRs(result.totals.direct)}</td></tr>

                  <tr className="bg-neutral-100"><td className="px-4 py-2 font-semibold" colSpan={2}>Share of the farm&apos;s common costs ({(result.allocatedCosts[0]?.sharePct ?? 0).toFixed(1)}% of the herd)</td></tr>
                  {result.allocatedCosts.map((l) => (
                    <Row key={l.label} line={{ label: l.label, amount: l.amount, note: `Farm total in this period ${formatRs(l.pool)}` }} negative />
                  ))}
                  <tr className="border-t border-neutral-300 font-medium"><td className="px-4 py-2">Shared costs</td><td className="px-4 py-2 text-right">− {formatRs(result.totals.allocated)}</td></tr>

                  <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                    <td className="px-4 py-3">Total cost</td><td className="px-4 py-3 text-right">− {formatRs(result.totals.cost)}</td>
                  </tr>
                  <tr className="bg-neutral-50 font-semibold text-base">
                    <td className="px-4 py-3">Net result for this animal</td>
                    <td className={`px-4 py-3 text-right ${tone(result.totals.net)}`}>{formatRs(result.totals.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              <StatCard label="Net per day in the herd" value={result.totals.netPerDay === null ? "—" : formatRs(result.totals.netPerDay)} tone={result.totals.netPerDay !== null && result.totals.netPerDay >= 0 ? "positive" : "negative"} />
              <StatCard label="Cost per litre of milk" value={result.totals.costPerLitre === null ? "—" : `Rs ${result.totals.costPerLitre.toFixed(0)}`} />
              <StatCard label="Margin per litre" value={result.totals.marginPerLitre === null ? "—" : `Rs ${result.totals.marginPerLitre.toFixed(0)}`} tone={result.totals.marginPerLitre !== null && result.totals.marginPerLitre >= 0 ? "positive" : "negative"} />
            </div>
          </section>

          {/* Entries read from the cash book */}
          {(result.entries.cost.length > 0 || result.entries.income.length > 0 || result.entries.memo.length > 0) && (
            <section>
              <h3 className="font-semibold text-neutral-900 mb-2">Cash book entries that name this animal</h3>
              <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-100 text-left">
                    <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">What it says</th><th className="px-4 py-2 text-right">Counted</th></tr>
                  </thead>
                  <tbody>
                    {[...result.entries.income.map((e) => ({ ...e, kind: "Income" })), ...result.entries.cost.map((e) => ({ ...e, kind: "Cost" })), ...result.entries.memo.map((e) => ({ ...e, kind: "Capital (not in the P&L)" }))]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((e, i) => (
                        <tr key={i} className="border-t border-neutral-100 align-top">
                          <td className="px-4 py-2 whitespace-nowrap">{e.date}</td>
                          <td className="px-4 py-2">{e.category}<div className="text-[11px] text-neutral-400">{e.kind}</div></td>
                          <td className="px-4 py-2">{e.remark}{e.sharedWith > 1 ? <div className="text-[11px] text-amber-700">Names {e.sharedWith} animals, so the amount is split equally.</div> : null}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">{formatRs(e.amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Method */}
          <section className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-neutral-600">
            <h3 className="font-semibold text-neutral-900 mb-1">How this is worked out</h3>
            <ul className="list-disc list-inside flex flex-col gap-1">
              <li><b>Milk</b> comes from the milking records of this animal, valued at the farm&apos;s average selling price in the period (milk sales ÷ litres sold).</li>
              <li><b>Direct costs</b> are the cash book entries that name this animal&apos;s tag (semen, medicine, supplements) plus costs on its insemination, treatment and vaccination records. Where an entry names several tags it is split equally.</li>
              <li><b>Shared costs</b> (feed, salaries, medicine and running costs that name no animal) are not recorded per animal, so each animal carries a share by animal-days: a milking day counts {1}, a dry-cow or heifer day 0.6 and a calf under six months 0.3. This animal: {result.allocation.animalDays.toFixed(0)} of {result.allocation.herdAnimalDays.toFixed(0)} weighted animal-days across {result.allocation.animalsInHerd} animals.</li>
              <li>Everything is on a <b>cash basis</b>, like the farm&apos;s P&amp;L: money counts when it is paid or received. Purchases of animals are capital and are shown for information only.</li>
              <li>The farm&apos;s share-out is only as good as the records: costs typed without a tag fall into the shared pool, and an animal with no date of birth is counted as in the herd all period.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
