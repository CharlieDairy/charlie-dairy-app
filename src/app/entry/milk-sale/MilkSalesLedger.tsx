"use client";

import { useActionState, useState } from "react";
import { formatRs } from "@/lib/format";
import { updateMilkSale, deleteMilkSale, type FormState } from "./actions";

export type LedgerSaleRow = {
  id: string;
  date: string; // ISO date, yyyy-mm-dd
  buyer: string;
  litres: number;
  rate: number | null;
  amount: number;
};

function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={deleteMilkSale}
      onSubmit={(e) => {
        if (!confirm("Delete this sale entry? This can't be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs rounded px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50">
        Delete
      </button>
    </form>
  );
}

function EditRow({ sale, onCancel }: { sale: LedgerSaleRow; onCancel: () => void }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateMilkSale, undefined);

  if (state?.success) onCancel();

  return (
    <tr className="border-t border-neutral-100 bg-amber-50/40">
      <td colSpan={6} className="px-3 py-2">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={sale.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Date</label>
            <input name="date" type="date" defaultValue={sale.date} required className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Buyer</label>
            <input name="buyer" defaultValue={sale.buyer} required className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Litres</label>
            <input name="litres" type="number" step="0.1" min="0" defaultValue={sale.litres} required className="border border-neutral-300 rounded px-2 py-1 text-sm w-24" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Rate</label>
            <input name="rate" type="number" step="0.01" min="0" defaultValue={sale.rate ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm w-24" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Amount</label>
            <input name="amount" type="number" step="1" min="0" defaultValue={sale.amount} className="border border-neutral-300 rounded px-2 py-1 text-sm w-28" />
          </div>
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} className="text-xs rounded px-3 py-1.5 border border-neutral-300 hover:bg-neutral-100">
            Cancel
          </button>
          {state && !state.success && <span className="text-xs text-red-600 w-full">{state.message}</span>}
        </form>
      </td>
    </tr>
  );
}

export default function MilkSalesLedger({ sales }: { sales: LedgerSaleRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            <th className="text-left px-3 py-2">Date</th>
            <th className="text-left px-3 py-2">Customer</th>
            <th className="text-right px-3 py-2">Litres</th>
            <th className="text-right px-3 py-2">Rate</th>
            <th className="text-right px-3 py-2">Amount</th>
            <th className="text-left px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) =>
            editingId === s.id ? (
              <EditRow key={s.id} sale={s} onCancel={() => setEditingId(null)} />
            ) : (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{s.date}</td>
                <td className="px-3 py-2 font-medium">{s.buyer}</td>
                <td className="px-3 py-2 text-right">{s.litres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{s.rate !== null ? `Rs ${s.rate.toFixed(2)}` : "—"}</td>
                <td className="px-3 py-2 text-right">{formatRs(s.amount)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingId(s.id)} className="text-xs rounded px-2 py-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                      Edit
                    </button>
                    <DeleteButton id={s.id} />
                  </div>
                </td>
              </tr>
            )
          )}
          {sales.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-neutral-400">No sales recorded in this period.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
