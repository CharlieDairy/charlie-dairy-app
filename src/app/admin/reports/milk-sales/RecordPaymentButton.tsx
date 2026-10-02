"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordCustomerPayment, type FormState } from "./actions";

type CustomerOption = { id: string; name: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordPaymentButton({ customers, defaultCustomer }: { customers: CustomerOption[]; defaultCustomer?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="link-btn link-btn-primary">
        + Record payment →
      </button>
      {open && <PaymentModal customers={customers} defaultCustomer={defaultCustomer} onClose={() => setOpen(false)} />}
    </>
  );
}

function PaymentModal({ customers, defaultCustomer, onClose }: { customers: CustomerOption[]; defaultCustomer?: string; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordCustomerPayment, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      const t = setTimeout(onClose, 900);
      return () => clearTimeout(t);
    }
  }, [state, onClose, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-green-900 to-green-700 px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Record Payment</h2>
            <p className="text-xs text-green-100 mt-1">Choose a customer, then enter what they paid. It is added to the cash accounts automatically.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 shrink-0 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="flex flex-col gap-5 px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="pay-buyer" className="text-sm font-semibold text-text">Customer</label>
              <select id="pay-buyer" name="buyer" required defaultValue={defaultCustomer ?? ""} className="border border-border rounded-md px-3 py-2 text-base">
                <option value="">Select a customer…</option>
                <optgroup label="Customers">
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pay-date" className="text-sm font-semibold text-text">Payment date</label>
              <input id="pay-date" name="date" type="date" required defaultValue={todayIso()} className="border border-border rounded-md px-3 py-2 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pay-amount" className="text-sm font-semibold text-text">Amount (Rs)</label>
              <input id="pay-amount" name="amount" type="number" step="1" min="0" required placeholder="0" className="border border-border rounded-md px-3 py-2 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pay-mode" className="text-sm font-semibold text-text">Mode</label>
              <select id="pay-mode" name="mode" defaultValue="CASH" className="border border-border rounded-md px-3 py-2 text-base">
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pay-notes" className="text-sm font-semibold text-text">Notes (optional)</label>
            <input id="pay-notes" name="notes" className="border border-border rounded-md px-3 py-2 text-base" />
          </div>

          {state && (
            <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
              {state.message}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <p className="text-xs text-text-muted">Saved only when you select Save payment.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text-muted hover:bg-primary-light">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
                {isPending ? "Saving…" : "Save payment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
