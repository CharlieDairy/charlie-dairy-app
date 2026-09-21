"use client";

import { useRouter } from "next/navigation";

export default function YearSelector({ years, selected }: { years: number[]; selected: number }) {
  const router = useRouter();
  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/admin?year=${e.target.value}`)}
      className="border border-neutral-300 rounded-md px-2 py-1 text-sm bg-white"
    >
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
