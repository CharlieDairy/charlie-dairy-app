"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DeleteRowButton from "@/components/DeleteRowButton";

type ActionState = { success: boolean; message: string } | undefined;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type RecordField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "select" | "textarea" | "checkbox";
  value?: string | boolean | null;
  options?: { value: string; label: string }[];
  step?: string;
  min?: string;
  required?: boolean;
};

const IconEdit = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></svg>
);
const IconTrash = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
);

// The one Edit / Delete control for a single record, used on every list that
// shows saved data (cow history, team, payments...). Which buttons appear is
// decided by the page from the user's role (canEdit / canDelete); the server
// action behind each one re-checks the permission regardless.
export default function RecordActions({
  id,
  title,
  fields,
  updateAction,
  deleteAction,
  deleteConfirm,
  canEdit = true,
  canDelete = true,
  hidden,
}: {
  id: string;
  title: string;
  fields?: RecordField[];
  updateAction?: Action;
  deleteAction?: Action;
  deleteConfirm?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  hidden?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const showEdit = canEdit && !!updateAction && !!fields;
  const showDelete = canDelete && !!deleteAction;
  if (!showEdit && !showDelete) return null;

  return (
    <div className="inline-flex items-center gap-1.5 align-middle">
      {showEdit && (
        <button type="button" onClick={() => setOpen(true)} title="Edit" aria-label={`Edit ${title}`} className="p-1.5 rounded border border-border text-text-muted hover:bg-primary-light">
          {IconEdit}
        </button>
      )}
      {showDelete && (
        <DeleteRowButton
          action={deleteAction!}
          hiddenFields={{ id, ...(hidden ?? {}) }}
          confirmMessage={deleteConfirm ?? `Delete ${title}? This cannot be undone.`}
          icon={IconTrash}
        />
      )}
      {open && showEdit && (
        <EditModal id={id} title={title} fields={fields!} action={updateAction!} hidden={hidden} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function EditModal({
  id,
  title,
  fields,
  action,
  hidden,
  onClose,
}: {
  id: string;
  title: string;
  fields: RecordField[];
  action: Action;
  hidden?: Record<string, string>;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(action, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      const t = setTimeout(onClose, 700);
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

  const input = "w-full border border-border rounded-md px-3 py-2 text-base";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 text-left sm:items-center sm:px-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-green-900 to-green-700 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">Edit record</h2>
            <p className="mt-0.5 truncate text-xs text-green-100">{title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-8 w-8 shrink-0 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20">✕</button>
        </div>
        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          <input type="hidden" name="id" value={id} />
          {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.name} className={`flex flex-col gap-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-sm font-semibold text-text">
                    <input type="checkbox" name={f.name} defaultChecked={!!f.value} /> {f.label}
                  </label>
                ) : (
                  <>
                    <label htmlFor={`ed-${f.name}`} className="text-sm font-semibold text-text">{f.label}</label>
                    {f.type === "select" ? (
                      <select id={`ed-${f.name}`} name={f.name} defaultValue={String(f.value ?? "")} required={f.required} className={input}>
                        {!f.required && <option value="">—</option>}
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea id={`ed-${f.name}`} name={f.name} defaultValue={String(f.value ?? "")} rows={2} className={input} />
                    ) : (
                      <input id={`ed-${f.name}`} name={f.name} type={f.type ?? "text"} step={f.step} min={f.min} defaultValue={String(f.value ?? "")} required={f.required} className={input} />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          {state && <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">{state.message}</p>}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text-muted hover:bg-primary-light">Cancel</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
