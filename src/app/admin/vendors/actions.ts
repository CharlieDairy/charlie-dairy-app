"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { success: boolean; message: string } | undefined;

export async function addVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const address = (formData.get("address") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!name) return { success: false, message: "Vendor name is required." };

  const existing = await prisma.vendor.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A vendor named "${name}" already exists.` };

  await prisma.vendor.create({ data: { name, phone, address, category, notes } });

  revalidatePath("/admin/vendors");
  return { success: true, message: `Vendor "${name}" added.` };
}

export async function updateVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string | null)?.trim();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const address = (formData.get("address") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!id || !name) return { success: false, message: "Vendor name is required." };

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Vendor not found." };

  await prisma.vendor.update({ where: { id }, data: { name, phone, address, category, notes } });

  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${id}`);
  return { success: true, message: "Vendor updated." };
}

export async function toggleVendorActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.vendor.update({ where: { id }, data: { active } });
  revalidatePath("/admin/vendors");
}

export async function deleteVendor(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await prisma.vendor.delete({ where: { id } });
  revalidatePath("/admin/vendors");
  redirect("/admin/vendors");
}
