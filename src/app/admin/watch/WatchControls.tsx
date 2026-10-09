"use client";

import { useActionState } from "react";
import { generateAiReview, runWatchNow, type FormState } from "./actions";

export function RunCheckButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(runWatchNow, undefined);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <button type="submit" disabled={pending || disabled} className="rounded-lg border border-primary bg-white px-4 py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary-light disabled:opacity-60">
        {pending ? "Checking all records…" : "Run check now"}
      </button>
      {state && <p className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`} role="status">{state.message}</p>}
    </form>
  );
}

export function AiReviewButton({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(generateAiReview, undefined);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <button type="submit" disabled={pending || !configured} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60" title={configured ? "" : "Add ANTHROPIC_API_KEY in Vercel to switch this on"}>
        {pending ? "Reading your records… up to a minute" : "Generate AI review"}
      </button>
      {!configured && <p className="max-w-xs text-xs text-text-muted">Not switched on yet: add an Anthropic API key in the Vercel project settings.</p>}
      {state && <p className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`} role="status">{state.message}</p>}
    </form>
  );
}
