"use client";

import { useActionState } from "react";
import { authenticate } from "./actions";

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium text-neutral-700">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoFocus
          className="border border-neutral-300 rounded-md px-3 py-2 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="border border-neutral-300 rounded-md px-3 py-2 text-base"
        />
      </div>
      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
