"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, optNum } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

function refresh() {
  revalidatePath("/entry/milking");
  revalidatePath("/admin/reports/herd");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin");
}

const SHIFT_FIELDS = [
  { field: "morning", shift: "MORNING" as const, label: "Morning" },
  { field: "afternoon", shift: "AFTERNOON" as const, label: "Afternoon" },
  { field: "evening", shift: "EVENING" as const, label: "Evening" },
];

// One record per cow per date, all sessions together -- the Add Milk Record
// modal (modeled on Channab's "Individual Milk Records" popup) takes one
// animal + date and up to three session litres at once, so this creates one
// MilkingRecord per filled session in a single submission instead of the old
// one-shift-at-a-time form.
export async function submitMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitMilkingImpl(formData));
}

async function submitMilkingImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");

  const cowId = reqId(formData, "cowId", "Cow");
  const date = reqDate(formData, "date", "Date");
  assertNotBackdated(date, user, "Date");

  // Zero is a valid recorded milking (a cow that gave nothing); 200 L is well past any real single milking.
  const entries = SHIFT_FIELDS.map((s) => ({ ...s, litres: optNum(formData, s.field, s.label, { min: 0, max: 200 }) })).filter(
    (s): s is (typeof SHIFT_FIELDS)[number] & { litres: number } => s.litres !== null
  );
  if (entries.length === 0) {
    throw new ValidationError("Enter litres for at least one session.");
  }

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { tag: true, status: true } });
  if (!cow) throw new ValidationError("That cow was not found.");
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    throw new ValidationError(`Cow ${cow.tag} is marked ${cow.status} and can't be milked.`);
  }

  // One record per cow per shift per day -- this is what stops a double tap
  // (or two people entering the same milking) from silently doubling production.
  const existing = await prisma.milkingRecord.findMany({
    where: { cowId, date, shift: { in: entries.map((e) => e.shift) } },
    select: { shift: true, litres: true },
  });
  if (existing.length > 0) {
    const names = existing.map((e) => e.shift.toLowerCase()).join(", ");
    throw new ValidationError(`Cow ${cow.tag} already has a recorded ${names} milking for that date. Nothing was saved.`);
  }

  // A herd/group total (cowId null) for this same date+shift already covers
  // this cow's production in the farm-wide sum -- reports don't distinguish
  // "individual rows that make up a group total" from "extra production on
  // top of it", so letting both exist would double-count when totalled.
  const groupExisting = await prisma.milkingRecord.findMany({
    where: { cowId: null, date, shift: { in: entries.map((e) => e.shift) } },
    select: { shift: true },
  });
  if (groupExisting.length > 0) {
    const names = groupExisting.map((e) => e.shift.toLowerCase()).join(", ");
    throw new ValidationError(
      `A herd/group total already covers the ${names} shift on that date. Record individual cows for a shift either all together or as one group total, not both.`
    );
  }

  await prisma.milkingRecord.createMany({
    data: entries.map((e) => ({ cowId, shift: e.shift, litres: e.litres, date, enteredBy: user.name })),
  });

  refresh();
  const sessionNames = entries.map((e) => e.label).join(", ");
  return { success: true, message: `Saved ${sessionNames} for cow ${cow.tag}.` };
}

// Edit one cow's milk record for a day (all three sessions at once). A blank
// session removes that session's record, a number updates it, and a number
// for a session that had none adds it -- which counts as a new entry, so the
// no-back-dating rule applies to that part. cowId "" is a Herd/Group total.
export async function updateMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateMilkingImpl(formData));
}

