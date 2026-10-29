"use client";

import { useActionState } from "react";
import { backupToDriveNow, type FormState } from "./actions";

export default function BackupNowButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(backupToDriveNow, undefined);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <button type="submit" disabled={pending} className="rounded-lg border border-primary bg-white px-4 py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary-light disabled:opacity-60">
        {pending ? "Backing up to Google Drive…" : "Back up to Google Drive now"}
      </button>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
