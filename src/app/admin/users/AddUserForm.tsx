"use client";

import { useActionState, useRef, useEffect } from "react";
import { createUser, type FormState } from "./actions";

export default function AddUserForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(createUser, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">Name</label>
        <input id="name" name="name" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium text-neutral-700">Username</label>
        <input id="username" name="username" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-neutral-700">Role</label>
        <select id="role" name="role" required defaultValue="ENTRY" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="ENTRY">ENTRY — data entry only</option>
          <option value="ADMIN">ADMIN — full access</option>
        </select>
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add User"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
