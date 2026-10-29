import Link from "next/link";
import { getMonthlyPnl, type MonthlyPnl } from "@/lib/reports/pnl";
import { formatRs } from "@/lib/format";
import { compare } from "@/lib/compare";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import { inSelection, parsePnlSelection, priorSelection, selectionLabel, selectionQuery, ytdMonth, type PnlSelection } from "@/lib/reports/pnlPeriod";
import { operatingTotals } from "@/lib/reports/pnlOperating";
import { isFeedCategory } from "@/lib/accounting/cashClass";
import TrendStat from "@/components/TrendStat";
import StatCard from "@/components/StatCard";

const R = "px-3 py-2 text-right";
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Pill({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs ${active ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-primary-light"}`}
    >
      {children}
    </Link>
  );
}

const sum = (months: MonthlyPnl[], f: (m: MonthlyPnl) => number) => months.reduce((n, m) => n + f(m), 0);
const totals = (months: MonthlyPnl[]) => ({
  revenue: sum(months, (m) => m.revenue),
  expense: sum(months, (m) => m.expense),
  net: sum(months, (m) => m.net),
  milkNet: sum(months, (m) => m.milkNet),
});

function addUp(months: MonthlyPnl[], pick: (m: MonthlyPnl) => Record<string, number>) {
  const out: Record<string, number> = {};
  for (const m of months) for (const [k, v] of Object.entries(pick(m))) out[k] = (out[k] ?? 0) + v;
  return out;
}

function Breakdown({ title, months }: { title: string; months: MonthlyPnl[] }) {
  const revenue = addUp(months, (m) => m.revenueByCategory);
  const cost = addUp(months, (m) => m.expenseByCategory);
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="font-medium mb-2">{title}</div>
      <div className="text-xs uppercase text-neutral-500 mb-1">Revenue</div>
      <ul className="text-sm mb-2">
        {Object.entries(revenue).map(([cat, amt]) => (
          <li key={cat} className="flex justify-between"><span>{cat}</span><span>{formatRs(amt)}</span></li>
        ))}
      </ul>
      <div className="text-xs uppercase text-neutral-500 mb-1">Cost</div>
      <ul className="text-sm">
        {Object.entries(cost).map(([cat, amt]) => (
          <li key={cat} className="flex justify-between"><span>{cat}</span><span>{formatRs(amt)}</span></li>
        ))}
      </ul>
    </div>
  );
}

