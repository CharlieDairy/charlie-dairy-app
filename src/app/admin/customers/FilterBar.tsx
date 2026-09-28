"use client";

import { useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
];
const PERIOD_OPTIONS = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default function FilterBar({ status, period }: { status: string; period: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
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
