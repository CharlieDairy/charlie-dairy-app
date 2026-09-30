"use client";

import { useActionState, useEffect, useState } from "react";
import { updateMedicineDef, type FormState } from "../actions";
import MedicineActiveToggle from "./MedicineActiveToggle";

export type MedicineRowData = {
  id: string;
  name: string;
  unit: string | null;
  withdrawalDays: number | null;
  reorderLevel: number | null;
  active: boolean;
};

export default function MedicineRow({ medicine }: { medicine: MedicineRowData }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateMedicineDef, undefined);

  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <tr className="border-t border-neutral-100">
        <td className="px-3 py-2 font-medium">{medicine.name}</td>
        <td className="px-3 py-2">{medicine.unit ?? "—"}</td>
        <td className="px-3 py-2">
          {medicine.withdrawalDays != null ? (
            `${medicine.withdrawalDays} day${medicine.withdrawalDays === 1 ? "" : "s"}`
          ) : (
            <span className="text-amber-600">Not set</span>
          )}
        </td>
        <td className="px-3 py-2">{medicine.reorderLevel ?? "—"}</td>
        <td className="px-3 py-2">{medicine.active ? "Active" : "Hidden"}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs rounded px-2 py-1 border border-border text-text hover:bg-neutral-100"
            >
              Edit
            </button>
            <MedicineActiveToggle id={medicine.id} active={medicine.active} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-neutral-100 bg-amber-50/50">
      <td colSpan={6} className="px-3 py-2">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={medicine.id} />
          <span className="text-sm font-medium pb-2">{medicine.name}</span>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Unit</label>
            <input name="unit" defaultValue={medicine.unit ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm w-24" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Withdrawal Days</label>
            <input name="withdrawalDays" type="number" min="0" step="1" defaultValue={medicine.withdrawalDays ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm w-24" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-neutral-500">Reorder Level</label>
            <input name="reorderLevel" type="number" min="0" step="0.1" defaultValue={medicine.reorderLevel ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm w-24" />
          </div>
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 px-2">
            Cancel
          </button>
          {state && !state.success && <p className="text-xs text-red-600 w-full">{state.message}</p>}
        </form>
      </td>
    </tr>
  );
}