function optCowId(formData: FormData): string | null {
  const v = formData.get("cowId");
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

async function updateMilkingImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "EDIT");
  const cowId = optCowId(formData); // the cow the record belongs to now
  const targetRaw = formData.get("newCowId");
  const targetCowId = typeof targetRaw === "string" && targetRaw.trim() !== "" ? targetRaw : cowId; // the cow it should belong to
  const date = reqDate(formData, "date", "Date");

  const values = SHIFT_FIELDS.map((s) => ({ ...s, litres: optNum(formData, s.field, s.label, { min: 0, max: 200 }) }));
  if (values.every((v) => v.litres === null)) {
    throw new ValidationError("Enter litres for at least one session, or use Delete to remove the whole record.");
  }

  const existing = await prisma.milkingRecord.findMany({ where: { cowId, date }, select: { id: true, shift: true, enteredBy: true } });
  if (existing.length === 0) return { success: false, message: "That record no longer exists. Refresh the page." };

  const wanted = values.filter((v) => v.litres !== null);
  const moving = targetCowId !== cowId;

  // Sessions that did not exist before are new entries, so the no-back-dating
  // rule applies to them. Moving existing sessions to another animal is a
  // correction, not a new entry.
  const adding = wanted.filter((v) => !existing.some((e) => e.shift === v.shift));
  if (adding.length > 0) assertNotBackdated(date, user, "Date");

  if (moving) {
    if (targetCowId) {
      const target = await prisma.cow.findUnique({ where: { id: targetCowId }, select: { tag: true, status: true } });
      if (!target) throw new ValidationError("That animal was not found.");
      if (target.status === "SOLD" || target.status === "DEAD") {
        throw new ValidationError(`Cow ${target.tag} is marked ${target.status} and can't be milked.`);
      }
      const clash = await prisma.milkingRecord.findMany({ where: { cowId: targetCowId, date, shift: { in: wanted.map((w) => w.shift) } }, select: { shift: true } });
      if (clash.length > 0) {
        throw new ValidationError(`Cow ${target.tag} already has a recorded ${clash.map((c) => c.shift.toLowerCase()).join(", ")} milking for that date. Nothing was changed.`);
      }
    }
  }
  if (targetCowId) {
    const group = await prisma.milkingRecord.count({ where: { cowId: null, date, shift: { in: wanted.map((w) => w.shift) }, id: { notIn: existing.map((e) => e.id) } } });
    if (group > 0 && (moving || adding.length > 0)) {
      throw new ValidationError("A herd/group total already covers one of those sessions on that date, so it can't also be recorded for a cow.");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (moving) {
      // Replace the old animal's sessions with the same figures on the new one.
      await tx.milkingRecord.deleteMany({ where: { id: { in: existing.map((e) => e.id) } } });
      for (const v of wanted) {
        const prev = existing.find((e) => e.shift === v.shift);
        await tx.milkingRecord.create({ data: { cowId: targetCowId, shift: v.shift, litres: v.litres as number, date, enteredBy: prev?.enteredBy ?? user.name } });
      }
      return;
    }
    for (const v of values) {
      const rows = existing.filter((e) => e.shift === v.shift);
      if (v.litres === null) {
        if (rows.length > 0) await tx.milkingRecord.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      } else if (rows.length > 0) {
        await tx.milkingRecord.update({ where: { id: rows[0].id }, data: { litres: v.litres } });
        if (rows.length > 1) await tx.milkingRecord.deleteMany({ where: { id: { in: rows.slice(1).map((r) => r.id) } } });
      } else {
        await tx.milkingRecord.create({ data: { cowId, shift: v.shift, litres: v.litres, date, enteredBy: user.name } });
      }
    }
  });

  refresh();
  return { success: true, message: moving ? "Milk record updated and moved to the other animal." : "Milk record updated." };
}

// Delete all of one cow's sessions for a day.
export async function deleteMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteMilkingImpl(formData));
}

async function deleteMilkingImpl(formData: FormData): Promise<FormState> {
  await requirePermission("milk", "DELETE");
  const cowId = optCowId(formData);
  const date = reqDate(formData, "date", "Date");
  const { count } = await prisma.milkingRecord.deleteMany({ where: { cowId, date } });
  if (count === 0) return { success: false, message: "That record no longer exists. Refresh the page." };
  refresh();
  return { success: true, message: `Deleted ${count} session${count === 1 ? "" : "s"}.` };
}
