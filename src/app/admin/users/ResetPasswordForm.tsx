"use client";

import { useActionState, useRef, useEffect } from "react";
import { resetPassword, type FormState } from "./actions";

export default function ResetPasswordForm({ userId, username }: { userId: string; username: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(resetPassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      if (detailsRef.current) detailsRef.current.open = false;
    }
  }, [state]);

  return (
    <details ref={detailsRef} className="text-sm">
      <summary className="cursor-pointer rounded px-2 py-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 inline-block select-none">
        Reset Password
      </summary>
      <form ref={formRef} action={formAction} className="flex flex-col gap-2 bg-neutral-50 border border-neutral-200 rounded-md p-2 mt-2">
        <input type="hidden" name="userId" value={userId} />
        <label className="text-xs text-neutral-600">New password for {username}</label>
        <input
          name="newPassword"
          type="password"
          minLength={8}
          required
          className="border border-neutral-300 rounded px-2 py-1 text-sm"
        />
        <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1 text-sm disabled:opacity-60 w-fit">
          {isPending ? "Saving…" : "Save"}
        </button>
        {state && !state.success && <p className="text-xs text-red-600">{state.message}</p>}
      </form>
    </details>
  );
}
