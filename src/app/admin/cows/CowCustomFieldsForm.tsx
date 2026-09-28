"use client";

import { useActionState } from "react";
import { updateCowCustomFields, type FormState } from "./custom-fields/actions";

type FieldDef = { id: string; label: string; fieldType: string };

const INPUT_TYPE: Record<string, string> = { TEXT: "text", NUMBER: "number", DATE: "date" };

export default function CowCustomFieldsForm({
  cowId,
  fields,
}: {
  cowId: string;
  fields: { def: FieldDef; value: string }[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateCowCustomFields, undefined);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No custom fields defined yet — add some under Herd → Custom Fields.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="cowId" value={cowId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ def, value }) => (
          <div key={def.id} className="flex flex-col gap-1">
            <label htmlFor={`field_${def.id}`} className="text-sm font-medium text-neutral-700">{def.label}</label>
            <input
              id={`field_${def.id}`}
              name={`field_${def.id}`}
              type={INPUT_TYPE[def.fieldType] ?? "text"}
              defaultValue={value}
              step={def.fieldType === "NUMBER" ? "any" : undefined}
              className="border border-neutral-300 rounded-md px-3 py-2 text-base"
            />
          </div>
        ))}
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="self-start bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Custom Fields"}
      </button>
    </form>
  );
}
