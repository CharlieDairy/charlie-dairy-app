"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertDateChangeNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, reqText, optDate, optEnum, optNum, optText } from "@/lib/validate";
import { calcExpectedCalvingDate, calcExpectedDryOffDate } from "@/lib/breeding/rules";
import { revalidatePath } from "next/cache";

// Edit and delete for the records shown in a cow's history: weight,
// vaccination, treatment, heat, insemination, pregnancy check and calving.
// Read/Add already exist on the entry forms. Admin and Editor may both edit
// and delete (requirePermission); an Editor still cannot move a record onto a
// past date (assertDateChangeNotBackdated). Every change lands in the Audit
// Log through the Prisma audit extension.

export type FormState = { success: boolean; message: string } | undefined;

function refresh(cowId?: string) {
  if (cowId) revalidatePath(`/admin/cows/${cowId}`);
  revalidatePath("/admin/cows");
  revalidatePath("/admin/reports/health");
  revalidatePath("/admin/reports/breeding");
  revalidatePath("/admin/reports/weight");
  revalidatePath("/admin/health/medicines");
  revalidatePath("/admin/health/medicines/stock");
  revalidatePath("/entry/breeding/reproduction");
  revalidatePath("/entry/milk-sale");
}

const gone: FormState = { success: false, message: "That record no longer exists. Refresh the page." };

// ---- Weight ---------------------------------------------------------------

export async function updateWeightRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("weight", "EDIT");
    const id = reqId(formData, "id", "Record");
    const date = reqDate(formData, "date", "Date");
    const weightKg = reqNum(formData, "weightKg", "Weight", { positive: true, max: 2000 });
    const existing = await prisma.weightRecord.findUnique({ where: { id } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(date, existing.date, user);
    await prisma.weightRecord.update({ where: { id }, data: { date, weightKg } });
    refresh(existing.cowId);
    return { success: true, message: "Weight updated." };
  });
}

export async function deleteWeightRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("weight", "DELETE");
    const id = reqId(formData, "id", "Record");
    const existing = await prisma.weightRecord.findUnique({ where: { id }, select: { cowId: true } });
    if (!existing) return gone;
    await prisma.weightRecord.delete({ where: { id } });
    refresh(existing.cowId);
    return { success: true, message: "Weight deleted." };
  });
}

// ---- Vaccination ----------------------------------------------------------

export async function updateVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("health", "EDIT");
    const id = reqId(formData, "id", "Record");
    const date = reqDate(formData, "date", "Date");
    const vaccineName = reqText(formData, "vaccineName", "Vaccine", { max: 100 });
    const nextDueDate = optDate(formData, "nextDueDate", "Next due date", { futureDays: 3650 });
    const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
    const administeredBy = optText(formData, "administeredBy", "Administered by", { max: 100 });
    const notes = optText(formData, "notes", "Notes", { max: 1000 });
    const existing = await prisma.vaccinationRecord.findUnique({ where: { id } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(date, existing.date, user);
    const def = await prisma.vaccineDef.findFirst({ where: { name: { equals: vaccineName, mode: "insensitive" } }, select: { id: true } });
    await prisma.vaccinationRecord.update({
      where: { id },
      data: { date, vaccineName, vaccineDefId: def?.id ?? null, nextDueDate, cost, administeredBy, notes },
    });
    refresh(existing.cowId);
    return { success: true, message: "Vaccination updated." };
  });
}

export async function deleteVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("health", "DELETE");
    const id = reqId(formData, "id", "Record");
    const existing = await prisma.vaccinationRecord.findUnique({ where: { id }, select: { cowId: true } });
    if (!existing) return gone;
    await prisma.vaccinationRecord.delete({ where: { id } });
    refresh(existing.cowId);
    return { success: true, message: "Vaccination deleted." };
  });
}

// ---- Treatment (keeps the medicine stock in step) --------------------------

// Recording a treatment with a quantity also writes a stock OUT row noted
// "Treatment: Cow <tag>" (see recordTreatment). Find that row again so an
// edit or delete keeps the Medicine Stock ledger honest.
async function findTreatmentStockRow(
  tx: Pick<typeof prisma, "medicineStockTransaction">,
  t: { medicineDefId: string | null; date: Date; quantityUsed: number | null },
  cowTag: string,
) {
  if (!t.medicineDefId || !t.quantityUsed) return null;
  return tx.medicineStockTransaction.findFirst({
    where: { medicineDefId: t.medicineDefId, direction: "OUT", date: t.date, quantity: t.quantityUsed, notes: `Treatment: Cow ${cowTag}` },
  });
}

