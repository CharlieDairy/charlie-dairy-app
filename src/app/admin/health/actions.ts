"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, reqNum, reqText, optDate, optNum, optText } from "@/lib/validate";

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
  const withdrawalDays = optNum(formData, "withdrawalDays", "Withdrawal days", { min: 0, max: 365, decimals: 0 });
  const reorderLevel = optNum(formData, "reorderLevel", "Reorder level", { min: 0, max: 1_000_000 });

  const existing = await prisma.medicineDef.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A medicine named "${name}" already exists.` };

  await prisma.medicineDef.create({ data: { name, unit, withdrawalDays, reorderLevel } });
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

export async function updateMedicineDef(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateMedicineDefImpl(formData));
}

async function updateMedicineDefImpl(formData: FormData): Promise<FormState> {
  await requirePermission("health", "EDIT");
  const id = reqId(formData, "id", "Medicine");
  const unit = optText(formData, "unit", "Unit", { max: 20 });
  const withdrawalDays = optNum(formData, "withdrawalDays", "Withdrawal days", { min: 0, max: 365, decimals: 0 });
  const reorderLevel = optNum(formData, "reorderLevel", "Reorder level", { min: 0, max: 1_000_000 });

  const existing = await prisma.medicineDef.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Medicine not found." };

  await prisma.medicineDef.update({ where: { id }, data: { unit, withdrawalDays, reorderLevel } });
  revalidatePath("/admin/health/medicines");
  return { success: true, message: `${existing.name} updated.` };
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
  const quantityUsed = optNum(formData, "quantityUsed", "Quantity used", { positive: true, max: 1_000_000 });
  // For a multi-day course, withdrawal should count from the LAST dose, not
  // the start date -- defaults to `date` (a single-dose treatment) when left
  // blank, but a course's real last-dose date takes priority when given.
  const lastDoseDate = optDate(formData, "lastDoseDate", "Last dose date", { futureDays: 0 });
  const reason = optText(formData, "reason", "Reason", { max: 300 });
  const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
  const administeredBy = optText(formData, "administeredBy", "Administered by", { max: 100 });
  const notes = optText(formData, "notes", "Notes", { max: 1000 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true, tag: true } });
  if (!cow) throw new ValidationError("Animal not found.");

  const matchedDef = await prisma.medicineDef.findFirst({ where: { name: { equals: medicineName, mode: "insensitive" } } });
  const withdrawalBasisDate = lastDoseDate ?? date;
  const withdrawalUntil = matchedDef?.withdrawalDays != null
    ? new Date(withdrawalBasisDate.getTime() + matchedDef.withdrawalDays * 86_400_000)
    : null;
  // Silent gap otherwise: a typo or an unlisted medicine name gets no
  // withdrawal tracking at all, with nothing telling the person entering it.
  const unmatchedWarning = !matchedDef
    ? ` "${medicineName}" isn't in the Medicines catalog, so no withdrawal period was tracked for this treatment.`
    : matchedDef.withdrawalDays == null
      ? ` ${medicineName} has no withdrawal days configured, so no withdrawal period was tracked.`
      : "";

  const duplicate = await prisma.treatmentRecord.findFirst({
    where: { cowId, medicineName, date, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This treatment was just recorded, so it wasn't saved twice.");

  // Stock deficit is a warning, not a block (mirrors submitFeed in
  // src/app/entry/feed/actions.ts) -- older stock may simply never have
  // been entered into the ledger.
  let stockAfter: number | null = null;
  if (quantityUsed && matchedDef) {
    const [inAgg, outAgg] = await Promise.all([
      prisma.medicineStockTransaction.aggregate({ _sum: { quantity: true }, where: { medicineDefId: matchedDef.id, direction: "IN" } }),
      prisma.medicineStockTransaction.aggregate({ _sum: { quantity: true }, where: { medicineDefId: matchedDef.id, direction: "OUT" } }),
    ]);
    stockAfter = (inAgg._sum.quantity ?? 0) - (outAgg._sum.quantity ?? 0) - quantityUsed;
  }

  await prisma.$transaction(async (tx) => {
    await tx.treatmentRecord.create({
      data: {
        cowId,
        medicineDefId: matchedDef?.id ?? null,
        medicineName,
        date,
        dosage,
        quantityUsed,
        withdrawalUntil,
        reason,
        cost,
        administeredBy,
        notes,
        enteredBy: user.name,
      },
    });
    if (quantityUsed && matchedDef) {
      await tx.medicineStockTransaction.create({
        data: {
          medicineDefId: matchedDef.id,
          date,
          direction: "OUT",
          quantity: quantityUsed,
          notes: `Treatment: Cow ${cow.tag}`,
          enteredBy: user.name,
        },
      });
    }
  });

  revalidatePath(`/admin/cows/${cowId}`);
  revalidatePath("/admin/reports/health");
  revalidatePath("/entry/health/treatment");
  revalidatePath("/admin/health/medicines");
  revalidatePath("/admin/health/medicines/stock");
  revalidatePath("/entry/milk-sale");

  const withdrawalNote = withdrawalUntil
    ? ` Milk withdrawal in effect until ${withdrawalUntil.toISOString().slice(0, 10)}.`
    : unmatchedWarning;
  const stockWarning =
    stockAfter !== null && stockAfter < 0
      ? ` Warning: recorded stock of ${medicineName} is now ${stockAfter.toFixed(1)} — a restock entry may be missing.`
      : "";
  return { success: true, message: `Treatment recorded.${withdrawalNote}${stockWarning}` };
}

export async function restockMedicine(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => restockMedicineImpl(formData));
}

async function restockMedicineImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("health", "CREATE");
  const medicineDefId = reqId(formData, "medicineDefId", "Medicine");
  const date = reqDate(formData, "date", "Date");
  const quantity = reqNum(formData, "quantity", "Quantity", { positive: true, max: 1_000_000 });
  const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
  const notes = optText(formData, "notes", "Notes", { max: 500 });

  const medicine = await prisma.medicineDef.findUnique({ where: { id: medicineDefId }, select: { id: true, name: true } });
  if (!medicine) throw new ValidationError("Medicine not found.");

  await prisma.medicineStockTransaction.create({
    data: { medicineDefId, date, direction: "IN", quantity, cost, notes, enteredBy: user.name },
  });

  revalidatePath("/admin/health/medicines/stock");
  return { success: true, message: `Restocked ${quantity} of ${medicine.name}.` };
}
