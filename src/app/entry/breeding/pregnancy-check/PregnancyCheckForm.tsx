"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordPregnancyCheck, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function PregnancyCheckForm({ cows }: { cows: { id: string; tag: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordPregnancyCheck, undefined);
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
        <select id="method" name="method" required defaultValue="PALPATION" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="PALPATION">Palpation</option>
          <option value="ULTRASOUND">Ultrasound</option>
          <option value="BLOOD_TEST">Blood Test</option>
          <option value="OBSERVATION">Observation</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="result" className="text-sm font-medium text-neutral-700">Result</label>
        <select id="result" name="result" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select result…</option>
          <option value="PREGNANT">Pregnant</option>
          <option value="OPEN">Open (not pregnant)</option>
          <option value="INCONCLUSIVE">Inconclusive</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="performedBy" className="text-sm font-medium text-neutral-700">Performed By (optional)</label>
        <input id="performedBy" name="performedBy" placeholder="Vet / technician" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
        {isPending ? "Saving…" : "Save Pregnancy Check"}
      </button>
    </form>
  );
}
