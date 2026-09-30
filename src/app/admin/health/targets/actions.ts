"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqEnum, reqNum, reqId, optDate } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const TARGET_TYPES = ["MILK_DAILY", "WEIGHT"] as const;
const STATUS_FILTERS = ["ALL", "MILKING", "DRY", "HEIFER", "CALF"] as const;

function refresh() {
  revalidatePath("/admin/health/targets");
}

export async function addProductionTarget(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addProductionTargetImpl(formData));
}

async function addProductionTargetImpl(formData: FormData): Promise<FormState> {
  await requirePermission("health", "CREATE");
  const cowId = reqId(formData, "cowId", "Animal");
  const type = reqEnum(formData, "type", "Type", TARGET_TYPES);
  const targetValue = reqNum(formData, "targetValue", "Target", { positive: true, max: 100_000 });
  const targetDate = optDate(formData, "targetDate", "Target date", { futureDays: 3650 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true, tag: true } });
  if (!cow) throw new ValidationError("Animal not found.");

  await prisma.productionTarget.create({ data: { cowId, type, targetValue, targetDate } });

  refresh();
  return { success: true, message: `Target set for Cow ${cow.tag}.` };
}

export type BulkState = { success: boolean; message: string } | undefined;

export async function bulkSetProductionTargets(_prev: BulkState, formData: FormData): Promise<BulkState> {
  return runAction(() => bulkSetProductionTargetsImpl(formData));
}

async function bulkSetProductionTargetsImpl(formData: FormData): Promise<BulkState> {
  await requirePermission("health", "CREATE");
  const type = reqEnum(formData, "type", "Type", TARGET_TYPES);
  const targetValue = reqNum(formData, "targetValue", "Target", { positive: true, max: 100_000 });
  const targetDate = optDate(formData, "targetDate", "Target date", { futureDays: 3650 });
  const statusFilter = reqEnum(formData, "statusFilter", "Group", STATUS_FILTERS);

  const cows = await prisma.cow.findMany({
    where: statusFilter === "ALL" ? { status: { notIn: ["SOLD", "DEAD"] } } : { status: statusFilter },
    select: { id: true },
  });
  if (cows.length === 0) return { success: false, message: "No animals matched that group." };

  await prisma.productionTarget.createMany({
    data: cows.map((c) => ({ cowId: c.id, type, targetValue, targetDate })),
  });

  refresh();
  return { success: true, message: `Target set for ${cows.length} animal${cows.length === 1 ? "" : "s"}.` };
}

export async function deleteProductionTarget(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteProductionTargetImpl(formData));
}

async function deleteProductionTargetImpl(formData: FormData): Promise<FormState> {
  await requirePermission("health", "DELETE");
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Target");
  await prisma.productionTarget.delete({ where: { id } });
  refresh();
  return { success: true, message: "Target deleted." };
}
