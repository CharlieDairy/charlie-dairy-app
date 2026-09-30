"use client";

import { useActionState, useRef, useEffect } from "react";
import { restockMedicine, type FormState } from "../../actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function RestockForm({ medicines }: { medicines: { id: string; name: string; unit: string | null }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(restockMedicine, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="medicineDefId" className="text-sm font-medium text-neutral-700">Medicine</label>
        <select id="medicineDefId" name="medicineDefId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select…</option>
          {medicines.map((m) => (
            <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ""}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="quantity" className="text-sm font-medium text-neutral-700">Quantity Received</label>
        <input id="quantity" name="quantity" type="number" step="0.01" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-32" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cost" className="text-sm font-medium text-neutral-700">Cost (Rs, optional)</label>
        <input id="cost" name="cost" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-32" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes (optional)</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "+ Restock"}
      </button>
      {state && !state.success && <p className="text-sm text-red-600 w-full">{state.message}</p>}
    </form>
  );
}
