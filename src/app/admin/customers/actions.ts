"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { success: boolean; message: string } | undefined;

export async function addCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const address = (formData.get("address") as string | null)?.trim() || null;
  const paymentTerms = (formData.get("paymentTerms") as string | null)?.trim() || null;
  const agreedRateRaw = formData.get("agreedRate") as string | null;

  if (!name) return { success: false, message: "Customer name is required." };

  const existing = await prisma.customer.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A customer named "${name}" already exists.` };

  const agreedRate = agreedRateRaw ? parseFloat(agreedRateRaw) : null;
  await prisma.customer.create({
    data: { name, phone, address, paymentTerms, agreedRate: agreedRate !== null && !Number.isNaN(agreedRate) ? agreedRate : null },
  });

  revalidatePath("/admin/customers");
  revalidatePath("/entry/milk-sale");
  return { success: true, message: `Customer "${name}" added.` };
}

export async function updateCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string | null)?.trim();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const address = (formData.get("address") as string | null)?.trim() || null;
  const paymentTerms = (formData.get("paymentTerms") as string | null)?.trim() || null;
  const agreedRateRaw = formData.get("agreedRate") as string | null;

  if (!id || !name) return { success: false, message: "Customer name is required." };

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Customer not found." };

  const agreedRate = agreedRateRaw ? parseFloat(agreedRateRaw) : null;
  await prisma.customer.update({
    where: { id },
    data: { name, phone, address, paymentTerms, agreedRate: agreedRate !== null && !Number.isNaN(agreedRate) ? agreedRate : null },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/entry/milk-sale");
  return { success: true, message: "Customer updated." };
}

export async function toggleCustomerActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.customer.update({ where: { id }, data: { active } });
  revalidatePath("/admin/customers");
  revalidatePath("/entry/milk-sale");
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/admin/customers");
  revalidatePath("/entry/milk-sale");
  redirect("/admin/customers");
}
