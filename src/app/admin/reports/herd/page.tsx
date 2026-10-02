import { getHerdSummary } from "@/lib/reports/herd";
import { getMilkMonthComparison } from "@/lib/reports/milkAnalytics";
import { resolvePeriod } from "@/lib/period";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import TrendStat from "@/components/TrendStat";
import PeriodBar from "@/components/PeriodBar";
import MilkProductionTable from "./MilkProductionTable";

export default async function MilkProductionByCowPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, from, to } = await resolvePeriod(params, "month");
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const [rows, monthComparison] = await Promise.all([getHerdSummary(period, from, to), getMilkMonthComparison()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Milk Production by Cow" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <p className="text-base font-semibold text-neutral-600">
        Milk production per animal for the selected period — days milked, total litres, and average litres/day.
        Search or sort any column, or filter by status below; click a tag to open that cow&apos;s full profile.
      </p>
      <PeriodBar period={period} from={from} to={to} />
      <MilkProductionTable rows={rows} isAdmin={isAdmin} period={period} from={from} to={to} />
    </div>
  );
}
