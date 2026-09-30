import Link from "next/link";
import { getHerdSummary, type PeriodKey } from "@/lib/reports/herd";
import { getMilkMonthComparison } from "@/lib/reports/milkAnalytics";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import TrendStat from "@/components/TrendStat";
import MilkProductionTable from "./MilkProductionTable";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default async function MilkProductionByCowPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = PERIODS.some((p) => p.key === params.period) ? (params.period as PeriodKey) : "all";
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const [rows, monthComparison] = await Promise.all([getHerdSummary(period), getMilkMonthComparison()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Milk Production by Cow" />
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <TrendStat
          label="Litres This Month"
          value={monthComparison.totalLitres.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          comparison={monthComparison.totalLitres}
        />
        <TrendStat
          label="Avg Litres / Day"
          value={monthComparison.avgPerDay.current.toFixed(1)}
          comparison={monthComparison.avgPerDay}
        />
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Milk production per animal for the selected period — days milked, total litres, and average litres/day.
        Search or sort any column, or filter by status below; click a tag to open that cow&apos;s full profile.
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`?period=${p.key}`}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              period === p.key ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <MilkProductionTable rows={rows} isAdmin={isAdmin} period={period} />
    </div>
  );
}
