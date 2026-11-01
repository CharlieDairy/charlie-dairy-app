"use client";

import { useActionState } from "react";
import { approveDeletionRequest, rejectDeletionRequest, type FormState } from "./actions";

// Approve (deletes the record for real) or reject (keeps it) one waiting request.
export default function ApprovalButtons({ id, summary }: { id: string; summary: string }) {
  const [approved, approve, approving] = useActionState<FormState, FormData>(approveDeletionRequest, undefined);
  const [rejected, reject, rejecting] = useActionState<FormState, FormData>(rejectDeletionRequest, undefined);
  const busy = approving || rejecting;
  const state = approved ?? rejected;

  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={approve}
          onSubmit={(e) => {
            if (!confirm(`Approve and delete this for good?\n\n${summary}`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={busy} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {approving ? "Deleting…" : "Approve & delete"}
          </button>
        </form>
        <form action={reject} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="note" maxLength={300} placeholder="Reason (optional)" aria-label="Reason for keeping it" className="min-w-0 w-36 rounded-lg border border-border px-2 py-2 text-xs" />
          <button type="submit" disabled={busy} className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-text-muted hover:bg-primary-light disabled:opacity-60">
            {rejecting ? "Saving…" : "Keep it (reject)"}
          </button>
        </form>
      </div>
      {state && <p className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`} role="status">{state.message}</p>}
    </div>
  );
}
