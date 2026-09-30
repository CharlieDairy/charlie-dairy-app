"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { addProductionTarget, type FormState } from "./actions";

export default function AddTargetForm({ cows }: { cows: { id: string; tag: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addProductionTarget, undefined);
  const [type, setType] = useState<"MILK_DAILY" | "WEIGHT">("MILK_DAILY");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="cowId" className="text-sm font-medium text-neutral-700">Animal</label>
        <select id="cowId" name="cowId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select…</option>
          {cows.map((c) => (
            <option key={c.id} value={c.id}>{c.tag}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="type" className="text-sm font-medium text-neutral-700">Type</label>
        <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as "MILK_DAILY" | "WEIGHT")} className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="MILK_DAILY">Milk (L/day)</option>
          <option value="WEIGHT">Weight (kg)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="targetValue" className="text-sm font-medium text-neutral-700">
          Target {type === "MILK_DAILY" ? "(L/day)" : "(kg)"}
        </label>
        <input id="targetValue" name="targetValue" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-32" />
      </div>
      {type === "WEIGHT" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="targetDate" className="text-sm font-medium text-neutral-700">By Date (optional)</label>
          <input id="targetDate" name="targetDate" type="date" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        </div>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "+ Set Target"}
      </button>
      {state && !state.success && <p className="text-sm text-red-600 w-full">{state.message}</p>}
    </form>
  );
}