export async function updateTreatment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("health", "EDIT");
    const id = reqId(formData, "id", "Record");
    const date = reqDate(formData, "date", "Date");
    const medicineName = reqText(formData, "medicineName", "Medicine", { max: 100 });
    const dosage = optText(formData, "dosage", "Dosage", { max: 100 });
    const quantityUsed = optNum(formData, "quantityUsed", "Quantity used", { positive: true, max: 1_000_000 });
    const reason = optText(formData, "reason", "Reason", { max: 300 });
    const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
    const administeredBy = optText(formData, "administeredBy", "Administered by", { max: 100 });
    const notes = optText(formData, "notes", "Notes", { max: 1000 });

    const existing = await prisma.treatmentRecord.findUnique({ where: { id }, include: { cow: { select: { tag: true } } } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(date, existing.date, user);

    const def = await prisma.medicineDef.findFirst({ where: { name: { equals: medicineName, mode: "insensitive" } } });
    const withdrawalUntil = def?.withdrawalDays != null ? new Date(date.getTime() + def.withdrawalDays * 86_400_000) : null;

    await prisma.$transaction(async (tx) => {
      const oldStock = await findTreatmentStockRow(tx, existing, existing.cow.tag);
      await tx.treatmentRecord.update({
        where: { id },
        data: { date, medicineName, medicineDefId: def?.id ?? null, dosage, quantityUsed, withdrawalUntil, reason, cost, administeredBy, notes },
      });
      if (oldStock) await tx.medicineStockTransaction.delete({ where: { id: oldStock.id } });
      if (quantityUsed && def) {
        await tx.medicineStockTransaction.create({
          data: { medicineDefId: def.id, date, direction: "OUT", quantity: quantityUsed, notes: `Treatment: Cow ${existing.cow.tag}`, enteredBy: user.name },
        });
      }
    });
    refresh(existing.cowId);
    return { success: true, message: "Treatment updated." };
  });
}

export async function deleteTreatment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("health", "DELETE");
    const id = reqId(formData, "id", "Record");
    const existing = await prisma.treatmentRecord.findUnique({ where: { id }, include: { cow: { select: { tag: true } } } });
    if (!existing) return gone;
    await prisma.$transaction(async (tx) => {
      const stock = await findTreatmentStockRow(tx, existing, existing.cow.tag);
      await tx.treatmentRecord.delete({ where: { id } });
      if (stock) await tx.medicineStockTransaction.delete({ where: { id: stock.id } });
    });
    refresh(existing.cowId);
    return { success: true, message: "Treatment deleted and its medicine stock use removed." };
  });
}

// ---- Breeding -------------------------------------------------------------

const DETECTION_METHODS = ["VISUAL", "ACTIVITY_MONITOR", "TAIL_PAINT", "OTHER"] as const;
const AI_METHODS = ["AI", "NATURAL", "EMBRYO_TRANSFER"] as const;
const PREG_METHODS = ["PALPATION", "ULTRASOUND", "BLOOD_TEST", "OBSERVATION"] as const;
const PREG_RESULTS = ["PREGNANT", "OPEN", "INCONCLUSIVE"] as const;
const DIFFICULTIES = ["UNASSISTED", "EASY_PULL", "HARD_PULL", "VET_ASSISTED", "CAESAREAN"] as const;

export async function updateHeatEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("breeding", "EDIT");
    const id = reqId(formData, "id", "Record");
    const detectedAt = reqDate(formData, "detectedAt", "Date/time");
    const detectionMethod = reqEnum(formData, "detectionMethod", "Detection method", DETECTION_METHODS);
    const intensity = optText(formData, "intensity", "Intensity", { max: 50 });
    const notes = optText(formData, "notes", "Notes", { max: 1000 });
    const existing = await prisma.heatEvent.findUnique({ where: { id } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(detectedAt, existing.detectedAt, user, "Date/time");
    await prisma.heatEvent.update({ where: { id }, data: { detectedAt, detectionMethod, intensity, notes } });
    refresh(existing.cowId);
    return { success: true, message: "Heat event updated." };
  });
}

export async function deleteHeatEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("breeding", "DELETE");
    const id = reqId(formData, "id", "Record");
    const existing = await prisma.heatEvent.findUnique({ where: { id }, select: { cowId: true } });
    if (!existing) return gone;
    await prisma.heatEvent.delete({ where: { id } });
    refresh(existing.cowId);
    return { success: true, message: "Heat event deleted." };
  });
}

export async function updateInsemination(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("breeding", "EDIT");
    const id = reqId(formData, "id", "Record");
    const date = reqDate(formData, "date", "Date");
    const method = optEnum(formData, "method", "Method", AI_METHODS) ?? "AI";
    const semenBatch = optText(formData, "semenBatch", "Semen batch", { max: 100 });
    const bullTag = optText(formData, "bullTag", "Bull tag", { max: 50 });
    const technician = optText(formData, "technician", "Technician", { max: 100 });
    const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
    const notes = optText(formData, "notes", "Notes", { max: 1000 });
    const existing = await prisma.insemination.findUnique({ where: { id } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(date, existing.date, user);
    const sameDay = await prisma.insemination.findFirst({ where: { cowId: existing.cowId, date, NOT: { id } }, select: { id: true } });
    if (sameDay) throw new ValidationError("This cow already has an insemination on that date.");
    await prisma.insemination.update({ where: { id }, data: { date, method, semenBatch, bullTag, technician, cost, notes } });
    refresh(existing.cowId);
    return { success: true, message: "Insemination updated." };
  });
}

