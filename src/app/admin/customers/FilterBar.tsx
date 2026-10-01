"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PERIOD_COOKIE, PERIOD_OPTIONS } from "@/lib/periodOptions";

const STATUS_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
];

export default function FilterBar({ status, period }: { status: string; period: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    // Customers, Production Reconciliation and Milk Sales are cross-linked --
    // this cookie (read server-side by lib/period.ts resolvePeriod) lets the
    // period selected here carry over when navigating to either of those.
    if (key === "period") {
      document.cookie = `${PERIOD_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={status}
        onChange={(e) => updateParam("status", e.target.value)}
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => updateParam("period", e.target.value)}
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
