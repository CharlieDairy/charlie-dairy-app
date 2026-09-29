"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useActionState } from "react";
import { formatRs } from "@/lib/format";
import DeleteRowButton from "@/components/DeleteRowButton";
import { updateCapitalEntry, deleteCapitalEntry, type FormState } from "./actions";

export type LedgerEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  partner: string;
  description: string;
  venture: string | null;
  credit: number;
  debit: number;
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

function EditRow({ entry, partners, ventures, onDone }: { entry: LedgerEntry; partners: string[]; ventures: string[]; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateCapitalEntry, undefined);
  const direction = entry.credit > 0 ? "CONTRIBUTION" : "WITHDRAWAL";
  const amount = entry.credit > 0 ? entry.credit : entry.debit;

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <tr className="border-t border-neutral-100 bg-amber-50/50">
      <td colSpan={7} className="px-3 py-2">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={entry.id} />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Date</label>
            <input name="date" type="date" defaultValue={entry.date} required className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Partner</label>
            <input name="partner" list="capital-edit-partners" defaultValue={entry.partner} required className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
            <label className="text-xs text-neutral-500">Description</label>
            <input name="description" defaultValue={entry.description} required className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Venture</label>
            <input name="venture" list="capital-edit-ventures" defaultValue={entry.venture ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Direction</label>
            <select name="direction" defaultValue={direction} className="border border-neutral-300 rounded px-2 py-1 text-sm">
              <option value="CONTRIBUTION">In</option>
              <option value="WITHDRAWAL">Out</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Amount</label>
            <input name="amount" type="number" step="1" min="0" defaultValue={amount} required className="border border-neutral-300 rounded px-2 py-1 text-sm w-28" />
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

export default function CapitalLedgerTable({ entries, partners, ventures }: { entries: LedgerEntry[]; partners: string[]; ventures: string[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
      <datalist id="capital-edit-partners">
        {partners.map((p) => <option key={p} value={p} />)}
      </datalist>
      <datalist id="capital-edit-ventures">
        {ventures.map((v) => <option key={v} value={v} />)}
      </datalist>
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            <th className="text-left px-3 py-2">Date</th>
            <th className="text-left px-3 py-2">Partner</th>
            <th className="text-left px-3 py-2">Description</th>
            <th className="text-left px-3 py-2">Venture</th>
            <th className="text-right px-3 py-2">Credit</th>
            <th className="text-right px-3 py-2">Debit</th>
            <th className="text-left px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) =>
            editingId === e.id ? (
              <EditRow key={e.id} entry={e} partners={partners} ventures={ventures} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{e.date}</td>
                <td className="px-3 py-2">{e.partner}</td>
                <td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2">{e.venture ?? "—"}</td>
                <td className="px-3 py-2 text-right">{e.credit ? formatRs(e.credit) : "—"}</td>
                <td className="px-3 py-2 text-right">{e.debit ? formatRs(e.debit) : "—"}</td>
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
                      action={deleteCapitalEntry}
                      hiddenFields={{ id: e.id }}
                      confirmMessage={`Delete this capital entry (${e.partner} — ${e.description})? This can't be undone.`}
                      icon={IconTrash}
                    />
                  </div>
                </td>
              </tr>
            )
          )}
          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-neutral-400">No entries for this filter.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
