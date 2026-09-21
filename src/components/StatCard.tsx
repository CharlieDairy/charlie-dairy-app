export default function StatCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  const toneClass = tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-neutral-900";
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
