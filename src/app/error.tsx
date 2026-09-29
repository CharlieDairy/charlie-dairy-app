"use client";

import { useEffect } from "react";

// Catches anything that throws while a page renders (e.g. the database being
// briefly unreachable) so people see a calm message with a retry button
// instead of a blank screen. Form-action errors are handled separately by
// runAction() in src/lib/access.ts and show inline on the form.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md bg-white border border-neutral-200 rounded-lg p-6 text-center flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">Something went wrong</h1>
        <p className="text-sm text-neutral-600">
          This page couldn&apos;t be loaded. Nothing you entered has been lost. Please try again, and if it keeps
          happening let the administrator know.
        </p>
        {error.digest && <p className="text-xs text-neutral-400">Reference: {error.digest}</p>}
        <div className="flex justify-center gap-3">
          <button onClick={() => retry()} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium">
            Try again
          </button>
          <a href="/" className="border border-neutral-300 text-neutral-700 rounded-md px-4 py-2 font-medium">
            Home
          </a>
        </div>
      </div>
    </main>
  );
}
