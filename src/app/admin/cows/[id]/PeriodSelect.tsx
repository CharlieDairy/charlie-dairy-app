"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default function PeriodSelect({ period }: { period: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={period}
      onChange={(e) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("period", e.target.value);
        router.push(`?${next.toString()}`);
      }}
      className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm bg-white"
    >
      {OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}
