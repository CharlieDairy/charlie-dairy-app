"use client";

import { useActionState } from "react";
import { setPasswordWithToken } from "./actions";

export default function SetPasswordForm({ token }: { token: string }) {
  const [error, formAction, isPending] = useActionState(setPasswordWithToken, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">
          New password
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoFocus className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <p className="text-xs text-neutral-400">At least 8 characters.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium text-neutral-700">
          Confirm password
        </label>
        <input id="confirm" name="confirm" type="password" required minLength={8} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
