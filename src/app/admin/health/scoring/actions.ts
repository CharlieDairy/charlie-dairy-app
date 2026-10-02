"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqNum } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const FACTOR_KEYS = ["VACCINATION_COMPLIANCE", "TREATMENT_FREQUENCY", "HEALTH_RECENCY"] as const;

export async function updateScoringWeights(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateScoringWeightsImpl(formData));
}

async function updateScoringWeightsImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });

  const weights = FACTOR_KEYS.map((key) => ({
    key,
    weightPct: reqNum(formData, `weight_${key}`, "Weight", { min: 0, max: 100, decimals: 0 }),
  }));

  const total = weights.reduce((sum, w) => sum + w.weightPct, 0);
  if (total !== 100) throw new ValidationError(`Weights must add up to 100% (currently ${total}%).`);

  await prisma.$transaction(
    weights.map((w) => prisma.scoringFactor.update({ where: { key: w.key }, data: { weightPct: w.weightPct } }))
  );

  revalidatePath("/admin/health/scoring");
  revalidatePath("/admin/health/scoring/setup");
  return { success: true, message: "Scoring weights saved." };
}

export async function resetScoringWeights(_prev: FormState, _formData: FormData): Promise<FormState> {
  return runAction(() => resetScoringWeightsImpl());
}

async function resetScoringWeightsImpl(): Promise<FormState> {
  await requireAccess({ admin: true });
  await prisma.$transaction([
    prisma.scoringFactor.update({ where: { key: "VACCINATION_COMPLIANCE" }, data: { weightPct: 40 } }),
    prisma.scoringFactor.update({ where: { key: "TREATMENT_FREQUENCY" }, data: { weightPct: 30 } }),
    prisma.scoringFactor.update({ where: { key: "HEALTH_RECENCY" }, data: { weightPct: 30 } }),
  ]);
  revalidatePath("/admin/health/scoring");
  revalidatePath("/admin/health/scoring/setup");
  return { success: true, message: "Reset to default weights." };
}
