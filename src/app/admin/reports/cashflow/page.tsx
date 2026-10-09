import Link from "next/link";
import { getMonthlyCashFlow } from "@/lib/reports/pnl";
import { getCashFlowDetail, type CategoryGroup } from "@/lib/reports/cashFlowDetail";
import { formatRs } from "@/lib/format";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import StatCard from "@/components/StatCard";
import CostChart from "./CostChart";

const R = "px-3 py-2 text-right";
const tone = (n: number) => (n >= 0 ? "text-green-700" : "text-red-600");
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = MONTH_LONG.map((m) => m.slice(0, 3));

function href(year: number | null, month: number | null) {
  if (year === null) return "?year=all";
  return month === null ? `?year=${year}` : `?year=${year}&month=${month}`;
}

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

function Breakdown({ title, subtitle, groups, total, accent }: { title: string; subtitle: string; groups: CategoryGroup[]; total: number; accent: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-900">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
        <div className="font-semibold text-neutral-900 whitespace-nowrap">{formatRs(total)}</div>
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-400">Nothing recorded for this period.</p>
      ) : (
        <div>
          {groups.map((g) => (
            <div key={g.cls} className="border-b border-neutral-100 last:border-b-0">
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-neutral-50 text-sm">
                <span className="font-medium text-neutral-800">{g.label} <span className="text-xs font-normal text-neutral-400">· {g.count} entr{g.count === 1 ? "y" : "ies"}</span></span>
                <span className="font-medium text-neutral-800">{formatRs(g.total)}</span>
              </div>
              <ul>
                {g.lines.map((l) => (
                  <li key={l.category} className="px-4 py-1.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-700 truncate">{l.category}</span>
                      <span className="text-neutral-900 whitespace-nowrap">{formatRs(l.amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(2, Math.min(100, (l.amount / (g.lines[0].amount || 1)) * 100))}%` }} />
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{total ? Math.round((l.amount / total) * 100) : 0}% of the total · {l.count} entr{l.count === 1 ? "y" : "ies"}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const params = await searchParams;
  const thisYear = Number(farmDateKey().slice(0, 4));
  const year = params.year === "all" ? null : /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : thisYear;
  const monthNum = Number(params.month);
  const month = year !== null && Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;

  const [monthly, detail] = await Promise.all([getMonthlyCashFlow(), getCashFlowDetail({ year, month })]);
  const years = detail.years.includes(thisYear) ? detail.years : [...detail.years, thisYear].sort();
  const shownMonths = year === null ? monthly : monthly.filter((m) => m.month.startsWith(`${year}-`));
  const haveData = new Set(monthly.map((m) => m.month));

  const periodLabel = year === null ? "All years" : month === null ? String(year) : `${MONTH_LONG[month - 1]} ${year}`;
  const registerHref = detail.from && detail.to ? `/admin/reports/cash-register?period=custom&from=${detail.from}&to=${detail.to}` : "/admin/reports/cash-register";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Cash Flow Statement</h1>
        <p className="text-sm text-neutral-500">
          Every rupee that moved in the Cash Register, split by what it was for: <b>running the farm</b> (milk and animal sales, minus costs),{" "}
          <b>capital spending</b> (assets, repairs that last), and <b>partners</b> (money put in or taken out), plus <b>between books</b> (bank to petty cash, which cancels out).
        </p>
      </div>

      {/* Year and month */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className="hidden md:inline text-xs font-semibold text-text-muted w-12 shrink-0">YEAR</span>
          <Pill to={href(null, null)} active={year === null}>All years</Pill>
          {years.map((y) => (
            <Pill key={y} to={href(y, null)} active={year === y}>{y}</Pill>
          ))}
        </div>
        {year !== null && (
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <span className="hidden md:inline text-xs font-semibold text-text-muted w-12 shrink-0">MONTH</span>
            <Pill to={href(year, null)} active={month === null}>Whole year</Pill>
            {MONTH_SHORT.map((label, i) => (
              <Pill key={label} to={href(year, i + 1)} active={month === i + 1}>
                <span className={haveData.has(`${year}-${String(i + 1).padStart(2, "0")}`) ? "" : "opacity-40"}>{label}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 className="text-lg font-semibold text-neutral-900">{periodLabel}</h2>
          <Link href={registerHref} className="link-btn text-sm">View the {detail.entries} entries in the Cash Register</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Cash In" value={formatRs(detail.cashIn)} tone="positive" />
          <StatCard label="Cash Out" value={formatRs(detail.cashOut)} tone="negative" />
          <StatCard label="Net cash flow" value={formatRs(detail.net)} tone={detail.net >= 0 ? "positive" : "negative"} />
          <StatCard label="Running the farm" value={formatRs(detail.operating)} tone={detail.operating >= 0 ? "positive" : "negative"} />
          <StatCard label={year === null ? "Cash position" : "Closing cash"} value={formatRs(detail.closingCash)} tone={detail.closingCash >= 0 ? "positive" : "negative"} />
        </div>
        {year !== null && (
          <p className="text-xs text-neutral-500 mt-2">
            Opening cash {formatRs(detail.openingCash)} · capital spending {formatRs(detail.investing)} · partners {formatRs(detail.financing)} · between books {formatRs(detail.transfers)}
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <h2 className="font-semibold text-neutral-900">Money paid out {detail.chartGrain === "day" ? "each day" : "each month"} · {periodLabel}</h2>
            <p className="text-xs text-neutral-500">Running costs, capital spending and money paid to partners. Moves between the farm&apos;s own books are left out.</p>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className="text-xs text-neutral-500">Total paid out</div>
            <div className="font-semibold text-neutral-900">{formatRs(detail.totalCosts)}</div>
          </div>
        </div>
        {detail.costChart.length === 0 ? <p className="py-10 text-center text-sm text-neutral-400">No payments in this period.</p> : <CostChart data={detail.costChart} />}
      </div>

      {/* Detail for the chosen period, by category */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Breakdown title="Where the money came from" subtitle="Cash In by type and category" groups={detail.inflows} total={detail.inflows.reduce((n, g) => n + g.total, 0)} accent="bg-green-600" />
        <Breakdown title="Where the money went" subtitle="Cash Out by type and category" groups={detail.outflows} total={detail.totalCosts} accent="bg-amber-600" />
      </div>

      {/* Statement */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-2">Month by month{year !== null ? ` · ${year}` : ""}</h2>
        <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-3 py-2">Month</th>
                <th className="text-right px-3 py-2">Cash In</th>
                <th className="text-right px-3 py-2">Cash Out</th>
                <th className="text-right px-3 py-2">Running the farm</th>
                <th className="text-right px-3 py-2">Capital spending</th>
                <th className="text-right px-3 py-2">Partners</th>
                <th className="text-right px-3 py-2">Between books</th>
                <th className="text-right px-3 py-2">Net Cash Flow</th>
                <th className="text-right px-3 py-2">Cash Position</th>
              </tr>
            </thead>
            <tbody>
              {shownMonths.map((m) => {
                const [y, mo] = m.month.split("-").map(Number);
                const active = year !== null && month === mo && year === y;
                return (
                  <tr key={m.month} className={`border-t border-neutral-100 ${active ? "bg-green-50" : ""}`}>
                    <td className="px-3 py-2">
                      <Link href={href(y, mo)} className="link-btn">{m.month}</Link>
                    </td>
                    <td className={`${R} text-green-700`}>{formatRs(m.cashIn)}</td>
                    <td className={`${R} text-red-600`}>{formatRs(m.cashOut)}</td>
                    <td className={`${R} ${tone(m.operating)}`}>{formatRs(m.operating)}</td>
                    <td className={`${R} ${tone(m.investing)}`}>{formatRs(m.investing)}</td>
                    <td className={`${R} ${tone(m.financing)}`}>{formatRs(m.financing)}</td>
                    <td className={`${R} text-neutral-500`}>{formatRs(m.transfers)}</td>
                    <td className={`${R} font-medium ${tone(m.netCashFlow)}`}>{formatRs(m.netCashFlow)}</td>
                    <td className={`${R} font-medium ${tone(m.cumulativeCash)}`}>{formatRs(m.cumulativeCash)}</td>
                  </tr>
                );
              })}
              {shownMonths.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded for this year.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500 mt-2">Click a month to see its detail. The first month includes the opening balance carried from the CashBook. Entries still marked &quot;Needs review&quot; are counted in the net cash flow but not in any of the three groups.</p>
      </div>
    </div>
  );
}
