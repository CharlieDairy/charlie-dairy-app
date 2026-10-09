"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useActionState } from "react";
import { formatRs } from "@/lib/format";
import DeleteRowButton from "@/components/DeleteRowButton";
import CashForm from "@/app/entry/cash/CashForm";
import { updateCashEntry, deleteCashEntry, deleteCashEntries, type FormState, type BulkDeleteState } from "@/app/entry/cash/actions";

export type CashRow = {
  id: string;
  entryNo: number;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM:SS, farm time
  category: string;
  party: string | null;
  mode: "CASH" | "BANK";
  remark: string | null;
  projectLand: string | null;
  amountIn: number;
  amountOut: number;
  /** Running balance after this entry, in the books being shown. */
  balance: number;
  enteredBy: string | null;
  /** Who last changed it, and when (ISO), if it was ever edited in the app. */
  editedBy: string | null;
  editedAt: string | null;
  /** How the entry is counted in the books (automatic unless an Admin set it). */
  cls: string;
  clsLabel: string;
  manualClass: string | null;
};

const CLASS_OPTIONS: { value: string; label: string }[] = [
  { value: "MILK_SALES", label: "Milk sales" },
  { value: "LIVESTOCK_SALES", label: "Animal & calf sales" },
  { value: "OTHER_INCOME", label: "Other income" },
  { value: "OPEX", label: "Operating cost" },
  { value: "CAPEX", label: "Capital spending" },
  { value: "PARTNER_IN", label: "Money from partners" },
  { value: "PARTNER_OUT", label: "Money to partners" },
  { value: "OPENING", label: "Opening balance" },
  { value: "TRANSFER", label: "Transfer between books" },
  { value: "REVIEW", label: "Needs review" },
];

