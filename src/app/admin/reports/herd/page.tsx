import { getHerdSummary } from "@/lib/reports/herd";
import { getMilkMonthComparison } from "@/lib/reports/milkAnalytics";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import TrendStat from "@/components/TrendStat";
import MilkProductionTable from "./MilkProductionTable";

export default async function MilkProductionByCowPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const [rows, monthComparison] = await Promise.all([getHerdSummary(), getMilkMonthComparison()]);

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
        Lifetime milk production per animal — days milked, total litres, and average litres/day. Search or sort any
        column; click a tag to open that cow&apos;s full profile.
      </p>
      <MilkProductionTable rows={rows} isAdmin={isAdmin} />
    </div>
  );
}
