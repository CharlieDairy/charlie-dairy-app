"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitMilking, type FormState } from "./actions";

export type DisplayRow = {
  key: string;
  cowId: string | null;
  tag: string;
  date: string;
  dim: number | null;
  morning: number | null;
  afternoon: number | null;
  evening: number | null;
  total: number;
  showAdd: boolean;
};

function shiftCell(litres: number | null) {
  return litres !== null ? `${litres.toFixed(1)} L` : "—";
}

export default function MilkEntryPanel({
  cows,
  rows,
  mode,
  defaultDate,
}: {
  cows: { id: string; tag: string }[];
  rows: DisplayRow[];
  mode: "day" | "log";
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [modalCowId, setModalCowId] = useState("");
  const [modalDate, setModalDate] = useState(defaultDate);

  const openModal = (cowId?: string, date?: string) => {
    setModalCowId(cowId ?? "");
    setModalDate(date ?? defaultDate);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openModal()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          + Add Milk Record
        </button>
      </div>

      <div className="overflow-x-auto bg-white border border-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-primary-light">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Tag</th>
              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Date</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">DIM</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Morning</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Afternoon</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Evening</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Total</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={`border-t border-border/60 ${
                  mode === "day"
                    ? r.morning === null && r.afternoon === null && r.evening === null
                      ? "bg-danger-light/40"
                      : r.showAdd
                        ? "bg-warning-light/40"
                        : ""
                    : ""
                }`}
              >
                <td className="px-3 py-2 font-semibold">{r.tag}</td>
                <td className="px-3 py-2 text-text-muted">{r.date}</td>
                <td className="px-3 py-2 text-right text-text-muted">{r.dim ?? "—"}</td>
                <td className="px-3 py-2 text-right text-text-muted">{shiftCell(r.morning)}</td>
                <td className="px-3 py-2 text-right text-text-muted">{shiftCell(r.afternoon)}</td>
                <td className="px-3 py-2 text-right text-text-muted">{shiftCell(r.evening)}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.total.toFixed(1)} L</td>
                <td className="px-3 py-2 text-right">
                  {r.showAdd && r.cowId && (
                    <button
                      type="button"
                      onClick={() => openModal(r.cowId!, r.date)}
                      className="inline-block text-xs rounded-full px-3 py-1 bg-primary text-white font-semibold hover:bg-primary-dark"
                    >
                      + Add
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-text-muted">
                  {mode === "day" ? "No active milking/dry animals." : "No milking records in this period."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <AddMilkModal cows={cows} defaultCowId={modalCowId} defaultDate={modalDate} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddMilkModal({
  cows,
  defaultCowId,
  defaultDate,
  onClose,
}: {
  cows: { id: string; tag: string }[];
  defaultCowId: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitMilking, undefined);
  const formRef = useRef<HTMLFormElement>(null);
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
            <h2 className="text-lg font-bold text-white">Add Milk Record</h2>
            <p className="text-xs text-green-100 mt-1">Choose an animal and date, then enter its milk quantities.</p>
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

        <form ref={formRef} action={formAction} className="flex flex-col gap-5 px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="modal-cowId" className="text-sm font-semibold text-text">Animal tag</label>
              <select id="modal-cowId" name="cowId" required defaultValue={defaultCowId} className="border border-border rounded-md px-3 py-2 text-base">
                <option value="">Select a cow…</option>
                {cows.map((c) => (
                  <option key={c.id} value={c.id}>{c.tag}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted">Only active milking/dry animals are listed.</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="modal-date" className="text-sm font-semibold text-text">Record date</label>
              <input id="modal-date" name="date" type="date" required defaultValue={defaultDate} className="border border-border rounded-md px-3 py-2 text-base" />
              <p className="text-xs text-text-muted">One record per animal per day. All sessions go in the same record.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-bold text-text">Milk Quantities</h3>
              <p className="text-xs text-primary">Enter litres for each session. Leave a session blank if it was not recorded.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-morning" className="text-xs font-semibold text-text">Morning (L)</label>
                <input id="modal-morning" name="morning" type="number" step="0.1" min="0" placeholder="0.00" className="border border-border rounded-md px-3 py-2 text-base" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-afternoon" className="text-xs font-semibold text-text">Afternoon (L)</label>
                <input id="modal-afternoon" name="afternoon" type="number" step="0.1" min="0" placeholder="0.00" className="border border-border rounded-md px-3 py-2 text-base" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-evening" className="text-xs font-semibold text-text">Evening (L)</label>
                <input id="modal-evening" name="evening" type="number" step="0.1" min="0" placeholder="0.00" className="border border-border rounded-md px-3 py-2 text-base" />
              </div>
            </div>
          </div>

          {state && (
            <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
              {state.message}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <p className="text-xs text-text-muted">Changes are saved only when you select Save record.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text-muted hover:bg-primary-light">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
                {isPending ? "Saving…" : "Save record"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
