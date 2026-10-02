"use client";

import { useActionState, useRef, useEffect, useMemo, useState } from "react";
import { submitMilkSale, type FormState } from "./actions";
import { INTERNAL_USE_OPTIONS } from "./internalUse";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export type CustomerOption = { id: string; name: string; agreedRate: number | null };

export default function MilkSaleForm({ customers }: { customers: CustomerOption[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitMilkSale, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [buyer, setBuyer] = useState("");

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setBuyer("");
    }
  }, [state]);

  const selected = useMemo(() => customers.find((c) => c.name === buyer) ?? null, [customers, buyer]);
  const isInternal = INTERNAL_USE_OPTIONS.some((o) => o.label === buyer);
  const canSubmit = isInternal || (selected !== null && selected.agreedRate !== null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="buyer" className="text-sm font-medium text-neutral-700">Customer</label>
        <select
          id="buyer"
          name="buyer"
          required
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          className="border border-neutral-300 rounded-md px-3 py-2 text-base"
        >
          <option value="">Select a customer or use…</option>
          <optgroup label="Customers">
            {customers.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Internal use (no charge)">
            {INTERNAL_USE_OPTIONS.map((o) => (
              <option key={o.type} value={o.label}>{o.label}</option>
            ))}
          </optgroup>
        </select>
        <p className="text-xs text-neutral-400">
          Only registered customers can be sold to here. An Admin adds new customers and sets their rate on the Customers page.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">Session (optional)</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="shift" value="" defaultChecked /> Unspecified
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="shift" value="MORNING" /> Morning
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="shift" value="AFTERNOON" /> Afternoon
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="shift" value="EVENING" /> Evening
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="litres" className="text-sm font-medium text-neutral-700">Litres</label>
        <input id="litres" name="litres" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>

      <div className="rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm">
        {isInternal ? (
          <span className="text-neutral-700">Internal use — no rate, no charge. Counted in Production Reconciliation.</span>
        ) : selected ? (
          selected.agreedRate !== null ? (
            <span className="text-neutral-700">
              Rate (fixed): <strong>Rs {selected.agreedRate.toFixed(2)}/L</strong> — managed on the Customers page.
            </span>
          ) : (
            <span className="text-red-600">This customer has no agreed rate set. Add one on the Customers page before recording a sale.</span>
          )
        ) : (
          <span className="text-neutral-400">Select a customer to see their rate.</span>
        )}
      </div>

      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending || !canSubmit} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Entry"}
      </button>
    </form>
  );
}
