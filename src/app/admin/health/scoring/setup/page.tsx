import Link from "next/link";
import { getScoringWeights } from "@/lib/reports/scoring";
import ScoringWeightsForm from "./ScoringWeightsForm";

export default async function ScoringSetupPage() {
  const weights = await getScoringWeights();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/health/scoring" className="link-btn">← Back to Score Dashboard</Link>
        <h1 className="text-2xl font-semibold text-neutral-900 mt-1">Scoring Setup</h1>
        <p className="text-base font-semibold text-neutral-600">
          Customize how much each factor counts toward an animal&apos;s health score. Weights must add up to 100%.
        </p>
      </div>
      <ScoringWeightsForm weights={weights} />
    </div>
  );
}
