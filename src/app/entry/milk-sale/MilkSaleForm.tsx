"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitMilkSale, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MilkSaleForm({ buyers }: { buyers: string[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitMilkSale, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="buyer" className="text-sm font-medium text-neutral-700">Buyer</label>
        <input id="buyer" name="buyer" list="buyer-options" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" placeholder="e.g. Engro, City, Farm Sale" />
        <datalist id="buyer-options">
          {buyers.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="litres" className="text-sm font-medium text-neutral-700">Litres</label>
        <input id="litres" name="litres" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rate" className="text-sm font-medium text-neutral-700">Rate per litre (optional)</label>
        <input id="rate" name="rate" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-neutral-700">Total Amount (Rs) — leave blank to auto-calc from rate × litres</label>
        <input id="amount" name="amount" type="number" step="1" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
