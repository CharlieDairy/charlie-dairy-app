import Link from "next/link";
import { getLiveUser, hasPermission } from "@/lib/access";
import { getFarmDashboard } from "@/lib/reports/farmDashboard";
import { getFeedOverview } from "@/lib/reports/feed";
import { formatRs } from "@/lib/format";
import DailyProductionChart from "./DailyProductionChart";
import type { ReactNode } from "react";

function Ic({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconHeart = <Ic><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></Ic>;
const IconActivity = <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Ic>;
const IconArchive = <Ic><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" /><path d="M10 13h4" /></Ic>;
const IconGrid = <Ic><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></Ic>;
const IconTrend = <Ic><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ic>;
const IconDroplet = <Ic><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></Ic>;
const IconUsers = <Ic><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></Ic>;
const IconTag = <Ic><path d="M20.59 13.41L11 3.83a2 2 0 00-1.41-.58H4a2 2 0 00-2 2v5.59a2 2 0 00.58 1.41l9.58 9.58a2 2 0 002.83 0l6.59-6.59a2 2 0 000-2.83z" /><line x1="7" y1="7" x2="7.01" y2="7" /></Ic>;
const IconDollar = <Ic><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></Ic>;
const IconLayers = <Ic><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></Ic>;
const IconCalendar = <Ic><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Ic>;

const ICON_TONE: Record<string, string> = {
  teal: "bg-teal-50 text-teal-600",
  rose: "bg-rose-50 text-rose-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-emerald-50 text-emerald-600",
};

function Panel({ title, href, icon, tone = "teal", children, className = "" }: { title: string; href?: string; icon?: ReactNode; tone?: keyof typeof ICON_TONE; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ICON_TONE[tone]}`}>{icon}</span>}
          {title}
        </h2>
        {href && <Link className="text-sm text-teal-700 hover:underline" href={href}>Open →</Link>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
function Metric({ label, value, detail, tone = "slate", icon }: { label: string; value: string; detail: string; tone?: "slate" | "green" | "rose" | "amber"; icon?: ReactNode }) {
  const toneClasses: Record<string, string> = {
    slate: "border-l-teal-500 bg-white",
    green: "border-l-emerald-500 bg-emerald-50/60",
    rose: "border-l-rose-500 bg-rose-50/60",
    amber: "border-l-amber-500 bg-amber-50/60",
  };
  const chipClasses: Record<string, string> = {
    slate: "bg-teal-50 text-teal-600",
    green: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className={`rounded-2xl border border-slate-200 border-l-4 p-4 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${chipClasses[tone]}`}>{icon}</span>}
      </div>
      <p className="text-3xl font-bold text-slate-900 my-2">{value}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: ReactNode }) { return <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-slate-500">{label}</span><span className="font-semibold text-right">{value}</span></div>; }
function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const rows = Object.entries(values).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, v]) => n + v, 0);
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">{title}</h3>
      {rows.map(([name, amount]) => (
        <div key={name} className="border-b border-slate-100 py-3 flex justify-between gap-3 text-sm">
          <span>{name}</span>
          <span className="text-right font-semibold">{formatRs(amount)}<small className="block text-slate-400 font-normal">{total ? (amount / total * 100).toFixed(1) : 0}%</small></span>
        </div>
      ))}
      {!rows.length && <p className="text-sm text-slate-500">No entries in this period.</p>}
    </div>
  );
}
function ProgressBar({ pct, tone = "teal" }: { pct: number; tone?: "teal" | "rose" }) {
  const barColor = tone === "rose" ? "bg-rose-500" : "bg-teal-500";
  return <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>;
}
const HERD_COLORS: Record<string, string> = { MILKING: "bg-teal-500", DRY: "bg-sky-400", HEIFER: "bg-amber-400", CALF: "bg-rose-400" };
function HerdBar({ active }: { active: { status: string }[] }) {
  const statuses = ["MILKING", "DRY", "HEIFER", "CALF"];
  const counts = statuses.map(s => ({ status: s, count: active.filter(c => c.status === s).length }));
  const total = active.length || 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {counts.map(c => c.count > 0 && <div key={c.status} className={HERD_COLORS[c.status]} style={{ width: `${c.count / total * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {counts.map(c => <span key={c.status} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${HERD_COLORS[c.status]}`} />{c.status.charAt(0) + c.status.slice(1).toLowerCase()} {c.count}</span>)}
      </div>
    </div>
  );
}
const ALERT_TONE: Record<string, { border: string; bg: string }> = {
  rose: { border: "border-rose-200", bg: "bg-rose-50" },
  amber: { border: "border-amber-200", bg: "bg-amber-50" },
  sky: { border: "border-sky-200", bg: "bg-sky-50" },
  violet: { border: "border-violet-200", bg: "bg-violet-50" },
};

const JUMP_LINKS: [string, string][] = [
  ["Animals", "/admin/cows"], ["Milk", "/entry/milking"], ["Sales", "/admin/reports/milk-sales"],
  ["Breeding", "/admin/reports/breeding"], ["Vaccinations", "/entry/health/vaccination"], ["Feed & Inventory", "/admin/reports/feed"],
  ["Weight", "/admin/reports/weight"], ["Customers", "/admin/customers"], ["Team", "/admin/team"],
];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ day?: string; period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const user = await getLiveUser();
  const isAdmin = user?.role === "ADMIN";
  // "Operations" here bundles the same subjects the old coarse OPERATIONS
  // module used to (herd, breeding, health, milk, weight, feed) -- the
  // dashboard shows that whole summary block if the live user can view any
  // one of them, not literally every one.
  const operations =
    isAdmin || (user !== null && (["herd", "breeding", "health", "milk", "weight", "feed"] as const).some((m) => hasPermission(user, m, "VIEW")));
  const finance = isAdmin || (user !== null && hasPermission(user, "financial", "VIEW"));
  const [d, feed] = await Promise.all([getFarmDashboard(params), getFeedOverview()]);
  const sum = (v: Record<string, number>) => Object.values(v).reduce((n, a) => n + a, 0);
  const income = sum(d.income), expense = sum(d.expenses), net = income - expense;
  const sold = d.saleDay.reduce((n, s) => n + s.litres, 0);
  const salesComplete = d.saleDay.length > 0 && d.saleDay.every(s => s.litres > 0);
  const coverage = d.active.length ? Math.round(d.vaccinated / d.active.length * 100) : null;
  const overdueBreeding = d.breeding.filter(c => c.nextAiDate!.toISOString().slice(0, 10) < d.today).length;
  const breedingToday = d.breeding.filter(c => c.nextAiDate!.toISOString().slice(0, 10) === d.today).length;
  const alerts = [
    { title: "Breeding follow-up", count: overdueBreeding + breedingToday, detail: `${overdueBreeding} overdue · ${breedingToday} due today`, href: "/admin/reports/breeding", tone: "rose" as const },
    { title: "Milk records pending", count: d.dailyMilk.missing, detail: `${d.dailyMilk.recorded} animals recorded on ${d.day}`, href: "/entry/milking", tone: "amber" as const },
    { title: "No vaccination record", count: d.neverVaccinated, detail: "Recorded coverage, not proof of immunity", href: "/admin/reports/health", tone: "sky" as const },
    { title: "Calving dates to review", count: d.overdueCalvings, detail: "Past expected date; confirm outcome", href: "/admin/reports/breeding", tone: "violet" as const },
    { title: "Incomplete sale quantities", count: d.missingQuantities, detail: "Milk reconciliation remains incomplete", href: "/admin/reports/milk-sales", tone: "amber" as const },
  ].filter(a => a.count > 0);
  const periods = [["week", "This week"], ["month", "This month"], ["last-month", "Last month"], ["quarter", "Last 3 months"], ["year", "This year"], ["last-year", "Last year"]];
  const dayLink = (offset: number) => { const date = new Date(`${d.day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return `?${new URLSearchParams({ ...params, day: date.toISOString().slice(0, 10) })}`; };
  const feedValue = (f: { amount: number; count: number; missing: number }) => !f.count ? "Not recorded" : `${formatRs(f.amount)}${f.missing ? " · incomplete costs" : ""}`;
  const isToday = d.day >= d.today;
  const periodRangeLabel = `${d.range.start.toISOString().slice(0, 10)} to ${new Date(d.range.end.getTime() - 86400000).toISOString().slice(0, 10)}`;

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      <div className="rounded-2xl bg-gradient-to-br from-green-900 to-green-700 px-6 py-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-3 max-w-xl">
          {operations && (
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide ${alerts.length > 0 ? "bg-amber-400/20 text-amber-200" : "bg-emerald-400/20 text-emerald-200"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${alerts.length > 0 ? "bg-amber-300" : "bg-emerald-300"}`} />
              {alerts.length > 0 ? `${alerts.length} CHECK${alerts.length === 1 ? "" : "S"} NEED ATTENTION` : "ALL CAUGHT UP"}
            </span>
          )}
          <h1 className="text-2xl font-bold text-white">Charlie Dairy Farm</h1>
          <p className="text-sm text-green-100">Here&apos;s what&apos;s happening on the farm today.</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {operations && <Link href="/entry/milking" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">Record milk</Link>}
            {operations && <Link href="/admin/cows/add" className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">+ Animal</Link>}
            {operations && <Link href="/admin/reports/breeding" className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">Breeding</Link>}
            {finance && <Link href="/entry/cash" className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">Expense</Link>}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">{IconCalendar}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-green-200">Today · Pakistan time</p>
            <p className="text-sm font-bold text-white">{d.today}</p>
          </div>
        </div>
      </div>

      {operations && <>
        <form className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-xs text-slate-500 font-semibold">DAY</span>
          <Link href={dayLink(-1)} aria-label="Previous day" className="rounded-md px-2 py-1 hover:bg-slate-100">‹</Link>
          <label className="sr-only" htmlFor="dashboard-day">Milk book date</label>
          <input id="dashboard-day" className="rounded-lg border border-teal-200 p-2 text-sm" type="date" name="day" defaultValue={d.day} max={d.today} />
          <input type="hidden" name="period" value={params.period ?? "month"} />
          {params.from && <input type="hidden" name="from" value={params.from} />}
          {params.to && <input type="hidden" name="to" value={params.to} />}
          <button className="rounded-lg border px-3 py-2 text-sm">Apply day</button>
          <Link href={dayLink(1)} aria-label="Next day" className={`rounded-md px-2 py-1 ${isToday ? "pointer-events-none text-slate-300" : "hover:bg-slate-100"}`}>›</Link>
          <p className="text-xs text-slate-500 ml-auto">Today&apos;s milk book · 7-day average: {d.average7 === null ? "Not available" : `${d.average7.toFixed(1)} L (${d.averageDays}/7 days recorded)`}</p>
        </form>
      </>}

      {(finance || operations) && (
        <form className="flex flex-wrap gap-2 items-center rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-xs font-semibold text-slate-500">PERIOD</span>
          {periods.map(([key, label]) => (
            <Link key={key} href={`?day=${d.day}&period=${key}`} className={`rounded-full border px-3 py-2 text-xs ${(params.period ?? "month") === key ? "bg-teal-600 text-white border-teal-600" : "border-slate-200"}`}>{label}</Link>
          ))}
          <input type="hidden" name="day" value={d.day} />
          <input type="hidden" name="period" value="custom" />
          <label className="sr-only" htmlFor="from-date">Period from</label>
          <input className="border rounded-lg p-2 text-xs" id="from-date" type="date" name="from" required defaultValue={params.from} />
          <label className="sr-only" htmlFor="to-date">Period to</label>
          <input className="border rounded-lg p-2 text-xs" id="to-date" type="date" name="to" required defaultValue={params.to} />
          <button className="border rounded-lg p-2 text-sm">Apply period</button>
        </form>
      )}

      {operations && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric icon={IconDroplet} label="Milk today" value={d.dailyMilk.records ? `${d.dailyMilk.litres.toFixed(1)} L` : "Pending"} detail={d.previous !== null && d.dailyMilk.records ? `${(d.dailyMilk.litres - d.previous).toFixed(1)} L vs previous day · may be partial` : "No comparable complete-day result yet"} />
          <Metric icon={IconTrend} label="Sold today" value={salesComplete ? `${sold.toFixed(1)} L` : d.saleDay.length ? "Incomplete" : "Not recorded"} detail={`${formatRs(d.saleDay.reduce((n, s) => n + s.amount, 0))} recorded · ${new Set(d.saleDay.map(s => s.buyer).filter(Boolean)).size} named buyers`} />
          <Metric icon={IconArchive} label="Unsold balance" value={d.dailyMilk.records && salesComplete ? `${(d.dailyMilk.litres - sold).toFixed(1)} L` : "Unreconciled"} detail="Not confirmed unsold stock: use, waste and opening stock need reconciliation" />
          <Metric icon={IconUsers} label="Avg per milking cow" value={d.dailyMilk.average === null ? "Pending" : `${d.dailyMilk.average.toFixed(1)} L`} detail={`${d.dailyMilk.recorded} of ${d.expected.length} logged today`} />
        </div>
        <p className="text-xs text-slate-500">AM: {d.morning.records ? `${d.morning.litres.toFixed(1)} L` : "pending"} · PM: {d.evening.records ? `${d.evening.litres.toFixed(1)} L` : "pending"}. Missing-entry checks use the current milking herd; historical herd membership may differ. Explicit zero entries remain zero.</p>

        <Panel title="Needs attention">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {alerts.map(a => {
              const t = ALERT_TONE[a.tone];
              return (
                <Link key={a.title} href={a.href} className={`rounded-xl border p-3 ${t.border} ${t.bg}`}>
                  <div className="flex justify-between gap-3 font-semibold text-sm"><span>{a.title}</span><span className="text-xl">{a.count}</span></div>
                  <p className="text-xs text-slate-500 mt-1">{a.detail}</p>
                </Link>
              );
            })}
          </div>
          {!alerts.length && <p>No exceptions in these checks.</p>}
        </Panel>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel title={`Production vs sales · ${periodRangeLabel}`} href="/admin/reports/reconciliation" icon={IconTrend} className="xl:col-span-2">
            <DailyProductionChart data={d.series} />
            <p className="text-xs text-slate-500">Gaps mean missing or incomplete records, not zero production or sales.</p>
          </Panel>
          <Panel title={`Herd composition · ${d.active.length} active now`} href="/admin/cows" icon={IconUsers}>
            <HerdBar active={d.active} />
            <div className="border-t mt-4 pt-2 grid grid-cols-2 gap-x-3">
              <Row label="Female" value={d.active.filter(c => c.gender === "FEMALE").length} />
              <Row label="Male" value={d.active.filter(c => c.gender === "MALE").length} />
              <Row label="Unknown sex" value={d.active.filter(c => c.gender === "UNKNOWN").length} />
              <Row label="Sold" value={d.cows.filter(c => c.status === "SOLD").length} />
              <Row label="Deceased" value={d.cows.filter(c => c.status === "DEAD").length} />
              <Row label="Inseminated" value={d.cows.filter(c => !["MILKING", "DRY", "HEIFER", "CALF", "SOLD", "DEAD"].includes(c.status)).length} />
            </div>
          </Panel>
        </div>

        <p className="text-xs text-slate-500">Operational summaries below reflect current records as of {d.today}; daily feeding cost follows the selected milk-book day.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <Panel title="Breeding" href="/admin/reports/breeding" icon={IconHeart} tone="rose">
            <p className="font-bold text-xl mb-2">{overdueBreeding + breedingToday} follow-ups due</p>
            <Row label="Pregnant (expected date recorded)" value={d.pregnant} />
            <Row label="Need breeding / due service" value={overdueBreeding + breedingToday} />
            <Row label="Calvings in next 30 days" value={d.calvings} />
            <p className="text-xs text-slate-500 mt-2">Eligibility targets (herd-on-target %) are not configured — would need a defined voluntary-waiting-period rule.</p>
          </Panel>
          <Panel title="Health" href="/admin/reports/health" icon={IconActivity} tone="sky">
            <p className="font-bold text-xl mb-2">{coverage === null ? "—" : `${coverage}%`} vaccinated</p>
            <ProgressBar pct={coverage ?? 0} />
            <div className="mt-3">
              <Row label="Never vaccinated" value={d.neverVaccinated} />
              <Row label="Due ≤30 days" value={d.dueVaccines} />
              <Row label="Treatments · 30 days" value={d.treatments} />
            </div>
            <p className="text-xs text-slate-500 mt-2">Coverage means at least one vaccination record, not all vaccines up to date.</p>
          </Panel>
          <Panel title="Feed & Inventory" href="/admin/reports/feed" icon={IconArchive} tone="violet">
            <p className="font-bold text-xl mb-2">{feed.lowStockCount} low stock item{feed.lowStockCount === 1 ? "" : "s"}</p>
            <Row label="Feed types tracked" value={d.stocks.length} />
            <Row label="Negative stock" value={d.stocks.filter(s => s.balance < 0).length} />
            <Row label="Feed cost · selected day" value={feedValue(d.feedDay)} />
            <Row label="Cost · selected period" value={feedValue(d.feedPeriod)} />
            <p className="text-xs text-slate-500 mt-2">Based on recorded feed issued, not purchases. Manage feed types in Feed Master.</p>
          </Panel>
        </div>
      </>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {finance && (
          <Panel title={`Finances · ${periodRangeLabel}`} href="/admin/reports/pl" icon={IconDollar} tone="green" className="xl:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <Metric icon={IconDollar} label="Recorded income" value={formatRs(income)} detail="Sales plus other recorded income" tone="green" />
              <Metric icon={IconLayers} label="Recorded outgoings" value={formatRs(expense)} detail="Includes capital spending if entered here" tone="rose" />
              <Metric icon={IconTrend} label="Recorded net" value={formatRs(net)} detail={income > 0 ? `${(net / income * 100).toFixed(1)}% of recorded income` : "No income recorded"} tone="amber" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Breakdown title="Income by category" values={d.income} />
              <Breakdown title="Outgoings by category" values={d.expenses} />
            </div>
            <p className="text-xs text-slate-500 mt-4">Recorded summary, not a complete accrual P&L. Loan, capital and asset classifications require review. Customer receipts are excluded from income already recognised at sale.</p>
            <div className="border-t mt-4 pt-3">
              <Row label="Cash net recorded · all dates to today" value={formatRs(d.cash.cash)} />
              <Row label="Bank net recorded · all dates to today" value={formatRs(d.cash.bank)} />
              <p className="text-xs text-slate-500">Receipts less payments across recorded accounts. Opening balances and reconciliation must be confirmed; these are not verified available balances.</p>
              <Link className="text-sm text-teal-700 underline" href="/admin/capital">Partner capital by venture →</Link>
            </div>
          </Panel>
        )}
        {operations && (
          <div className="flex flex-col gap-4">
            <Panel title="Receivables · current app sales" href="/admin/reports/milk-sales" icon={IconLayers} tone="green">
              <p className="text-3xl font-bold text-orange-700">{formatRs(d.receivables.reduce((n, r) => n + Math.max(0, r.balance), 0))}</p>
              <p className="text-xs text-slate-500">Across {d.receivables.filter(r => r.balance > 0).length} buyers · reconcile payment records</p>
              <Row label="Billed" value={formatRs(d.receivables.reduce((n, r) => n + r.billed, 0))} />
              <Row label="Received for these buyers" value={formatRs(d.receivables.reduce((n, r) => n + r.received, 0))} />
              <p className="text-xs text-slate-500">Historical cash-ledger backfills excluded. Due dates and invoice allocations are not recorded, so overdue ageing is unavailable.</p>
            </Panel>
            <Panel title="Top producers" href="/admin/reports/herd" icon={IconTrend} tone="amber">
              <p className="text-xs text-slate-500 mb-3">{d.lastDate ? `Recorded milk on ${d.lastDate}${d.lastDate !== d.day ? " · latest available before selected day" : ""}` : "No records yet"}</p>
              {d.top.map((c, i) => (
                <Link key={c.id} href={`/admin/cows/${c.id}`} className="flex justify-between border-b border-slate-100 py-3 text-sm">
                  <span>{i + 1}. Animal {c.tag}</span><strong>{c.litres.toFixed(1)} L</strong>
                </Link>
              ))}
            </Panel>
          </div>
        )}
      </div>

      {operations && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Age profile" icon={IconUsers} tone="green">
            {d.ages.map(a => <Row key={a.label} label={a.label} value={<>{a.count}<small className="block text-slate-400">{d.active.length ? (a.count / d.active.length * 100).toFixed(1) : 0}%</small></>} />)}
          </Panel>
          <Panel title="By category" icon={IconTag} tone="sky">
            <Row label="Active animals" value={d.active.length} />
            <Row label="Business category classification" value="Not configured" />
            <p className="text-xs text-slate-500">Dairy, beef and breeder categories are not stored separately. Herd status and breed remain available in Animals.</p>
          </Panel>
          <Panel title="Jump to" icon={IconGrid}>
            <div className="grid grid-cols-2 gap-2">
              {JUMP_LINKS.concat(finance ? [["Income", "/admin/reports/pl"], ["Capital", "/admin/capital"]] : []).map(([label, href]) => (
                <Link key={href} href={href} className="rounded-lg border border-slate-200 p-3 text-sm hover:bg-teal-50">{label}</Link>
              ))}
            </div>
          </Panel>
        </div>
      )}
      {!finance && !operations && <Panel title="Dashboard access"><p>Your account has no Operations or Financial access. Use your permitted sections from the menu.</p></Panel>}
    </div>
  );
}
