import Link from "next/link";
import { getHerdScores, SCORE_CATEGORY_RANGES, type ScoreCategory } from "@/lib/reports/scoring";
import StatCard from "@/components/StatCard";
import ScoreDistributionChart from "./ScoreDistributionChart";

const CATEGORY_BG: Record<ScoreCategory, string> = {
  Excellent: "bg-green-700",
  Good: "bg-amber-500",
  Fair: "bg-orange-500",
  Poor: "bg-red-600",
};

const BAR_COLOR: Record<ScoreCategory, string> = {
  Excellent: "bg-green-700",
  Good: "bg-amber-500",
  Fair: "bg-orange-500",
  Poor: "bg-red-600",
};

function ScoreBar({ score, category }: { score: number; category: ScoreCategory }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden min-w-[60px]">
        <div className={`h-full ${BAR_COLOR[category]}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-neutral-500 w-14 text-right">{score}/100</span>
    </div>
  );
}

export default async function ScoreDashboardPage() {
  const scores = await getHerdScores();
  const total = scores.length;
  const avg = total > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / total) : 0;

  const byCategory: Record<ScoreCategory, number> = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
  for (const r of scores) byCategory[r.category]++;

  const topPerformers = scores.slice(0, 10);
  const needingAttention = [...scores]
    .filter((r) => r.category === "Poor" || r.category === "Fair")
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Score Dashboard</h1>
          <p className="text-base font-semibold text-neutral-600">
            A live health score (0-100) per active animal, computed from vaccination compliance, treatment
            frequency and how recently each was last checked. Nothing to recalculate — it&apos;s always current.
          </p>
        </div>
        <Link href="/admin/health/scoring/setup" className="link-btn">
          Scoring Setup →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Total Active Animals" value={String(total)} />
        <StatCard label="Average Score" value={`${avg}/100`} />
        <StatCard label="Excellent (80+)" value={String(byCategory.Excellent)} tone="positive" />
        <StatCard label="Need Attention" value={String(byCategory.Poor)} tone={byCategory.Poor > 0 ? "negative" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">Score Distribution</h2>
          <ScoreDistributionChart
            data={[
              { category: "Excellent", count: byCategory.Excellent },
              { category: "Good", count: byCategory.Good },
              { category: "Fair", count: byCategory.Fair },
              { category: "Poor", count: byCategory.Poor },
            ]}
          />
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">Score Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {SCORE_CATEGORY_RANGES.map((r) => (
              <div key={r.category} className={`rounded-lg p-4 text-white ${CATEGORY_BG[r.category]}`}>
                <div className="text-2xl font-bold">{byCategory[r.category]}</div>
                <div className="text-sm">
                  {r.category} ({r.min}
                  {r.max === 100 ? "+" : `-${r.max}`})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">Top Performing Animals</h2>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-neutral-400">No active animals to score yet.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="text-left py-1 font-normal">#</th>
                  <th className="text-left py-1 font-normal">Tag</th>
                  <th className="text-left py-1 font-normal">Score</th>
                  <th className="text-left py-1 font-normal">Category</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((r, i) => (
                  <tr key={r.cowId} className="border-t border-neutral-100">
                    <td className="py-2 text-neutral-500">#{i + 1}</td>
                    <td className="py-2">
                      <Link href={`/admin/cows/${r.cowId}`} className="text-green-700 hover:underline font-medium">
                        {r.tag}
                      </Link>
                    </td>
                    <td className="py-2 w-40"><ScoreBar score={r.score} category={r.category} /></td>
                    <td className="py-2 text-neutral-500">{r.category}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">Animals Needing Attention</h2>
          {needingAttention.length === 0 ? (
            <p className="text-sm text-neutral-400">No animals currently flagged.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="text-left py-1 font-normal">Tag</th>
                  <th className="text-left py-1 font-normal">Score</th>
                  <th className="text-left py-1 font-normal">Issues</th>
                </tr>
              </thead>
              <tbody>
                {needingAttention.map((r) => (
                  <tr key={r.cowId} className="border-t border-neutral-100">
                    <td className="py-2">
                      <Link href={`/admin/cows/${r.cowId}`} className="text-green-700 hover:underline font-medium">
                        {r.tag}
                      </Link>
                    </td>
                    <td className="py-2 w-32"><ScoreBar score={r.score} category={r.category} /></td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.issues.map((issue) => (
                          <span key={issue} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}
