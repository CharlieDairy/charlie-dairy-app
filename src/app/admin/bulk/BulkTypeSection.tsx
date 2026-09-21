"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { uploadBulkData } from "./actions";
import type { BulkTypeMeta, ImportResult } from "@/lib/bulk/types";

export default function BulkTypeSection({ meta }: { meta: BulkTypeMeta }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, formAction, isPending] = useActionState<ImportResult | undefined, FormData>(uploadBulkData, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const params = new URLSearchParams({ type: meta.key });
  if (meta.hasDateFilter && from) params.set("from", from);
  if (meta.hasDateFilter && to) params.set("to", to);
  const downloadUrl = `/api/bulk/export?${params.toString()}`;
  const templateUrl = `/api/bulk/export?type=${meta.key}&template=1`;

  return (
    <details className="bg-white border border-neutral-200 rounded-lg">
      <summary className="cursor-pointer select-none px-4 py-3 font-medium text-neutral-900">
        {meta.label}
        {!meta.importable && <span className="ml-2 text-xs font-normal text-neutral-400">(download only)</span>}
      </summary>
      <div className="px-4 pb-4 flex flex-col gap-4 border-t border-neutral-100 pt-4">
        <div>
          <p className="text-sm font-medium text-neutral-700 mb-2">Download</p>
          <div className="flex flex-wrap items-end gap-3">
            {meta.hasDateFilter && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">From</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-neutral-300 rounded-md px-2 py-1 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">To</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-neutral-300 rounded-md px-2 py-1 text-sm" />
                </div>
              </>
            )}
            <a href={downloadUrl} className="bg-green-700 text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-green-800">
              Download CSV{meta.hasDateFilter && !from && !to ? " (all)" : ""}
            </a>
            <a href={templateUrl} className="text-sm text-neutral-500 underline">
              Download blank template
            </a>
          </div>
        </div>

        {meta.importable && (
          <div className="border-t border-neutral-100 pt-4">
            <p className="text-sm font-medium text-neutral-700 mb-2">Bulk Upload</p>
            <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="type" value={meta.key} />
              <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
              <button type="submit" disabled={isPending} className="bg-neutral-800 text-white rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60">
                {isPending ? "Uploading…" : "Upload"}
              </button>
            </form>
            <p className="text-xs text-neutral-400 mt-1">
              Columns must match the template: {meta.headers.join(", ")}. Nothing is imported if any row has an error —
              you&apos;ll get a full error list to fix and re-upload.
            </p>
            {state && (
              <div className={`mt-2 text-sm ${state.success ? "text-green-700" : "text-red-600"}`}>
                <p>{state.message}</p>
                {state.errors.length > 0 && (
                  <ul className="list-disc list-inside mt-1 max-h-48 overflow-y-auto">
                    {state.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
