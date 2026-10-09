"use client";

import { useActionState } from "react";
import { setFindingStatus, type FormState } from "./actions";

function StatusButton({ id, status, label, days, tone = "plain" }: { id: string; status: "OPEN" | "ACKNOWLEDGED" | "SNOOZED" | "RESOLVED"; label: string; days?: number; tone?: "plain" | "good" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setFindingStatus, undefined);
  return (
    <form action={action} className="inline-flex flex-col">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {days ? <input type="hidden" name="days" value={days} /> : null}
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${tone === "good" ? "border-green-200 text-green-800 hover:bg-green-50" : "border-border text-text-muted hover:bg-primary-light"}`}
      >
        {pending ? "…" : label}
      </button>
      {state && !state.success && <span className="mt-1 max-w-[12rem] text-[11px] text-red-600">{state.message}</span>}
    </form>
  );
}

export default function FindingActions({ id, status, canAct }: { id: string; status: string; canAct: boolean }) {
  if (!canAct) return null;
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {status === "OPEN" && <StatusButton id={id} status="ACKNOWLEDGED" label="Acknowledge" />}
      {status !== "SNOOZED" && status !== "RESOLVED" && <StatusButton id={id} status="SNOOZED" days={7} label="Hide 7 days" />}
      {status !== "RESOLVED" && <StatusButton id={id} status="RESOLVED" label="Mark resolved" tone="good" />}
      {status !== "OPEN" && <StatusButton id={id} status="OPEN" label="Reopen" />}
    </div>
  );
}
