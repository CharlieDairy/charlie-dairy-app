import type { Comparison } from "@/lib/compare";

// Never rely on color alone -- the arrow glyph carries the meaning too, same
// convention as Badge's tone symbols. The glyph always reflects what the
// number actually did (▲ = went up); only the COLOR is inverted for
// "lower is better" metrics like cost or consumption, so a falling number
// never gets displayed with a rising arrow.
const GLYPH: Record<Comparison["trend"], string> = { up: "▲", down: "▼", flat: "▪" };
const GOOD_COLOR = "text-primary";
const BAD_COLOR = "text-danger";
const NEUTRAL_COLOR = "text-text-muted";

export default function TrendStat({
  label,
  value,
  comparison,
  invertTone = false,
}: {
  label: string;
  value: string;
  comparison: Comparison;
  /** For metrics where "down" is actually good (e.g. expenses, feed cost) -- swaps only the coloring, never the arrow direction. */
  invertTone?: boolean;
}) {
  const isGood = invertTone ? comparison.trend === "down" : comparison.trend === "up";
  const color = comparison.trend === "flat" ? NEUTRAL_COLOR : isGood ? GOOD_COLOR : BAD_COLOR;

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-neutral-900">{value}</div>
      <div className={`text-xs mt-1 flex items-center gap-1 ${color}`}>
        <span aria-hidden="true">{GLYPH[comparison.trend]}</span>
        {comparison.deltaPct !== null ? `${Math.abs(comparison.deltaPct).toFixed(0)}%` : "—"}
        <span className="text-text-muted">vs last month</span>
      </div>
    </div>
  );
}
