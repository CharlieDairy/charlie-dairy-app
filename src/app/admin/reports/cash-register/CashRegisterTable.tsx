"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useActionState } from "react";
import { formatRs } from "@/lib/format";
import DeleteRowButton from "@/components/DeleteRowButton";
import { updateCashEntry, deleteCashEntry, deleteCashEntries, type FormState, type BulkDeleteState } from "@/app/entry/cash/actions";

export type CashRow = {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  party: string | null;
  mode: "CASH" | "BANK";
  remark: string | null;
  amountIn: number;
  amountOut: number;
};

function Ic({ children }: { children: ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconEdit = <Ic><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></Ic>;
const IconTrash = <Ic><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></Ic>;

function EditRow({ entry, categories, vendorNames, colSpan, onDone }: {
  entry: CashRow;
  categories: string[];
  vendorNames: string[];
  colSpan: number;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateCashEntry, undefined);
  const direction = entry.amountIn > 0 ? "IN" : "OUT";
  const amount = entry.amountIn > 0 ? entry.amountIn : entry.amountOut;

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <tr className="border-t border-neutral-100 bg-amber-50/50">
      <td colSpan={colSpan} className="px-3 py-2">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={entry.id} />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Date</label>
            <input name="date" type="date" defaultValue={entry.date} required className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Direction</label>
            <select name="direction" defaultValue={direction} className="border border-neutral-300 rounded px-2 py-1 text-sm">
              <option value="IN">In</option>
              <option value="OUT">Out</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Amount</label>
            <input name="amount" type="number" step="1" min="0" defaultValue={amount} required className="border border-neutral-300 rounded px-2 py-1 text-sm w-28" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Mode</label>
            <select name="mode" defaultValue={entry.mode} className="border border-neutral-300 rounded px-2 py-1 text-sm">
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Category</label>
            <input name="category" list="cash-edit-categories" defaultValue={entry.category} required className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Party</label>
            <input name="party" list="cash-edit-parties" defaultValue={entry.party ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
            <label className="text-xs text-neutral-500">Remark</label>
            <input name="remark" defaultValue={entry.remark ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
          </div>
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onDone} className="text-xs text-neutral-500 px-2">
            Cancel
          </button>
          {state && !state.success && <p className="text-xs text-red-600 w-full">{state.message}</p>}
        </form>
      </td>
    </tr>
  );
}

export default function CashRegisterTable({
  entries,
  categories,
  vendorNames,
  isAdmin = false,
}: {
  entries: CashRow[];
  categories: string[];
  vendorNames: string[];
  isAdmin?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, bulkAction, isBulkPending] = useActionState<BulkDeleteState, FormData>(deleteCashEntries, undefined);

  useEffect(() => {
    if (bulkState?.success) setSelected(new Set());
  }, [bulkState]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.id));
  const colSpan = isAdmin ? 8 : 7;

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <form
          action={bulkAction}
          onSubmit={(e) => {
            if (!confirm(`Delete ${selected.size} selected entr${selected.size === 1 ? "y" : "ies"}? This can't be undone.`)) e.preventDefault();
          }}
          className="flex items-center gap-3 flex-wrap"
        >
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="entryIds" value={id} />
          ))}
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  for (const e of entries) {
                    if (allSelected) next.delete(e.id); else next.add(e.id);
                  }
                  return next;
                });
              }}
            />
            Select All ({entries.length})
          </label>
          <button
            type="submit"
            disabled={selected.size === 0 || isBulkPending}
            className="text-xs rounded px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBulkPending ? "Deleting…" : `Delete selected (${selected.size})`}
          </button>
          {bulkState && <p className={`text-xs ${bulkState.success ? "text-green-700" : "text-red-600"}`}>{bulkState.message}</p>}
        </form>
      )}

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <datalist id="cash-edit-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
        <datalist id="cash-edit-parties">
          {vendorNames.map((v) => <option key={v} value={v} />)}
        </datalist>
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              {isAdmin && <th className="text-left px-3 py-2 w-8"></th>}
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Party</th>
              <th className="text-left px-3 py-2">Mode</th>
              <th className="text-right px-3 py-2">In</th>
              <th className="text-right px-3 py-2">Out</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) =>
              editingId === e.id ? (
                <EditRow key={e.id} entry={e} categories={categories} vendorNames={vendorNames} colSpan={colSpan} onDone={() => setEditingId(null)} />
              ) : (
                <tr key={e.id} className="border-t border-neutral-100">
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} aria-label={`Select entry: ${e.category}`} />
                    </td>
                  )}
                  <td className="px-3 py-2">{e.date}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2">{e.party ?? "—"}</td>
                  <td className="px-3 py-2">{e.mode === "BANK" ? "Bank" : "Cash"}</td>
                  <td className="px-3 py-2 text-right">{e.amountIn ? formatRs(e.amountIn) : "—"}</td>
                  <td className="px-3 py-2 text-right">{e.amountOut ? formatRs(e.amountOut) : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(e.id)}
                        title="Edit"
                        className="p-1.5 rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                      >
                        {IconEdit}
                      </button>
                      <DeleteRowButton
                        action={deleteCashEntry}
                        hiddenFields={{ id: e.id }}
                        confirmMessage={`Delete this cash entry (${e.category})? This can't be undone.`}
                        icon={IconTrash}
                      />
                    </div>
                  </td>
                </tr>
              )
            )}
            {entries.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-6 text-center text-neutral-400">No transactions for this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
