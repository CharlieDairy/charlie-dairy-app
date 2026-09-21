"use client";

import { useActionState, useRef, useEffect } from "react";
import { addCapitalEntry, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddCapitalForm({ partners, ventures }: { partners: string[]; ventures: string[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addCapitalEntry, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="partner" className="text-sm font-medium text-neutral-700">Partner / Account</label>
        <input id="partner" name="partner" list="partner-options" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <datalist id="partner-options">
          {partners.map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
        <label htmlFor="description" className="text-sm font-medium text-neutral-700">Description</label>
        <input id="description" name="description" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="venture" className="text-sm font-medium text-neutral-700">Venture (optional)</label>
        <input id="venture" name="venture" list="venture-options" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <datalist id="venture-options">
          {ventures.map((v) => <option key={v} value={v} />)}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">Direction</span>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1"><input type="radio" name="direction" value="CONTRIBUTION" defaultChecked /> In</label>
          <label className="flex items-center gap-1"><input type="radio" name="direction" value="WITHDRAWAL" /> Out</label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-neutral-700">Amount (Rs)</label>
        <input id="amount" name="amount" type="number" step="1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-36" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Add Entry"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
