"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess, runAction } from "@/lib/access";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import { activityNotice, validFarmDay } from "@/lib/dailyActivity";

// Only the Admin can mark the farm manager's day as reviewed. A day can only be reviewed once it is over.

export type FormState = { success: boolean; message: string } | undefined;

async function markReviewed(days: string[], admin: { id: string; name: string }) {
  for (const day of days) {
    await prisma.activityReview.upsert({
      where: { day },
      create: { day, reviewedById: admin.id, reviewedBy: admin.name },
      update: { reviewedById: admin.id, reviewedBy: admin.name, reviewedAt: new Date() },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
}

export async function reviewDay(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const admin = await requireAccess({ admin: true });
    const day = validFarmDay(String(formData.get("day") ?? ""));
    if (!day) return { success: false, message: "That is not a valid day." };
    if (day >= farmDateKey()) return { success: false, message: "Today is not over yet. Review it tomorrow, so later entries are not missed." };
    await markReviewed([day], admin);
    return { success: true, message: `${day} marked as reviewed.` };
  });
}

export async function reviewAllPastDays(): Promise<FormState> {
  return runAction(async () => {
    const admin = await requireAccess({ admin: true });
    const notice = await activityNotice(14);
    const days = notice?.pastDays.map((d) => d.day) ?? [];
    if (!days.length) return { success: true, message: "Nothing is waiting for review." };
    await markReviewed(days, admin);
    return { success: true, message: `${days.length} day${days.length === 1 ? "" : "s"} marked as reviewed.` };
  });
}
