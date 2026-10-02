"use client";

import { useState } from "react";

// Shows a one-time invite/reset link with a Copy button. The link is the only
// way the person can set their password, so it's displayed once, right here.
export default function LinkResult({ message, link }: { message: string; link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="w-full rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex flex-col gap-2">
      <p>{message}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-[260px] border border-green-200 bg-white rounded px-2 py-1 text-xs text-neutral-700" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked: the field above is selectable */
            }
          }}
          className="link-btn"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
