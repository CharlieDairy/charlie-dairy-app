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

type Cow = { id: string; tag: string };

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

const TH = "px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-text-muted";

export default function MilkEntryPanel({
  cows,
  rows,
  mode,
  defaultDate,
  canEdit,
  canDelete,
}: {
  cows: Cow[];
  rows: DisplayRow[];
  mode: "day" | "log";
  defaultDate: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [adding, setAdding] = useState<{ cowId: string; date: string } | null>(null);
  const [editing, setEditing] = useState<DisplayRow | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAdding({ cowId: "", date: defaultDate })}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
        >
          + Add Milk Records
        </button>
      </div>

      <div className="overflow-x-auto bg-white border border-border rounded-xl shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-primary-light">
            <tr>
              <th className={`text-left ${TH}`}>Tag</th>
              <th className={`text-left ${TH}`}>Date</th>
              <th className={`text-right ${TH}`}>DIM</th>
              <th className={`text-right ${TH}`}>Morning</th>
              <th className={`text-right ${TH}`}>Afternoon</th>
              <th className={`text-right ${TH}`}>Evening</th>
              <th className={`text-right ${TH}`}>Total</th>
              <th className={`text-right ${TH}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={`border-t border-border/60 ${
                  mode === "day" ? (!hasData(r) ? "bg-danger-light/40" : r.showAdd ? "bg-warning-light/40" : "") : ""
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
                        onClick={() => setAdding({ cowId: r.cowId!, date: r.date })}
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

      {adding && (
        <AddMilkModal cows={cows} rows={rows} mode={mode} listDate={defaultDate} startCowId={adding.cowId} startDate={adding.date} onClose={() => setAdding(null)} />
      )}
      {editing && <EditMilkModal key={editing.key} cows={cows} row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-green-900 to-green-700 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="mt-1 text-xs text-green-100">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-8 w-8 shrink-0 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const FIELD = "w-full border border-border rounded-md px-3 py-2 text-base";

function LitresFields({ initial }: { initial?: { morning: number | null; afternoon: number | null; evening: number | null } }) {
  const items = [
    { name: "morning", label: "Morning (L)", v: initial?.morning },
    { name: "afternoon", label: "Afternoon (L)", v: initial?.afternoon },
    { name: "evening", label: "Evening (L)", v: initial?.evening },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((f, i) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label htmlFor={`m-${f.name}`} className="text-xs font-semibold text-text">{f.label}</label>
          <input
            id={`m-${f.name}`}
            name={f.name}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="0.0"
            defaultValue={f.v ?? undefined}
            autoFocus={i === 0}
            className={FIELD}
          />
        </div>
      ))}
    </div>
  );
}

// Add Milk Records: stays open after each save so a whole milking can be
// keyed in one animal after another -- "Save & Next" saves, clears the litres
// and moves to the next animal that still needs a record. "Done" closes it,
// and the table behind has been refreshing the whole time.
function AddMilkModal({
  cows,
  rows,
  mode,
  listDate,
  startCowId,
  startDate,
  onClose,
}: {
  cows: Cow[];
  rows: DisplayRow[];
  mode: "day" | "log";
  listDate: string;
  startCowId: string;
  startDate: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [cowId, setCowId] = useState(startCowId);
  const [date, setDate] = useState(startDate);
  const [saved, setSaved] = useState<{ id: string; tag: string; litres: number }[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const closeAfter = useRef(false);

  const savedIds = new Set(saved.map((s) => s.id));
  const recordedOnList = new Set(
    mode === "day" && date === listDate ? rows.filter((r) => r.cowId && hasData(r)).map((r) => r.cowId as string) : [],
  );
  const isDone = (id: string) => savedIds.has(id) || recordedOnList.has(id);
  const remaining = cows.filter((c) => !isDone(c.id)).length;

  function nextCow(afterId: string): string {
    const start = cows.findIndex((c) => c.id === afterId);
    const ordered = [...cows.slice(start + 1), ...cows.slice(0, Math.max(start, 0))];
    return ordered.find((c) => c.id !== afterId && !isDone(c.id))?.id ?? "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const tag = cows.find((c) => c.id === cowId)?.tag ?? "";
    const litres = ["morning", "afternoon", "evening"].reduce((n, k) => n + (Number(fd.get(k)) || 0), 0);
    setPending(true);
    setMessage(null);
    let res: FormState;
    try {
      res = await submitMilking(undefined, fd);
    } catch {
      res = { success: false, message: "Something went wrong. Please try again." };
    }
    setPending(false);
    if (!res?.success) {
      setMessage({ ok: false, text: res?.message ?? "Could not save." });
      return;
    }
    router.refresh();
    setSaved((s) => [...s, { id: cowId, tag, litres }]);
    if (closeAfter.current) {
      onClose();
      return;
    }
    const next = nextCow(cowId);
    setCowId(next);
    setFormKey((k) => k + 1);
    setMessage({ ok: true, text: next ? `Saved cow ${tag}. Next animal selected.` : `Saved cow ${tag}. That was the last animal on the list.` });
  }

  return (
    <ModalShell title="Add Milk Records" subtitle="Save & Next keeps this window open so you can enter one animal after another." onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="m-cow" className="text-sm font-semibold text-text">Animal tag</label>
            <select id="m-cow" name="cowId" required value={cowId} onChange={(e) => setCowId(e.target.value)} className={FIELD}>
              <option value="">Select a cow…</option>
              {cows.map((c) => (
                <option key={c.id} value={c.id}>{c.tag}{isDone(c.id) ? "  ✓ recorded" : ""}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted">{remaining} of {cows.length} animals still to record{date === listDate ? "" : " (for this list's date)"}.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="m-date" className="text-sm font-semibold text-text">Record date</label>
            <input id="m-date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
            <p className="text-xs text-text-muted">One record per animal per day. All sessions go in the same record.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2" key={formKey}>
          <div>
            <h3 className="text-sm font-bold text-text">Milk Quantities</h3>
            <p className="text-xs text-primary">Enter litres for each session. Leave a session blank if it was not recorded.</p>
          </div>
          <LitresFields />
        </div>

        {message && (
          <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} role="status">
            {message.text}
          </p>
        )}

        {saved.length > 0 && (
          <div className="rounded-lg border border-border bg-neutral-50 px-3 py-2">
            <p className="text-xs font-semibold text-text-muted">Saved in this window ({saved.length})</p>
            <p className="mt-1 flex flex-wrap gap-1.5">
              {saved.map((s, i) => (
                <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-text ring-1 ring-border">
                  {s.tag} · {s.litres.toFixed(1)} L
                </span>
              ))}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="order-1 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-muted hover:bg-primary-light">
            {saved.length > 0 ? "Done" : "Cancel"}
          </button>
          <button type="submit" onClick={() => (closeAfter.current = false)} disabled={pending} className="order-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60">
            {pending ? "Saving…" : "Save & Next →"}
          </button>
          <button type="submit" onClick={() => (closeAfter.current = true)} disabled={pending} className="order-2 rounded-lg border border-primary bg-white px-4 py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary-light disabled:opacity-60">
            Save &amp; Close
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// Edit one cow-day. The animal (tag) can be changed here too -- the sessions
// move to the animal you pick, as long as it has no record of its own for
// that day.
function EditMilkModal({ cows, row, onClose }: { cows: Cow[]; row: DisplayRow; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateMilking, undefined);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      const t = setTimeout(onClose, 900);
      return () => clearTimeout(t);
    }
  }, [state, onClose, router]);

  return (
    <ModalShell title="Edit Milk Record" subtitle={`Change the litres or the animal for ${row.date}. Clear a session to remove it.`} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-5 px-6 py-5">
        <input type="hidden" name="cowId" value={row.cowId ?? ""} />
        <input type="hidden" name="date" value={row.date} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="e-cow" className="text-sm font-semibold text-text">Animal tag</label>
            <select id="e-cow" name="newCowId" defaultValue={row.cowId ?? ""} className={FIELD}>
              {!row.cowId && <option value="">Herd / Group total</option>}
              {cows.map((c) => (
                <option key={c.id} value={c.id}>{c.tag}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted">Pick a different tag to move this record to that animal.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="e-date" className="text-sm font-semibold text-text">Record date</label>
            <input id="e-date" type="date" value={row.date} readOnly disabled className={`${FIELD} bg-neutral-100`} />
            <p className="text-xs text-text-muted">The date of an existing record can&apos;t be changed.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-text">Milk Quantities</h3>
          <LitresFields initial={row} />
        </div>
        {state && (
          <p className={`rounded-lg px-3 py-2 text-sm ${state.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} role="status">
            {state.message}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-muted hover:bg-primary-light">Cancel</button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60">
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
