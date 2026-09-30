"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordTreatment, type FormState } from "@/app/admin/health/actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TreatmentForm({
  cows,
  medicineNames,
}: {
  cows: { id: string; tag: string }[];
  medicineNames: string[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordTreatment, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cowId" className="text-sm font-medium text-neutral-700">Animal</label>
        <select id="cowId" name="cowId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select an animal…</option>
          {cows.map((c) => (
            <option key={c.id} value={c.id}>{c.tag}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="medicineName" className="text-sm font-medium text-neutral-700">Medicine</label>
        <input id="medicineName" name="medicineName" list="medicine-options" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <datalist id="medicine-options">
          {medicineNames.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reason" className="text-sm font-medium text-neutral-700">Reason / Diagnosis (optional)</label>
        <input id="reason" name="reason" placeholder="e.g. Mastitis, fever" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="dosage" className="text-sm font-medium text-neutral-700">Dosage (optional)</label>
        <input id="dosage" name="dosage" placeholder="e.g. 10ml, twice daily for 3 days" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="quantityUsed" className="text-sm font-medium text-neutral-700">Quantity Used (optional)</label>
        <input id="quantityUsed" name="quantityUsed" type="number" step="0.01" min="0" placeholder="e.g. 10" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <span className="text-xs text-neutral-400">Deducts from medicine stock if this medicine has stock tracked.</span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cost" className="text-sm font-medium text-neutral-700">Cost (Rs, optional)</label>
        <input id="cost" name="cost" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="administeredBy" className="text-sm font-medium text-neutral-700">Administered By (optional)</label>
        <input id="administeredBy" name="administeredBy" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes (optional)</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Entry"}
      </button>
    </form>
  );
}
