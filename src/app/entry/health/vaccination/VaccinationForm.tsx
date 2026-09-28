"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordVaccination, type FormState } from "@/app/admin/health/actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function VaccinationForm({
  cows,
  vaccineNames,
}: {
  cows: { id: string; tag: string }[];
  vaccineNames: string[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordVaccination, undefined);
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
        <label htmlFor="vaccineName" className="text-sm font-medium text-neutral-700">Vaccine</label>
        <input id="vaccineName" name="vaccineName" list="vaccine-options" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <datalist id="vaccine-options">
          {vaccineNames.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <p className="text-xs text-neutral-400">If this vaccine has a repeat interval set (Health → Vaccines), the next due date fills in automatically.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="nextDueDate" className="text-sm font-medium text-neutral-700">Next Due Date (optional)</label>
        <input id="nextDueDate" name="nextDueDate" type="date" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
