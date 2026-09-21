import { getDashboardSummary } from "@/lib/reports/dashboard";
import { formatRs, formatPct } from "@/lib/format";
import StatCard from "@/components/StatCard";

export default async function AdminDashboard() {
  const s = await getDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatRs(s.totalRevenue)} />
        <StatCard label="Total Expense" value={formatRs(s.totalExpense)} />
        <StatCard label="Net Income" value={formatRs(s.netIncome)} tone={s.netIncome >= 0 ? "positive" : "negative"} />
        <StatCard label="Net Margin" value={formatPct(s.netMargin)} tone={s.netMargin >= 0 ? "positive" : "negative"} />
        <StatCard label="Closing Cash (cumulative)" value={formatRs(s.closingCash)} tone={s.closingCash >= 0 ? "positive" : "negative"} />
        <StatCard label="Active Herd Size" value={s.activeHerdSize.toString()} />
        <StatCard label="Total Milk Recorded" value={`${Math.round(s.totalMilkLitres).toLocaleString()} L`} />
        <StatCard label="Net Capital Raised" value={formatRs(s.capitalRaised)} />
      </div>
      <p className="text-sm text-neutral-500">
        Figures are computed live from recorded cash transactions and milking records — not hand-maintained.
        Capital Raised covers all partner ledger entries (multiple ventures); see the Capital Ledger page to filter by venture.
      </p>
    </div>
  );
}
