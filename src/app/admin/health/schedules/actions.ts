"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireAccess, runAction } from "@/lib/access";
import { reqEnum, reqNum, reqText, reqId } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const SCHEDULE_TYPES = ["VACCINATION", "DEWORMING", "CHECKUP"] as const;

export async function addHealthSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addHealthScheduleImpl(formData));
}

async function addHealthScheduleImpl(formData: FormData): Promise<FormState> {
  await requirePermission("health", "CREATE");
  const name = reqText(formData, "name", "Schedule name", { max: 100 });
  const type = reqEnum(formData, "type", "Type", SCHEDULE_TYPES);
  const intervalDays = reqNum(formData, "intervalDays", "Interval (days)", { positive: true, max: 3650, decimals: 0 });

  await prisma.healthSchedule.create({ data: { name, type, intervalDays } });

  revalidatePath("/admin/health/schedules");
  return { success: true, message: `Schedule "${name}" added.` };
}

export async function toggleHealthScheduleActive(formData: FormData): Promise<void> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Schedule");
  const active = formData.get("active") === "true";
  await prisma.healthSchedule.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/health/schedules");
}

export async function deleteHealthSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteHealthScheduleImpl(formData));
}

async function deleteHealthScheduleImpl(formData: FormData): Promise<FormState> {
  await requirePermission("health", "DELETE");
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Schedule");
  await prisma.healthSchedule.delete({ where: { id } });
  revalidatePath("/admin/health/schedules");
  return { success: true, message: "Schedule deleted." };
}
