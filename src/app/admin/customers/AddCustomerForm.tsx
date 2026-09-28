"use client";

import { useActionState, useRef, useEffect } from "react";
import { addCustomer, type FormState } from "./actions";

export default function AddCustomerForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addCustomer, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
        <label className="text-xs text-neutral-500">Customer Name</label>
        <input name="name" required placeholder="e.g. City Sale" className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Phone</label>
        <input name="phone" placeholder="e.g. 0300-1234567" className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Payment Terms</label>
        <input name="paymentTerms" placeholder="e.g. Weekly, Net 7" className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Agreed Rate (Rs/L)</label>
        <input name="agreedRate" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-32" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Customer"}
      </button>
      {state && !state.success && <span className="text-xs text-red-600 w-full">{state.message}</span>}
    </form>
  );
}
