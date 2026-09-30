import { prisma } from "@/lib/prisma";

// Channab-style per-animal health score: 0-100, computed live from real
// vaccination/treatment data (never stored, so it can't go stale) using
// admin-configurable weights (see ScoringFactor / "Scoring Setup"). Three
// factors by design choice: vaccination compliance, treatment frequency and
// health check-in recency -- all signals already recorded elsewhere in the
// app, deliberately not counting a free-text "condition" field that isn't
// entered consistently enough to score.

export type ScoreCategory = "Excellent" | "Good" | "Fair" | "Poor";

export const SCORE_CATEGORY_RANGES: { category: ScoreCategory; min: number; max: number }[] = [
  { category: "Excellent", min: 80, max: 100 },
  { category: "Good", min: 60, max: 79 },
  { category: "Fair", min: 40, max: 59 },
  { category: "Poor", min: 0, max: 39 },
];

export function categoryFor(score: number): ScoreCategory {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

export type ScoringWeights = { key: string; label: string; weightPct: number }[];

export async function getScoringWeights(): Promise<ScoringWeights> {
  const rows = await prisma.scoringFactor.findMany({ orderBy: { key: "asc" } });
  return rows.map((r) => ({ key: r.key, label: r.label, weightPct: r.weightPct }));
}

type FactorBreakdown = { key: string; label: string; weightPct: number; rawPct: number; issue: string | null };

export type CowScore = {
  score: number;
  category: ScoreCategory;
  factors: FactorBreakdown[];
  issues: string[];
};

type VaxInput = { date: Date; nextDueDate: Date | null };
type TxInput = { date: Date };

function scoreVaccinationCompliance(vaccinations: VaxInput[], referenceDate: Date): { rawPct: number; issue: string | null } {
  if (vaccinations.length === 0) return { rawPct: 25, issue: "No vaccination on record" };
  const mostRecent = [...vaccinations].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  if (!mostRecent.nextDueDate) return { rawPct: 70, issue: null };
  const daysOverdue = (referenceDate.getTime() - mostRecent.nextDueDate.getTime()) / 86_400_000;
  if (daysOverdue <= 0) return { rawPct: 100, issue: null };
  if (daysOverdue <= 30) return { rawPct: 50, issue: "Vaccination overdue" };
  return { rawPct: 0, issue: "Vaccination significantly overdue" };
}

function scoreTreatmentFrequency(treatments: TxInput[], referenceDate: Date): { rawPct: number; issue: string | null } {
  const cutoff = referenceDate.getTime() - 90 * 86_400_000;
  const recent = treatments.filter((t) => t.date.getTime() >= cutoff).length;
  if (recent === 0) return { rawPct: 100, issue: null };
  if (recent === 1) return { rawPct: 70, issue: null };
  if (recent === 2) return { rawPct: 40, issue: "Multiple recent treatments" };
  return { rawPct: 10, issue: "Frequent recent treatments" };
}

function scoreHealthRecency(vaccinations: VaxInput[], treatments: TxInput[], referenceDate: Date): { rawPct: number; issue: string | null } {
  const dates = [...vaccinations.map((v) => v.date), ...treatments.map((t) => t.date)];
  if (dates.length === 0) return { rawPct: 0, issue: "No health records on file" };
  const lastEvent = Math.max(...dates.map((d) => d.getTime()));
  const daysSince = (referenceDate.getTime() - lastEvent) / 86_400_000;
  if (daysSince <= 60) return { rawPct: 100, issue: null };
  if (daysSince <= 120) return { rawPct: 60, issue: null };
  if (daysSince <= 365) return { rawPct: 30, issue: "No recent health check-in" };
  return { rawPct: 0, issue: "No health check-in over a year" };
}

export function computeCowScore(
  vaccinations: VaxInput[],
  treatments: TxInput[],
  weights: ScoringWeights,
  referenceDate = new Date()
): CowScore {
  const raw: Record<string, { rawPct: number; issue: string | null }> = {
    VACCINATION_COMPLIANCE: scoreVaccinationCompliance(vaccinations, referenceDate),
    TREATMENT_FREQUENCY: scoreTreatmentFrequency(treatments, referenceDate),
    HEALTH_RECENCY: scoreHealthRecency(vaccinations, treatments, referenceDate),
  };

  const factors: FactorBreakdown[] = weights.map((w) => ({
    key: w.key,
    label: w.label,
    weightPct: w.weightPct,
    rawPct: raw[w.key]?.rawPct ?? 0,
    issue: raw[w.key]?.issue ?? null,
  }));

  const score = Math.round(factors.reduce((sum, f) => sum + (f.rawPct * f.weightPct) / 100, 0));

  return {
    score,
    category: categoryFor(score),
    factors,
    issues: factors.map((f) => f.issue).filter((i): i is string => i !== null),
  };
}

export type HerdScoreRow = { cowId: string; tag: string } & CowScore;

export async function getHerdScores(referenceDate = new Date()): Promise<HerdScoreRow[]> {
  const weights = await getScoringWeights();
  const cows = await prisma.cow.findMany({
    where: { status: { notIn: ["SOLD", "DEAD"] } },
    select: { id: true, tag: true },
  });
  const cowIds = cows.map((c) => c.id);

  const [vaccinations, treatments] = await Promise.all([
    prisma.vaccinationRecord.findMany({ where: { cowId: { in: cowIds } }, select: { cowId: true, date: true, nextDueDate: true } }),
    prisma.treatmentRecord.findMany({ where: { cowId: { in: cowIds } }, select: { cowId: true, date: true } }),
  ]);

  const vaxByCow = new Map<string, VaxInput[]>();
  for (const v of vaccinations) {
    if (!vaxByCow.has(v.cowId)) vaxByCow.set(v.cowId, []);
    vaxByCow.get(v.cowId)!.push({ date: v.date, nextDueDate: v.nextDueDate });
  }
  const txByCow = new Map<string, TxInput[]>();
  for (const t of treatments) {
    if (!txByCow.has(t.cowId)) txByCow.set(t.cowId, []);
    txByCow.get(t.cowId)!.push({ date: t.date });
  }

  return cows
    .map((c) => ({
      cowId: c.id,
      tag: c.tag,
      ...computeCowScore(vaxByCow.get(c.id) ?? [], txByCow.get(c.id) ?? [], weights, referenceDate),
    }))
    .sort((a, b) => b.score - a.score);
}

export async function getCowScore(cowId: string, referenceDate = new Date()): Promise<CowScore> {
  const weights = await getScoringWeights();
  const [vaccinations, treatments] = await Promise.all([
    prisma.vaccinationRecord.findMany({ where: { cowId }, select: { date: true, nextDueDate: true } }),
    prisma.treatmentRecord.findMany({ where: { cowId }, select: { date: true } }),
  ]);
  return computeCowScore(vaccinations, treatments, weights, referenceDate);
}
