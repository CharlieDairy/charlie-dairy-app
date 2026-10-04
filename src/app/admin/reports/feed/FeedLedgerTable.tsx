"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import DeleteRowButton from "@/components/DeleteRowButton";
import { formatRs } from "@/lib/format";
import {
  updateFeedTransaction,
  deleteFeedTransaction,
  deleteFeedTransactions,
  deleteAllFeedTransactions,
  type FormState,
} from "@/app/entry/feed/actions";
import type { FeedLedgerLine } from "@/lib/reports/feed";

const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const rs2 = (n: number) => `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

function Ic({ children }: { children: ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconEdit = <Ic><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></Ic>;
const IconTrash = <Ic><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></Ic>;

function EditRow({ line, feedNames, colSpan, onDone, feedType }: {
  line: FeedLedgerLine;
  feedNames: string[];
  feedType: string;
  colSpan: number;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateFeedTransaction, undefined);

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const input = "border border-neutral-300 rounded px-2 py-1 text-sm";
  return (
    <tr className="border-t border-neutral-100 bg-amber-50/50">
      <td colSpan={colSpan} className="px-3 py-2">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={line.id} />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Date</label>
            <input name="date" type="date" defaultValue={line.date} required className={input} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Feed</label>
            <select name="feedType" defaultValue={feedType} className={`${input} bg-white`}>
              {feedNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Direction</label>
            <select name="direction" defaultValue={line.direction} className={`${input} bg-white`}>
              <option value="IN">In (received)</option>
              <option value="OUT">Out (issued)</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Quantity</label>
            <input name="quantity" type="number" step="0.01" min="0" defaultValue={line.quantity} required className={`${input} w-28`} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Rate</label>
            <input name="rate" type="number" step="0.01" min="0" defaultValue={line.rate ?? ""} className={`${input} w-28`} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Cost (Out only)</label>
            <input name="cost" type="number" step="0.01" min="0" defaultValue={line.cost ?? ""} placeholder="rate × qty" className={`${input} w-32`} />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
            <label className="text-xs text-neutral-500">Notes</label>
            <input name="notes" defaultValue={line.notes ?? ""} maxLength={300} className={`${input} w-full`} />
          </div>
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onDone} className="text-xs text-neutral-500 px-2">Cancel</button>
          {state && !state.success && <p className="text-xs text-red-600 w-full">{state.message}</p>}
        </form>
      </td>
    </tr>
  );
}

export default function FeedLedgerTable({
  lines,
  feedType,
  feedNames,
  unit,
  opening,
  inQty,
  outQty,
  closing,
  from,
  to,
  isAdmin,
}: {
  lines: FeedLedgerLine[];
  feedType: string;
  feedNames: string[];
  unit: string;
  opening: number;
  inQty: number;
  outQty: number;
  closing: number;
  from: string; // period start, YYYY-MM-DD
  to: string; // period end (inclusive), YYYY-MM-DD
  isAdmin: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, bulkAction, isBulkPending] = useActionState<FormState, FormData>(deleteFeedTransactions, undefined);
  const [allState, allAction, isAllPending] = useActionState<FormState, FormData>(deleteAllFeedTransactions, undefined);

  useEffect(() => {
    if (bulkState?.success || allState?.success) setSelected(new Set());
  }, [bulkState, allState]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const allSelected = lines.length > 0 && lines.every((l) => selected.has(l.id));
  const colSpan = isAdmin ? 10 : 8;
  const lead = isAdmin ? 1 : 0;

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <form
            action={bulkAction}
            onSubmit={(e) => {
              if (!confirm(`Delete ${selected.size} selected ${feedType} entr${selected.size === 1 ? "y" : "ies"}? This can't be undone.`)) e.preventDefault();
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
                onChange={() => setSelected(allSelected ? new Set() : new Set(lines.map((l) => l.id)))}
              />
              Select all ({lines.length})
            </label>
            <button
              type="submit"
              disabled={selected.size === 0 || isBulkPending}
              className="text-xs rounded px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isBulkPending ? "Deleting…" : `Delete selected (${selected.size})`}
            </button>
          </form>
          <form
            action={allAction}
            onSubmit={(e) => {
              if (
                !confirm(
                  `Delete ALL ${lines.length} ${feedType} entries from ${from} to ${to}? This removes them from stock and cost history and can't be undone.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="feedType" value={feedType} />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <button
              type="submit"
              disabled={lines.length === 0 || isAllPending}
              className="text-xs rounded px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAllPending ? "Deleting…" : `Delete all ${feedType} in period (${lines.length})`}
            </button>
          </form>
          {[bulkState, allState].map(
            (s, i) => s && <p key={i} className={`text-xs ${s.success ? "text-green-700" : "text-red-600"}`}>{s.message}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              {isAdmin && <th className="text-left px-3 py-2 w-8"></th>}
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-right px-3 py-2">In</th>
              <th className="text-right px-3 py-2">Out</th>
              <th className="text-right px-3 py-2">Balance</th>
              <th className="text-right px-3 py-2">Rate</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Notes</th>
              <th className="text-left px-3 py-2">By</th>
              {isAdmin && <th className="text-left px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-neutral-50 font-medium">
              <td colSpan={1 + lead} className="px-3 py-2">Opening balance</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right">{qty(opening)}</td>
              <td colSpan={colSpan - 4 - lead} />
            </tr>
            {lines.map((l) =>
              editingId === l.id ? (
                <EditRow key={l.id} line={l} feedType={feedType} feedNames={feedNames} colSpan={colSpan} onDone={() => setEditingId(null)} />
              ) : (
                <tr key={l.id} className="border-t border-neutral-100">
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select entry ${l.date}`} />
                    </td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap">{l.date}</td>
                  <td className="px-3 py-2 text-right text-green-700">{l.direction === "IN" ? qty(l.quantity) : ""}</td>
                  <td className="px-3 py-2 text-right">{l.direction === "OUT" ? qty(l.quantity) : ""}</td>
                  <td className={`px-3 py-2 text-right font-medium ${l.balance < 0 ? "text-danger" : ""}`}>{qty(l.balance)}</td>
                  <td className="px-3 py-2 text-right">{l.rate !== null ? rs2(l.rate) : "—"}</td>
                  <td className="px-3 py-2 text-right">{l.amount !== null ? formatRs(l.amount) : "—"}</td>
                  <td className="px-3 py-2 text-neutral-600">{l.notes ?? ""}</td>
                  <td className="px-3 py-2 text-neutral-500">{l.enteredBy ?? ""}</td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(l.id)}
                          title="Edit"
                          className="p-1.5 rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                        >
                          {IconEdit}
                        </button>
                        <DeleteRowButton
                          action={deleteFeedTransaction}
                          hiddenFields={{ id: l.id }}
                          confirmMessage={`Delete this ${l.direction === "IN" ? "inward" : "outward"} entry of ${qty(l.quantity)} ${unit} on ${l.date}? This can't be undone.`}
                          icon={IconTrash}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              )
            )}
            {lines.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-6 text-center text-neutral-500">No entries for this feed in the period.</td>
              </tr>
            )}
            <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
              <td colSpan={1 + lead} className="px-3 py-2">Closing balance</td>
              <td className="px-3 py-2 text-right">{qty(inQty)}</td>
              <td className="px-3 py-2 text-right">{qty(outQty)}</td>
              <td className={`px-3 py-2 text-right ${closing < 0 ? "text-danger" : ""}`}>{qty(closing)}</td>
              <td colSpan={colSpan - 4 - lead} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
