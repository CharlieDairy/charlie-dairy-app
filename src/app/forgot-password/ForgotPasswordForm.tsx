"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordForm() {
  const [message, formAction, isPending] = useActionState(requestPasswordReset, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium text-neutral-700">
          Username
        </label>
        <input id="username" name="username" type="text" required autoFocus className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {message && (
        <p className="text-sm text-green-700" role="status">
          {message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Sending…" : "Request password reset"}
      </button>
    </form>
  );
}