export default async function PnlPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; range?: string }> }) {
  const params = await searchParams;
  const today = farmDateKey();
  const thisYear = Number(today.slice(0, 4));
  const sel = parsePnlSelection(params, today);

  const monthly = await getMonthlyPnl();
  const shown = monthly.filter((m) => inSelection(sel, m.month, today));
  const prior = priorSelection(sel, today);
  const priorMonths = prior ? monthly.filter((m) => inSelection(prior.selection, m.month, today)) : [];

  const years = [...new Set([...monthly.map((m) => Number(m.month.slice(0, 4))), thisYear])].sort();
  const haveData = new Set(monthly.map((m) => m.month));
  const t = totals(shown);
  const p = totals(priorMonths);
  const review = shown.reduce((n, m) => n + Math.abs(m.byClass.REVIEW), 0);
  const label = selectionLabel(sel, today);
  const year = sel.year;
  const link = (s: PnlSelection) => selectionQuery(s);

  const op = operatingTotals(shown);
  const opBefore = operatingTotals(priorMonths);
  const opCards: { label: string; value: number; before: number; invert?: boolean }[] = [
    { label: "Operating revenue", value: op.revenue, before: opBefore.revenue },
    { label: "Feed cost", value: op.feedCost, before: opBefore.feedCost, invert: true },
    { label: "OPEX (salaries & other)", value: op.opex, before: opBefore.opex, invert: true },
    { label: "Total cost", value: op.cost, before: opBefore.cost, invert: true },
    { label: "Operating profit", value: op.net, before: opBefore.net },
  ];
  const cards: { label: string; value: number; before: number; invert?: boolean }[] = [
    { label: "Revenue", value: t.revenue, before: p.revenue },
    { label: "Feed cost", value: op.feedCost, before: opBefore.feedCost, invert: true },
    { label: "OPEX (salaries & other)", value: op.opex, before: opBefore.opex, invert: true },
    { label: "Total cost", value: t.expense, before: p.expense, invert: true },
    { label: "Net profit", value: t.net, before: p.net },
    { label: "Milk only", value: t.milkNet, before: p.milkNet },
  ];
  // which categories sit in feed cost and which in OPEX, for the period
  const costLines = (feed: boolean) =>
    Object.entries(addUp(shown, (m) => m.expenseByCategory))
      .filter(([cat]) => isFeedCategory(cat) === feed)
      .sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">P&L Statement</h1>
        <p className="text-sm text-neutral-500">Cash basis: money counts when it is received or paid.</p>
      </div>

      <p className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-neutral-600">
        <b>Revenue</b> = milk sales + animal and calf sales + other income. <b>Cost</b> = what it cost to run the farm. Capital spending,
        money put in by the partners and money sent to them move cash but are <b>not</b> profit or loss, so they are shown separately in the second table.
        Both the petty cash book and the Meezan bank account are included, so Engro milk receipts paid by bank are counted. Bank-to-petty-cash transfers are not income or cost.
      </p>

      {/* Year, then whole year / year to date / one month */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className="hidden md:inline text-xs font-semibold text-text-muted w-12 shrink-0">YEAR</span>
          <Pill to={link({ range: "all", year: null, month: null })} active={sel.range === "all"}>All years</Pill>
          {years.map((y) => (
            <Pill key={y} to={link({ range: "whole", year: y, month: null })} active={year === y}>{y}</Pill>
          ))}
        </div>
        {year !== null && (
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <span className="hidden md:inline text-xs font-semibold text-text-muted w-12 shrink-0">WITHIN</span>
            <Pill to={link({ range: "whole", year, month: null })} active={sel.range === "whole"}>Whole year</Pill>
            <Pill to={link({ range: "ytd", year, month: null })} active={sel.range === "ytd"}>Year to date (Jan–{MONTH_SHORT[ytdMonth(today) - 1]})</Pill>
            {MONTH_SHORT.map((m, i) => (
              <Pill key={m} to={link({ range: "month", year, month: i + 1 })} active={sel.range === "month" && sel.month === i + 1}>
                <span className={haveData.has(`${year}-${String(i + 1).padStart(2, "0")}`) ? "" : "opacity-40"}>{m}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {/* Operating P&L: animal and calf sales left out of revenue, every operating cost kept */}
      <section className="flex flex-col gap-4 rounded-xl border-2 border-green-200 bg-green-50/40 p-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Operating P&amp;L · excluding animal &amp; calf sales</h2>
          <p className="text-sm text-neutral-600">
            {label}. Revenue is milk sales plus other income only. All operating costs are counted. Animal and calf sales
            ({formatRs(op.animalSalesExcluded)} in this period) are left out, so this shows what running the farm earns.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {opCards.map((c) =>
            prior && priorMonths.length > 0 ? (
              <TrendStat key={c.label} label={c.label} value={formatRs(c.value)} comparison={compare(c.value, c.before)} invertTone={c.invert} />
            ) : (
              <StatCard key={c.label} label={c.label} value={formatRs(c.value)} tone={c.invert ? undefined : c.value >= 0 ? "positive" : "negative"} />
            )
          )}
          <StatCard label="Operating margin" value={op.marginPct === null ? "—" : `${op.marginPct.toFixed(1)}%`} tone={op.marginPct === null ? undefined : op.marginPct >= 0 ? "positive" : "negative"} />
        </div>
        {prior && <p className="text-xs text-neutral-500 -mt-2">{priorMonths.length > 0 ? `Compared with ${prior.label}.` : `No records for ${prior.label} to compare with.`}</p>}
        <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-3 py-2">Month</th>
                <th className="text-right px-3 py-2">Milk sales</th>
                <th className="text-right px-3 py-2">Other income</th>
                <th className="text-right px-3 py-2">Operating revenue</th>
                <th className="text-right px-3 py-2">Feed cost</th>
                <th className="text-right px-3 py-2">OPEX</th>
                <th className="text-right px-3 py-2">Total cost</th>
                <th className="text-right px-3 py-2">Operating profit</th>
                <th className="text-right px-3 py-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const o = operatingTotals([m]);
                return (
                  <tr key={m.month} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{m.month}</td>
                    <td className={R}>{formatRs(o.milkSales)}</td>
                    <td className={R}>{formatRs(o.otherIncome)}</td>
                    <td className={`${R} font-medium`}>{formatRs(o.revenue)}</td>
                    <td className={R}>{formatRs(o.feedCost)}</td>
                    <td className={R}>{formatRs(o.opex)}</td>
                    <td className={`${R} font-medium`}>{formatRs(o.cost)}</td>
                    <td className={`${R} font-medium ${o.net >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(o.net)}</td>
                    <td className={`${R} text-neutral-500`}>{o.marginPct === null ? "—" : `${o.marginPct.toFixed(1)}%`}</td>
                  </tr>
                );
              })}
              {shown.length > 0 && (
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className={R}>{formatRs(op.milkSales)}</td>
                  <td className={R}>{formatRs(op.otherIncome)}</td>
                  <td className={R}>{formatRs(op.revenue)}</td>
                  <td className={R}>{formatRs(op.feedCost)}</td>
                  <td className={R}>{formatRs(op.opex)}</td>
                  <td className={R}>{formatRs(op.cost)}</td>
                  <td className={`${R} ${op.net >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(op.net)}</td>
                  <td className={`${R} text-neutral-500`}>{op.marginPct === null ? "—" : `${op.marginPct.toFixed(1)}%`}</td>
                </tr>
              )}
              {shown.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {([
            { title: "Feed cost", total: op.feedCost, lines: costLines(true), note: "All feed bought: Opex Feed and Feed supliment." },
            { title: "OPEX", total: op.opex, lines: costLines(false), note: "All salaries and advances, and every other expense paid, such as fuel, medical, A.I. and vaccination." },
          ] as const).map((g) => (
            <div key={g.title} className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-semibold text-neutral-900">{g.title}</div>
                <div className="font-semibold text-neutral-900">{formatRs(g.total)}</div>
              </div>
              <p className="text-xs text-neutral-500 mb-2">{g.note}</p>
              <ul className="text-sm">
                {g.lines.map(([cat, amt]) => (
                  <li key={cat} className="flex justify-between gap-3 border-t border-neutral-100 py-1">
                    <span className="truncate">{cat}</span>
                    <span className="whitespace-nowrap">{formatRs(amt)} <span className="text-xs text-neutral-400">{g.total ? `${Math.round((amt / g.total) * 100)}%` : ""}</span></span>
                  </li>
                ))}
                {g.lines.length === 0 && <li className="text-neutral-400 py-1">Nothing in this period.</li>}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-600">
          Operating profit {formatRs(op.net)} + animal &amp; calf sales {formatRs(op.animalSalesExcluded)} = net profit {formatRs(t.net)} in the full P&amp;L below.
          Capital spending and partner money are not costs in either view.
        </p>
      </section>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Full P&amp;L · including animal &amp; calf sales</h2>
        <p className="text-sm text-neutral-500 mb-2">{label}</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {cards.map((c) =>
            prior && priorMonths.length > 0 ? (
              <TrendStat key={c.label} label={c.label} value={formatRs(c.value)} comparison={compare(c.value, c.before)} invertTone={c.invert} />
            ) : (
              <StatCard key={c.label} label={c.label} value={formatRs(c.value)} tone={c.label === "Cost" ? undefined : c.value >= 0 ? "positive" : "negative"} />
            )
          )}
        </div>
        {prior && (
          <p className="text-xs text-neutral-500 mt-2">
            {priorMonths.length > 0 ? `Compared with ${prior.label}.` : `No records for ${prior.label} to compare with.`}
          </p>
        )}
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Milk sales</th>
              <th className="text-right px-3 py-2">Animal &amp; calf sales</th>
              <th className="text-right px-3 py-2">Other income</th>
              <th className="text-right px-3 py-2">Revenue</th>
              <th className="text-right px-3 py-2">Feed cost</th>
              <th className="text-right px-3 py-2">OPEX</th>
              <th className="text-right px-3 py-2">Total cost</th>
              <th className="text-right px-3 py-2">Net profit</th>
              <th className="text-right px-3 py-2">Milk only</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const [y, mo] = m.month.split("-").map(Number);
              return (
                <tr key={m.month} className="border-t border-neutral-100">
                  <td className="px-3 py-2"><Link href={link({ range: "month", year: y, month: mo })} className="link-btn">{m.month}</Link></td>
                  <td className={R}>{formatRs(m.byClass.MILK_SALES)}</td>
                  <td className={R}>{formatRs(m.byClass.LIVESTOCK_SALES)}</td>
                  <td className={R}>{formatRs(m.byClass.OTHER_INCOME)}</td>
                  <td className={`${R} font-medium`}>{formatRs(m.revenue)}</td>
                  <td className={R}>{formatRs(operatingTotals([m]).feedCost)}</td>
                  <td className={R}>{formatRs(operatingTotals([m]).opex)}</td>
                  <td className={R}>{formatRs(m.expense)}</td>
                  <td className={`${R} font-medium ${m.net >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(m.net)}</td>
                  <td className={`${R} ${m.milkNet >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(m.milkNet)}</td>
                </tr>
              );
            })}
            {shown.length > 0 && (
              <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className={R}>{formatRs(sum(shown, (m) => m.byClass.MILK_SALES))}</td>
                <td className={R}>{formatRs(sum(shown, (m) => m.byClass.LIVESTOCK_SALES))}</td>
                <td className={R}>{formatRs(sum(shown, (m) => m.byClass.OTHER_INCOME))}</td>
                <td className={R}>{formatRs(t.revenue)}</td>
                <td className={R}>{formatRs(op.feedCost)}</td>
                <td className={R}>{formatRs(op.opex)}</td>
                <td className={R}>{formatRs(t.expense)}</td>
                <td className={R}>{formatRs(t.net)}</td>
                <td className={R}>{formatRs(t.milkNet)}</td>
              </tr>
            )}
            {shown.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Cash that is not profit or loss</h2>
        <p className="text-sm text-neutral-500">Money that moved but does not belong in the profit above.</p>
      </div>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Capital spending</th>
              <th className="text-right px-3 py-2">From partners</th>
              <th className="text-right px-3 py-2">To partners</th>
              <th className="text-right px-3 py-2">Between books</th>
              <th className="text-right px-3 py-2">Needs review</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.month} className="border-t border-neutral-100">
                <td className="px-3 py-2">{m.month}</td>
                <td className={R}>{formatRs(m.byClass.CAPEX)}</td>
                <td className={R}>{formatRs(m.byClass.PARTNER_IN)}</td>
                <td className={R}>{formatRs(m.byClass.PARTNER_OUT)}</td>
                <td className={`${R} text-neutral-500`}>{formatRs(m.byClass.TRANSFER)}</td>
                <td className={`${R} ${m.byClass.REVIEW !== 0 ? "text-amber-700" : "text-neutral-400"}`}>{m.byClass.REVIEW !== 0 ? formatRs(m.byClass.REVIEW) : "—"}</td>
              </tr>
            ))}
            {shown.length > 1 && (
              <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className={R}>{formatRs(sum(shown, (m) => m.byClass.CAPEX))}</td>
                <td className={R}>{formatRs(sum(shown, (m) => m.byClass.PARTNER_IN))}</td>
                <td className={R}>{formatRs(sum(shown, (m) => m.byClass.PARTNER_OUT))}</td>
                <td className={R}>{formatRs(sum(shown, (m) => m.byClass.TRANSFER))}</td>
                <td className={R}>{review > 0 ? formatRs(sum(shown, (m) => m.byClass.REVIEW)) : "—"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {review > 0 && (
        <p className="text-xs text-amber-700">Entries marked &quot;Needs review&quot; are not in the profit yet. An Admin can set their class on the Cash Register (edit the entry).</p>
      )}

      <h2 className="text-lg font-semibold text-neutral-900">Category breakdown</h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.length > 1 && <Breakdown title={`Total · ${label}`} months={shown} />}
        {shown.map((m) => (
          <Breakdown key={m.month} title={m.month} months={[m]} />
        ))}
      </div>
    </div>
  );
}
