"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PERIOD_COOKIE, PERIOD_OPTIONS } from "@/lib/periodOptions";

export default function PeriodSelect({ period }: { period: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={period}
      onChange={(e) => {
        // Milk Sales, Production Reconciliation and Customers are
        // cross-linked -- this cookie (read server-side by
        // lib/period.ts resolvePeriod) lets the period selected here
        // carry over when navigating to either of those.
        document.cookie = `${PERIOD_COOKIE}=${e.target.value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        const next = new URLSearchParams(searchParams.toString());
        next.set("period", e.target.value);
        router.push(`?${next.toString()}`);
      }}
      className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
    >
      {PERIOD_OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}
