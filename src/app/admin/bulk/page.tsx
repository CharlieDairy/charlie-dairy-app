import { BULK_TYPES } from "@/lib/bulk/registry";
import BulkTypeSection from "./BulkTypeSection";

export default function BulkDataPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Bulk Data</h1>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Download any module&apos;s data as CSV (optionally filtered by date), or bulk-upload new
        records from a CSV in the same format. Uploads are all-or-nothing: if any row has a
        problem, nothing is imported and you get a full list of what to fix. Breeding events
        (heat, insemination, pregnancy check, calving) can be downloaded here but not
        bulk-uploaded — record those through the dedicated Breeding entry forms so the related
        cow record (lactation number, expected calving date, etc.) stays correct.
      </p>
      <div className="flex flex-col gap-3">
        {BULK_TYPES.map((meta) => (
          <BulkTypeSection key={meta.key} meta={meta} />
        ))}
      </div>
    </div>
  );
}