const PAGE_SIZE = 50;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]}, ${y}`;
}
function prettyClock(time: string | null) {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}
function prettyStamp(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));
}

function Ic({ children, size = 15 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconEdit = <Ic><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></Ic>;
const IconTrash = <Ic><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></Ic>;
const IconSearch = <Ic size={18}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Ic>;

function EditRow({ entry, categories, colSpan, onDone, isAdmin }: {
  isAdmin: boolean;
  entry: CashRow;
  categories: string[];
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

  const field = "border border-neutral-300 rounded px-2 py-1 text-sm";
  return (
    <tr className="border-t border-neutral-100 bg-amber-50/50">
      <td colSpan={colSpan} className="px-3 py-3">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={entry.id} />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Date</label>
            <input name="date" type="date" defaultValue={entry.date} required className={field} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Time</label>
            <input name="time" type="time" defaultValue={(entry.time ?? "").slice(0, 5)} className={field} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Direction</label>
            <select name="direction" defaultValue={direction} className={field}>
              <option value="IN">In</option>
              <option value="OUT">Out</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Amount</label>
            <input name="amount" type="number" step="1" min="0" defaultValue={amount} required className={`${field} w-28`} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Mode</label>
            <select name="mode" defaultValue={entry.mode} className={field}>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Category</label>
            <input name="category" list="cash-edit-categories" defaultValue={entry.category} required className={field} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Party</label>
            <input name="party" list="cash-edit-parties" defaultValue={entry.party ?? ""} className={field} />
          </div>
          {isAdmin && (
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-neutral-500">Counted in books as</label>
              <select name="accountClass" defaultValue={entry.manualClass ?? ""} className={field}>
                <option value="">Automatic ({entry.clsLabel})</option>
                {CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
            <label className="text-xs text-neutral-500">Details</label>
            <input name="remark" defaultValue={entry.remark ?? ""} className={`${field} w-full`} />
          </div>
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onDone} className="text-xs text-neutral-500 px-2">
            Cancel
          </button>
          {state && !state.success && <p className="text-xs text-red-600 w-full">{state.message}</p>}
        </form>
        <datalist id="cash-edit-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </td>
    </tr>
  );
}

export default function CashRegisterTable({
  entries,
  categories,
  vendorNames,
  customerNames,
  isAdmin = false,
  summary,
}: {
  entries: CashRow[];
  categories: string[];
  vendorNames: string[];
  customerNames: string[];
  isAdmin?: boolean;
  /** The Opening Balance / Cash In / Cash Out / Net Balance boxes, rendered by the server. */
  summary: ReactNode;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickedIds, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, bulkAction, isBulkPending] = useActionState<BulkDeleteState, FormData>(deleteCashEntries, undefined);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<"IN" | "OUT" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Entries that were deleted drop out of the selection by themselves.
  const selected = useMemo(() => {
    const live = new Set(entries.map((e) => e.id));
    return new Set([...pickedIds].filter((id) => live.has(id)));
  }, [pickedIds, entries]);

  // "/" jumps to the search box, like CashBook.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "/" && el && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/,/g, "");
    return entries.filter((e) => {
      if (type === "IN" && !(e.amountIn > 0)) return false;
      if (type === "OUT" && !(e.amountOut > 0)) return false;
      if (!q) return true;
      const hay = [e.remark, e.party, e.category, e.projectLand, e.enteredBy, `#${e.entryNo}`, String(e.amountIn || e.amountOut)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = shown.length > 0 && shown.every((e) => selected.has(e.id));
  const colSpan = isAdmin ? 11 : 10;
  const th = "px-3 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-600";

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: search on the left, Cash In / Cash Out on the right */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 flex-1 min-w-[220px] max-w-xl bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-neutral-500 focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600">
          {IconSearch}
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search by remark, party, category, amount or #"
            className="flex-1 bg-transparent outline-none text-sm text-neutral-900 placeholder:text-neutral-400 min-w-0"
            aria-label="Search entries"
          />
          <kbd className="hidden md:inline text-[11px] border border-neutral-300 rounded px-1.5 py-0.5 text-neutral-500">/</kbd>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => (v === "IN" ? null : "IN"))}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${open === "IN" ? "bg-green-800 ring-2 ring-green-300" : "bg-green-700 hover:bg-green-800"}`}
          >
            + Cash In
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => (v === "OUT" ? null : "OUT"))}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${open === "OUT" ? "bg-red-700 ring-2 ring-red-300" : "bg-red-600 hover:bg-red-700"}`}
          >
            − Cash Out
          </button>
        </div>
      </div>
      {open && <CashForm key={open} categories={categories} vendorNames={vendorNames} customerNames={customerNames} direction={open} />}

      {summary}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-neutral-200 bg-white overflow-hidden text-xs font-medium">
          {([["ALL", "All"], ["IN", "Cash In"], ["OUT", "Cash Out"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setType(k); setPage(0); }}
              className={`px-3.5 py-2 ${type === k ? "bg-green-700 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
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
            <button
              type="submit"
              disabled={selected.size === 0 || isBulkPending}
              className="text-xs rounded-lg px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
            >
              {isBulkPending ? "Deleting…" : `Delete selected (${selected.size})`}
            </button>
            {bulkState && <p className={`text-xs ${bulkState.success ? "text-green-700" : "text-red-600"}`}>{bulkState.message}</p>}
          </form>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-600 border-b border-neutral-200">
          <span>
            Showing {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1} - {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length} entries
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="w-8 h-8 rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50" aria-label="Previous page">‹</button>
              <span className="text-xs">Page {safePage + 1} of {pageCount}</span>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="w-8 h-8 rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50" aria-label="Next page">›</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <datalist id="cash-edit-parties">
            {vendorNames.map((v) => <option key={v} value={v} />)}
          </datalist>
          <table className="min-w-full text-sm">
            <thead className="bg-[#eef1fb] text-left">
              <tr>
                {isAdmin && (
                  <th className={`${th} w-8`}>
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allSelected}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const e of shown) {
                            if (allSelected) next.delete(e.id); else next.add(e.id);
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                )}
                <th className={th}>Date &amp; Time</th>
                <th className={th}>Category</th>
                <th className={th}>Details</th>
                <th className={th}>Party</th>
                <th className={th}>Mode</th>
                <th className={`${th} text-right`}>In</th>
                <th className={`${th} text-right`}>Out</th>
                <th className={`${th} text-right`}>Balance</th>
                <th className={th}>Entered by</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) =>
                editingId === e.id ? (
                  <EditRow key={e.id} entry={e} isAdmin={isAdmin} categories={categories} colSpan={colSpan} onDone={() => setEditingId(null)} />
                ) : (
                  <tr key={e.id} className="border-t border-neutral-100 align-top hover:bg-neutral-50/60">
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} aria-label={`Select entry #${e.entryNo}`} />
                      </td>
                    )}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-medium text-neutral-900">{prettyDate(e.date)}</div>
                      <div className="text-xs text-neutral-500">{prettyClock(e.time) || "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-neutral-900">{e.category}</div>
                      <div className={`text-[11px] ${e.cls === "REVIEW" ? "text-amber-700 font-semibold" : "text-neutral-400"}`}>{e.clsLabel}{e.manualClass ? " · set by Admin" : ""}</div>
                    </td>
                    <td className="px-3 py-3 min-w-[220px] max-w-[420px]">
                      {e.projectLand && <div className="text-[11px] text-neutral-400">Project/Land Name: {e.projectLand}</div>}
                      <div className="text-neutral-800 whitespace-pre-line break-words">{e.remark?.trim() || <span className="text-neutral-300">—</span>}</div>
                    </td>
                    <td className="px-3 py-3">{e.party ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${e.mode === "BANK" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>{e.mode === "BANK" ? "Bank" : "Cash"}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-green-700 whitespace-nowrap">{e.amountIn ? formatRs(e.amountIn) : ""}</td>
                    <td className="px-3 py-3 text-right font-medium text-red-600 whitespace-nowrap">{e.amountOut ? formatRs(e.amountOut) : ""}</td>
                    <td className={`px-3 py-3 text-right whitespace-nowrap ${e.balance < 0 ? "text-red-600" : "text-neutral-700"}`}>{formatRs(e.balance)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-neutral-800">{e.enteredBy ?? "—"}</div>
                      <div className="text-[11px] text-neutral-400">Entry #{e.entryNo}</div>
                      {e.editedBy && e.editedAt && <div className="text-[11px] text-neutral-400" title={prettyStamp(e.editedAt)}>Edited by {e.editedBy}</div>}
                    </td>
                    <td className="px-3 py-3">
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
                          confirmMessage={`Delete cash entry #${e.entryNo} (${e.category})? This can't be undone.`}
                          icon={IconTrash}
                        />
                      </div>
                    </td>
                  </tr>
                )
              )}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-neutral-400">
                    {entries.length === 0 ? "No transactions for this period." : "No entries match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
