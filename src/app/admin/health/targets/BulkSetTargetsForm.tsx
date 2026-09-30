"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { bulkSetProductionTargets, type BulkState } from "./actions";

export default function BulkSetTargetsForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<BulkState, FormData>(bulkSetProductionTargets, undefined);
  const [type, setType] = useState<"MILK_DAILY" | "WEIGHT">("MILK_DAILY");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="self-end border border-neutral-300 text-neutral-700 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">
        Bulk Set Targets
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="statusFilter" className="text-sm font-medium text-neutral-700">Group</label>
        <select id="statusFilter" name="statusFilter" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="MILKING">Milking</option>
          <option value="DRY">Dry</option>
          <option value="HEIFER">Heifer</option>
          <option value="CALF">Calf</option>
          <option value="ALL">All Active Animals</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="bulkType" className="text-sm font-medium text-neutral-700">Type</label>
        <select id="bulkType" name="type" value={type} onChange={(e) => setType(e.target.value as "MILK_DAILY" | "WEIGHT")} className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="MILK_DAILY">Milk (L/day)</option>
          <option value="WEIGHT">Weight (kg)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="bulkTargetValue" className="text-sm font-medium text-neutral-700">
          Target {type === "MILK_DAILY" ? "(L/day)" : "(kg)"}
        </label>
        <input id="bulkTargetValue" name="targetValue" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-32" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
        {isPending ? "Applying…" : "Apply to Group"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500 px-2">Cancel</button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
