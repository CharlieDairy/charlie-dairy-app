"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addVaccineDef(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const intervalRaw = formData.get("repeatIntervalDays") as string | null;
  if (!name) return { success: false, message: "Vaccine name is required." };

  const existing = await prisma.vaccineDef.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A vaccine named "${name}" already exists.` };

  const repeatIntervalDays = intervalRaw ? parseInt(intervalRaw, 10) : null;
  await prisma.vaccineDef.create({
    data: { name, repeatIntervalDays: repeatIntervalDays && !Number.isNaN(repeatIntervalDays) ? repeatIntervalDays : null },
  });

  revalidatePath("/admin/health/vaccines");
  return { success: true, message: `Vaccine "${name}" added.` };
}

export async function toggleVaccineActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.vaccineDef.update({ where: { id }, data: { active } });
  revalidatePath("/admin/health/vaccines");
}

export async function addMedicineDef(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const unit = (formData.get("unit") as string | null)?.trim() || null;
  if (!name) return { success: false, message: "Medicine name is required." };

  const existing = await prisma.medicineDef.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A medicine named "${name}" already exists.` };

  await prisma.medicineDef.create({ data: { name, unit } });
  revalidatePath("/admin/health/medicines");
  return { success: true, message: `Medicine "${name}" added.` };
}

export async function toggleMedicineActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.medicineDef.update({ where: { id }, data: { active } });
  revalidatePath("/admin/health/medicines");
}

export async function recordVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const vaccineName = (formData.get("vaccineName") as string | null)?.trim();
  const dateRaw = formData.get("date") as string | null;
  const nextDueDateRaw = formData.get("nextDueDate") as string | null;
  const costRaw = formData.get("cost") as string | null;
  const administeredBy = (formData.get("administeredBy") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!cowId || !vaccineName || !dateRaw) {
    return { success: false, message: "Animal, vaccine and date are required." };
  }

  // Match the typed name against the catalog (case-insensitive) so records
  // stay linked to a VaccineDef without the form needing its own hidden
  // vaccineDefId field -- a free-text name that doesn't match anything in
  // the catalog is still recorded, just without a def link or auto interval.
  const matchedDef = await prisma.vaccineDef.findFirst({ where: { name: { equals: vaccineName, mode: "insensitive" } } });
  const date = new Date(dateRaw);
  const autoNextDue = !nextDueDateRaw && matchedDef?.repeatIntervalDays
    ? new Date(date.getTime() + matchedDef.repeatIntervalDays * 86_400_000)
    : null;

  const cost = costRaw ? parseFloat(costRaw) : null;
  await prisma.vaccinationRecord.create({
    data: {
      cowId,
      vaccineDefId: matchedDef?.id ?? null,
      vaccineName,
      date,
      nextDueDate: nextDueDateRaw ? new Date(nextDueDateRaw) : autoNextDue,
      cost: cost !== null && !Number.isNaN(cost) ? cost : null,
      administeredBy,
      notes,
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  revalidatePath("/admin/reports/health");
  revalidatePath("/entry/health/vaccination");
  return { success: true, message: "Vaccination recorded." };
}

export async function recordTreatment(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const medicineName = (formData.get("medicineName") as string | null)?.trim();
  const dateRaw = formData.get("date") as string | null;
  const dosage = (formData.get("dosage") as string | null)?.trim() || null;
  const reason = (formData.get("reason") as string | null)?.trim() || null;
  const costRaw = formData.get("cost") as string | null;
  const administeredBy = (formData.get("administeredBy") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!cowId || !medicineName || !dateRaw) {
    return { success: false, message: "Animal, medicine and date are required." };
  }

  const matchedDef = await prisma.medicineDef.findFirst({ where: { name: { equals: medicineName, mode: "insensitive" } } });
  const cost = costRaw ? parseFloat(costRaw) : null;
  await prisma.treatmentRecord.create({
    data: {
      cowId,
      medicineDefId: matchedDef?.id ?? null,
      medicineName,
      date: new Date(dateRaw),
      dosage,
      reason,
      cost: cost !== null && !Number.isNaN(cost) ? cost : null,
      administeredBy,
      notes,
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  revalidatePath("/admin/reports/health");
  revalidatePath("/entry/health/treatment");
  return { success: true, message: "Treatment recorded." };
}
