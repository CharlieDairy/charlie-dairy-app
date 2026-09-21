import { getHerdSummary } from "@/lib/reports/herd";
import PageHeader from "@/components/PageHeader";
import MilkProductionTable from "./MilkProductionTable";

export default async function MilkProductionByCowPage() {
  const rows = await getHerdSummary();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Milk Production by Cow" />
      <p className="text-sm text-neutral-500 max-w-2xl">
        Lifetime milk production per animal — days milked, total litres, and average litres/day. Search or sort any
        column; click a tag to open that cow&apos;s full profile.
      </p>
      <MilkProductionTable rows={rows} />
    </div>
  );
}