export async function deleteInsemination(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("breeding", "DELETE");
    const id = reqId(formData, "id", "Record");
    const existing = await prisma.insemination.findUnique({ where: { id }, select: { cowId: true } });
    if (!existing) return gone;
    // Pregnancy checks and calvings that pointed at it simply lose the link.
    await prisma.insemination.delete({ where: { id } });
    refresh(existing.cowId);
    return { success: true, message: "Insemination deleted." };
  });
}

// After a pregnancy check changes, the cow's expected calving / dry-off dates
// follow her latest remaining check (same rule recordPregnancyCheck uses).
async function resyncReproState(cowId: string) {
  const latest = await prisma.pregnancyCheck.findFirst({
    where: { cowId },
    orderBy: { date: "desc" },
    include: { insemination: { select: { date: true } } },
  });
  if (!latest) return;
  if (latest.result === "PREGNANT") {
    const expectedCalving = calcExpectedCalvingDate(latest.insemination?.date ?? latest.date);
    await prisma.cow.update({ where: { id: cowId }, data: { expectedCalving, dryDate: calcExpectedDryOffDate(expectedCalving) } });
  } else if (latest.result === "OPEN") {
    await prisma.cow.update({ where: { id: cowId }, data: { expectedCalving: null, dryDate: null } });
  }
}

export async function updatePregnancyCheck(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("breeding", "EDIT");
    const id = reqId(formData, "id", "Record");
    const date = reqDate(formData, "date", "Date");
    const method = optEnum(formData, "method", "Method", PREG_METHODS) ?? "PALPATION";
    const result = reqEnum(formData, "result", "Result", PREG_RESULTS);
    const notes = optText(formData, "notes", "Notes", { max: 1000 });
    const existing = await prisma.pregnancyCheck.findUnique({ where: { id } });
    if (!existing) return gone;
    // Pregnancy checks are intentionally allowed on past dates (see
    // recordPregnancyCheck), so editing the date needs no back-dating check.
    await prisma.pregnancyCheck.update({ where: { id }, data: { date, method, result, notes } });
    await resyncReproState(existing.cowId);
    refresh(existing.cowId);
    return { success: true, message: "Pregnancy check updated." };
  });
}

export async function deletePregnancyCheck(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("breeding", "DELETE");
    const id = reqId(formData, "id", "Record");
    const existing = await prisma.pregnancyCheck.findUnique({ where: { id }, select: { cowId: true } });
    if (!existing) return gone;
    await prisma.pregnancyCheck.delete({ where: { id } });
    await resyncReproState(existing.cowId);
    refresh(existing.cowId);
    return { success: true, message: "Pregnancy check deleted." };
  });
}

// ---- Calving --------------------------------------------------------------

export async function updateCalving(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("breeding", "EDIT");
    const id = reqId(formData, "id", "Record");
    const sireTag = optText(formData, "sireTag", "Sire tag", { max: 50 });
    const difficulty = optEnum(formData, "difficulty", "Difficulty", DIFFICULTIES) ?? "UNASSISTED";
    const assistedBy = optText(formData, "assistedBy", "Assisted by", { max: 100 });
    const retainedPlacenta = formData.get("retainedPlacenta") === "on";
    const complications = optText(formData, "complications", "Complications", { max: 1000 });
    const notes = optText(formData, "notes", "Notes", { max: 1000 });
    const existing = await prisma.calving.findUnique({ where: { id }, select: { damId: true } });
    if (!existing) return gone;
    // Date and number of calves are not editable: they decide the dam's
    // lactation, status and the calf animals already created.
    await prisma.calving.update({ where: { id }, data: { sireTag, difficulty, assistedBy, retainedPlacenta, complications, notes } });
    refresh(existing.damId);
    return { success: true, message: "Calving updated." };
  });
}

export async function deleteCalving(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("breeding", "DELETE");
    const id = reqId(formData, "id", "Record");
    const calving = await prisma.calving.findUnique({ where: { id }, include: { calves: true, dam: true } });
    if (!calving) return gone;
    if (calving.calves.some((c) => c.cowId)) {
      throw new ValidationError("A calf from this calving is registered as an animal. Remove that animal first, then delete the calving.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.calf.deleteMany({ where: { calvingId: id } });
      await tx.calving.delete({ where: { id } });
      // If this was her latest calving, roll the dam's last-calving date and
      // lactation count back to the one before it.
      const dam = calving.dam;
      if (dam.lastCalvingDate && calving.date >= dam.lastCalvingDate) {
        const previous = await tx.calving.findFirst({ where: { damId: dam.id }, orderBy: { date: "desc" }, select: { date: true } });
        await tx.cow.update({
          where: { id: dam.id },
          data: { lastCalvingDate: previous?.date ?? null, lactationNumber: Math.max(0, (dam.lactationNumber ?? 0) - 1) },
        });
      }
    });
    refresh(calving.damId);
    return { success: true, message: "Calving deleted. Check the animal's status on its profile if needed." };
  });
}
