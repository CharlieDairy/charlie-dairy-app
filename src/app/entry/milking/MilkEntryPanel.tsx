"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DeleteRowButton from "@/components/DeleteRowButton";
import { submitMilking, updateMilking, deleteMilking, type FormState } from "./actions";

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

const IconEdit = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></svg>
);
const IconTrash = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
);

function hasData(r: DisplayRow) {
  return r.morning !== null || r.afternoon !== null || r.evening !== null;
}

function shiftCell(litres: number | null) {
  return litres !== null ? `${litres.toFixed(1)} L` : "—";
}

export default function MilkEntryPanel({
  cows,
  rows,
  mode,
  defaultDate,
  canEdit,
  canDelete,
}: {
  cows: { id: string; tag: string }[];
  rows: DisplayRow[];
  mode: "day" | "log";
  defaultDate: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DisplayRow | null>(null);
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
                  <div className="flex items-center justify-end gap-1.5">
                  {r.showAdd && r.cowId && (
                    <button
                      type="button"
                      onClick={() => openModal(r.cowId!, r.date)}
                      className="inline-block text-xs rounded-full px-3 py-1 bg-primary text-white font-semibold hover:bg-primary-dark"
                    >
                      + Add
                    </button>
                  )}
                  {hasData(r) && canEdit && (
                    <button type="button" onClick={() => setEditing(r)} title="Edit" aria-label={`Edit ${r.tag} ${r.date}`} className="p-1.5 rounded border border-border text-text-muted hover:bg-primary-light">
                      {IconEdit}
                    </button>
                  )}
                  {hasData(r) && canDelete && (
                    <DeleteRowButton
                      action={deleteMilking}
                      hiddenFields={{ cowId: r.cowId ?? "", date: r.date }}
                      confirmMessage={`Delete all milk sessions for ${r.tag} on ${r.date}? This can't be undone.`}
                      icon={IconTrash}
                    />
                  )}
                  </div>
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
      {editing && <AddMilkModal key={editing.key} cows={cows} defaultCowId={editing.cowId ?? ""} defaultDate={editing.date} edit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AddMilkModal({
  cows,
  defaultCowId,
  defaultDate,
  edit,
  onClose,
}: {
  cows: { id: string; tag: string }[];
  defaultCowId: string;
  defaultDate: string;
  edit?: DisplayRow;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(edit ? updateMilking : submitMilking, undefined);
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
            <h2 className="text-lg font-bold text-white">{edit ? "Edit Milk Record" : "Add Milk Record"}</h2>
            <p className="text-xs text-green-100 mt-1">{edit ? `Change the litres for ${edit.tag} on ${edit.date}. Clear a session to remove it.` : "Choose an animal and date, then enter its milk quantities."}</p>
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
              {edit && <input type="hidden" name="cowId" value={edit.cowId ?? ""} />}
              <select id="modal-cowId" name={edit ? undefined : "cowId"} required={!edit} disabled={!!edit} defaultValue={defaultCowId} className="border border-border rounded-md px-3 py-2 text-base disabled:bg-neutral-100">
                {edit && !edit.cowId && <option value="">Herd / Group total</option>}
                <option value="">Select a cow…</option>
                {cows.map((c) => (
                  <option key={c.id} value={c.id}>{c.tag}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted">Only active milking/dry animals are listed.</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="modal-date" className="text-sm font-semibold text-text">Record date</label>
              {edit && <input type="hidden" name="date" value={edit.date} />}
              <input id="modal-date" name={edit ? undefined : "date"} type="date" required={!edit} readOnly={!!edit} disabled={!!edit} defaultValue={defaultDate} className="border border-border rounded-md px-3 py-2 text-base disabled:bg-neutral-100" />
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
                <input id="modal-morning" name="morning" type="number" step="0.1" min="0" placeholder="0.00" defaultValue={edit?.morning ?? undefined} className="border border-border rounded-md px-3 py-2 text-base" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-afternoon" className="text-xs font-semibold text-text">Afternoon (L)</label>
                <input id="modal-afternoon" name="afternoon" type="number" step="0.1" min="0" placeholder="0.00" defaultValue={edit?.afternoon ?? undefined} className="border border-border rounded-md px-3 py-2 text-base" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-evening" className="text-xs font-semibold text-text">Evening (L)</label>
                <input id="modal-evening" name="evening" type="number" step="0.1" min="0" placeholder="0.00" defaultValue={edit?.evening ?? undefined} className="border border-border rounded-md px-3 py-2 text-base" />
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
                {isPending ? "Saving…" : edit ? "Save changes" : "Save record"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
