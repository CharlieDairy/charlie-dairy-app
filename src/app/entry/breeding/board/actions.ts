"use server";

import { revalidatePath } from "next/cache";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import { farmTimeNow } from "@/lib/cashStamp";
import { validFarmDay } from "@/lib/dailyActivity";
import { recordInsemination } from "../ai/actions";
import { recordPregnancyCheck } from "../pregnancy-check/actions";
import { recordHeat } from "../heat/actions";

// One-tap breeding updates for the farm manager. Each button calls the same action as the full form on the Reproduction
// Entry page (same checks, same permission, same effect on the animal's dates), with only the animal, the date and the
// button's meaning filled in.

export type FormState = { success: boolean; message: string } | undefined;

const KINDS = ["heat", "ai", "pregnant", "open"] as const;

export async function boardAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const kind = String(formData.get("kind") ?? "");
  const cowId = String(formData.get("cowId") ?? "");
  if (!(KINDS as readonly string[]).includes(kind) || !cowId) return { success: false, message: "Nothing was saved: the request was incomplete." };

  const today = farmDateKey();
  const day = validFarmDay(String(formData.get("date") ?? "")) ?? today;
  if (day > today) return { success: false, message: "That date is in the future." };

  const f = new FormData();
  f.set("cowId", cowId);
  let result: FormState;
  if (kind === "ai") {
    f.set("date", day);
    f.set("method", "AI");
    result = await recordInsemination(undefined, f);
  } else if (kind === "heat") {
    f.set("detectedAt", `${day}T${day === today ? farmTimeNow().slice(0, 5) : "08:00"}`);
    f.set("detectionMethod", "VISUAL");
    result = await recordHeat(undefined, f);
  } else {
    f.set("date", day);
    f.set("method", "PALPATION");
    f.set("result", kind === "pregnant" ? "PREGNANT" : "OPEN");
    result = await recordPregnancyCheck(undefined, f);
  }

  if (result?.success) {
    revalidatePath("/entry/breeding/board");
    revalidatePath("/admin/cows");
    revalidatePath("/admin");
  }
  return result;
}
