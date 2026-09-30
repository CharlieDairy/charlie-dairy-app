import type { ReactNode } from "react";

const CHIP_TONE: Record<string, string> = {
  positive: "bg-green-50 text-green-600",
  negative: "bg-red-50 text-red-600",
  neutral: "bg-neutral-100 text-neutral-500",
};

export default function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
}) {
  const toneClass = tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-neutral-900";
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
        {icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${CHIP_TONE[tone ?? "neutral"]}`}>
            {icon}
          </span>
        )}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
