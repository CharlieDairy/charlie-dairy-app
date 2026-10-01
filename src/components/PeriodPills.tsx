"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PERIOD_COOKIE, PERIOD_OPTIONS } from "@/lib/periodOptions";

export default function PeriodPills({ period }: { period: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(key: string) {
    document.cookie = `${PERIOD_COOKIE}=${key}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {PERIOD_OPTIONS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => select(p.key)}
          className={`text-xs rounded-full px-3 py-1.5 border ${
            period === p.key ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
