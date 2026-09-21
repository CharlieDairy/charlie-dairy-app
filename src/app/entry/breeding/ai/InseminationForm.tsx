"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordInsemination, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InseminationForm({ cows }: { cows: { id: string; tag: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordInsemination, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="cowId" className="text-sm font-medium text-neutral-700">Cow Tag</label>
        <select id="cowId" name="cowId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select a cow…</option>
          {cows.map((c) => (
            <option key={c.id} value={c.id}>{c.tag}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="method" className="text-sm font-medium text-neutral-700">Method</label>
        <select id="method" name="method" required defaultValue="AI" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="AI">Artificial Insemination</option>
          <option value="NATURAL">Natural Service</option>
          <option value="EMBRYO_TRANSFER">Embryo Transfer</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="semenBatch" className="text-sm font-medium text-neutral-700">Semen Batch (optional)</label>
        <input id="semenBatch" name="semenBatch" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="bullTag" className="text-sm font-medium text-neutral-700">Bull Tag / Sire (optional)</label>
        <input id="bullTag" name="bullTag" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="technician" className="text-sm font-medium text-neutral-700">Technician (optional)</label>
        <input id="technician" name="technician" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cost" className="text-sm font-medium text-neutral-700">Service Cost (optional)</label>
        <input id="cost" name="cost" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Insemination"}
      </button>
    </form>
  );
}
