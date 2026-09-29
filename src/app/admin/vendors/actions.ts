"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqId, reqText, optText } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

function readVendor(formData: FormData) {
  return {
    name: reqText(formData, "name", "Vendor name", { max: 100 }),
    phone: optText(formData, "phone", "Phone", { max: 30 }),
    address: optText(formData, "address", "Address", { max: 200 }),
    category: optText(formData, "category", "Category", { max: 100 }),
    notes: optText(formData, "notes", "Notes", { max: 1000 }),
  };
}

export async function addVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addVendorImpl(formData));
}

async function addVendorImpl(formData: FormData): Promise<FormState> {
  await requirePermission("financial", "CREATE");
  const data = readVendor(formData);

  const existing = await prisma.vendor.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A vendor named "${data.name}" already exists.` };

  await prisma.vendor.create({ data });

  revalidatePath("/admin/vendors");
  return { success: true, message: `Vendor "${data.name}" added.` };
}

export async function updateVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateVendorImpl(formData));
}

async function updateVendorImpl(formData: FormData): Promise<FormState> {
  await requirePermission("financial", "EDIT");
  const id = reqId(formData, "id", "Vendor");
  const data = readVendor(formData);

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Vendor not found." };

  const clash = await prisma.vendor.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" }, NOT: { id } },
    select: { id: true },
  });
  if (clash) return { success: false, message: `Another vendor is already named "${data.name}".` };

  // Cash entries are linked to a vendor by party name (see schema comment on
  // Vendor), so a rename carries the party name on existing entries with it
  // instead of orphaning the vendor's spend history.
  const renamed = existing.name !== data.name;
  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({ where: { id }, data });
    if (renamed) {
      await tx.cashTransaction.updateMany({
        where: { party: { equals: existing.name, mode: "insensitive" } },
        data: { party: data.name },
      });
    }
  });

  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${id}`);
  return {
    success: true,
    message: renamed ? `Vendor renamed to "${data.name}" and existing cash entries were updated to match.` : "Vendor updated.",
  };
}

export async function toggleVendorActive(formData: FormData): Promise<void> {
  await requirePermission("financial", "EDIT");
  const id = reqId(formData, "id", "Vendor");
  const active = formData.get("active") === "true";
  await prisma.vendor.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/vendors");
}

// A vendor with cash-ledger history can't be deleted; hide it instead.
export async function deleteVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteVendorImpl(formData));
}

async function deleteVendorImpl(formData: FormData): Promise<FormState> {
  await requirePermission("financial", "DELETE");
  const id = reqId(formData, "id", "Vendor");

  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) {
    redirect("/admin/vendors");
  }

  const entries = await prisma.cashTransaction.count({ where: { party: { equals: vendor.name, mode: "insensitive" } } });
  if (entries > 0) {
    throw new ValidationError(
      `"${vendor.name}" has ${entries} cash ${entries === 1 ? "entry" : "entries"} on record, so it can't be deleted. Use "Hide Vendor" instead to keep the history.`
    );
  }

  await prisma.vendor.delete({ where: { id } });
  revalidatePath("/admin/vendors");
  redirect("/admin/vendors");
}
