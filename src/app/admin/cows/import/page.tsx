import PageHeader from "@/components/PageHeader";
import BulkTypeSection from "@/app/admin/bulk/BulkTypeSection";
import { getBulkTypeMeta } from "@/lib/bulk/registry";

export default function ImportAnimalsPage() {
  const meta = getBulkTypeMeta("cows")!;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Import Animals" />
      <p className="text-sm text-neutral-500 max-w-2xl">
        Bulk-register animals from a CSV file, or export the current register to edit offline and re-upload. Uploads
        are all-or-nothing — if any row has a problem, nothing is imported and you get a full list of what to fix.
      </p>
      <BulkTypeSection meta={meta} />
    </div>
  );
}
