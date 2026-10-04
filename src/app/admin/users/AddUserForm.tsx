"use client";

import { useActionState, useRef, useEffect } from "react";
import { createUser, type FormState } from "./actions";
import LinkResult from "./LinkResult";

export default function AddUserForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(createUser, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">Name</label>
        <input id="name" name="name" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium text-neutral-700">Username</label>
        <input id="username" name="username" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-neutral-700">Role</label>
        <select id="role" name="role" required defaultValue="VIEWER" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="VIEWER">View Only — can see everything except Admin &amp; finance statements</option>
          <option value="EDITOR">Editor — can add, edit and delete (no Admin &amp; finance statements)</option>
          <option value="ADMIN">Admin — full access</option>
        </select>
      </div>
      <button type="submit" disabled={isPending} className="link-btn link-btn-primary">
        {isPending ? "Creating…" : "Create & get invite link"}
      </button>
      {state?.success && state.link ? (
        <LinkResult message={state.message} link={state.link} />
      ) : (
        state && <p className="text-sm w-full text-red-600">{state.message}</p>
      )}
    </form>
  );
}
