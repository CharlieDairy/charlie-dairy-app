"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordCustomerPayment, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordPaymentForm({ buyers, defaultBuyer }: { buyers: string[]; defaultBuyer?: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordCustomerPayment, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1">
        <label htmlFor="buyer" className="text-sm font-medium text-neutral-700">Customer</label>
        <input
          id="buyer"
          name="buyer"
          list="payment-buyer-options"
          required
          defaultValue={defaultBuyer}
          className="border border-neutral-300 rounded-md px-3 py-2 text-base w-44"
        />
        <datalist id="payment-buyer-options">
          {buyers.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-neutral-700">Amount (Rs)</label>
        <input id="amount" name="amount" type="number" step="1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-32" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="mode" className="text-sm font-medium text-neutral-700">Mode</label>
        <select id="mode" name="mode" defaultValue="CASH" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="CASH">Cash</option>
          <option value="BANK">Bank</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes (optional)</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Record Payment"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
