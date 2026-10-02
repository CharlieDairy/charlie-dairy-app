"use client";

import { useActionState } from "react";
import { createResetLink, type FormState } from "./actions";
import LinkResult from "./LinkResult";

export default function ResetLinkButton({ userId, requested }: { userId: string; requested: boolean }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(createResetLink, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2 items-start">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={isPending} className="link-btn">
        {isPending ? "Creating…" : requested ? "Send reset link (requested)" : "Reset link"}
      </button>
      {state?.success && state.link && <LinkResult message={state.message} link={state.link} />}
      {state && !state.success && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
