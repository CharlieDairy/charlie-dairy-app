"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, reqText, optDate, optNum, optText } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

export async function addVaccineDef(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addVaccineDefImpl(formData));
}

async function addVaccineDefImpl(formData: FormData): Promise<FormState> {
  await requirePermission("health", "CREATE");
  const name = reqText(formData, "name", "Vaccine name", { max: 100 });
  const repeatIntervalDays = optNum(formData, "repeatIntervalDays", "Repeat interval", { positive: true, max: 3650, decimals: 0 });

  const existing = await prisma.vaccineDef.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A vaccine named "${name}" already exists.` };

  await prisma.vaccineDef.create({ data: { name, repeatIntervalDays } });

  revalidatePath("/admin/health/vaccines");
  return { success: true, message: `Vaccine "${name}" added.` };
}

export async function toggleVaccineActive(formData: FormData): Promise<void> {
  await requirePermission("health", "EDIT");
  const id = reqId(formData, "id", "Vaccine");
  const active = formData.get("active") === "true";
  await prisma.vaccineDef.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/health/vaccines");
}

export async function addMedicineDef(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addMedicineDefImpl(formData));
}

async function addMedicineDefImpl(formData: FormData): Promise<FormState> {
  await requirePermission("health", "CREATE");
  const name = reqText(formData, "name", "Medicine name", { max: 100 });
  const unit = optText(formData, "unit", "Unit", { max: 20 });

  const existing = await prisma.medicineDef.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A medicine named "${name}" already exists.` };

  await prisma.medicineDef.create({ data: { name, unit } });
  revalidatePath("/admin/health/medicines");
  return { success: true, message: `Medicine "${name}" added.` };
}

export async function toggleMedicineActive(formData: FormData): Promise<void> {
  await requirePermission("health", "EDIT");
  const id = reqId(formData, "id", "Medicine");
  const active = formData.get("active") === "true";
  await prisma.medicineDef.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/health/medicines");
}

export async function recordVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordVaccinationImpl(formData));
}

async function recordVaccinationImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("health", "CREATE");
  const cowId = reqId(formData, "cowId", "Animal");
  const vaccineName = reqText(formData, "vaccineName", "Vaccine", { max: 100 });
  const date = reqDate(formData, "date", "Date");
  const nextDueDate = optDate(formData, "nextDueDate", "Next due date", { futureDays: 3650 });
  const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
  const administeredBy = optText(formData, "administeredBy", "Administered by", { max: 100 });
  const notes = optText(formData, "notes", "Notes", { max: 1000 });

  if (nextDueDate && nextDueDate < date) throw new ValidationError("Next due date can't be before the vaccination date.");

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true } });
  if (!cow) throw new ValidationError("Animal not found.");

  // Match the typed name against the catalog (case-insensitive) so records
  // stay linked to a VaccineDef without the form needing its own hidden
  // vaccineDefId field -- a free-text name that doesn't match anything in
  // the catalog is still recorded, just without a def link or auto interval.
  const matchedDef = await prisma.vaccineDef.findFirst({ where: { name: { equals: vaccineName, mode: "insensitive" } } });
  const autoNextDue = !nextDueDate && matchedDef?.repeatIntervalDays
    ? new Date(date.getTime() + matchedDef.repeatIntervalDays * 86_400_000)
    : null;

  const duplicate = await prisma.vaccinationRecord.findFirst({
    where: { cowId, vaccineName, date, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This vaccination was just recorded, so it wasn't saved twice.");

  await prisma.vaccinationRecord.create({
    data: {
      cowId,
      vaccineDefId: matchedDef?.id ?? null,
      vaccineName,
      date,
      nextDueDate: nextDueDate ?? autoNextDue,
      cost,
      administeredBy,
      notes,
      enteredBy: user.name,
    },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  revalidatePath("/admin/reports/health");
  revalidatePath("/entry/health/vaccination");
  return { success: true, message: "Vaccination recorded." };
}

export async function recordTreatment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordTreatmentImpl(formData));
}

async function recordTreatmentImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("health", "CREATE");
  const cowId = reqId(formData, "cowId", "Animal");
  const medicineName = reqText(formData, "medicineName", "Medicine", { max: 100 });
  const date = reqDate(formData, "date", "Date");
  const dosage = optText(formData, "dosage", "Dosage", { max: 100 });
  const reason = optText(formData, "reason", "Reason", { max: 300 });
  const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
  const administeredBy = optText(formData, "administeredBy", "Administered by", { max: 100 });
  const notes = optText(formData, "notes", "Notes", { max: 1000 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true } });
  if (!cow) throw new ValidationError("Animal not found.");

  const matchedDef = await prisma.medicineDef.findFirst({ where: { name: { equals: medicineName, mode: "insensitive" } } });

  const duplicate = await prisma.treatmentRecord.findFirst({
    where: { cowId, medicineName, date, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This treatment was just recorded, so it wasn't saved twice.");

  await prisma.treatmentRecord.create({
    data: {
      cowId,
      medicineDefId: matchedDef?.id ?? null,
      medicineName,
      date,
      dosage,
      reason,
      cost,
      administeredBy,
      notes,
      enteredBy: user.name,
    },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  revalidatePath("/admin/reports/health");
  revalidatePath("/entry/health/treatment");
  return { success: true, message: "Treatment recorded." };
}
