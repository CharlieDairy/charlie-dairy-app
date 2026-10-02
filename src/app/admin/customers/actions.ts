"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqId, reqText, optText, optNum } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

function readCustomer(formData: FormData) {
  return {
    name: reqText(formData, "name", "Customer name", { max: 100 }),
    phone: optText(formData, "phone", "Phone", { max: 30 }),
    address: optText(formData, "address", "Address", { max: 200 }),
    paymentTerms: optText(formData, "paymentTerms", "Payment terms", { max: 100 }),
    agreedRate: optNum(formData, "agreedRate", "Agreed rate", { positive: true, max: 10_000 }),
  };
}

export async function addCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addCustomerImpl(formData));
}

async function addCustomerImpl(formData: FormData): Promise<FormState> {
  // Only an Admin can create a customer -- the agreed rate set here becomes
  // the fixed, non-negotiable rate the Milk Sale Entry form uses, so letting
  // any role mint new customers (and rates) would bypass that control entirely.
  await requireAccess({ admin: true });
  const data = readCustomer(formData);

  const existing = await prisma.customer.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A customer named "${data.name}" already exists.` };

  await prisma.customer.create({ data });

  revalidatePath("/admin/customers");
  revalidatePath("/entry/milk-sale");
  return { success: true, message: `Customer "${data.name}" added.` };
}

export async function updateCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateCustomerImpl(formData));
}

async function updateCustomerImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Customer");
  const data = readCustomer(formData);

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Customer not found." };

  const clash = await prisma.customer.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" }, NOT: { id } },
    select: { id: true },
  });
  if (clash) return { success: false, message: `Another customer is already named "${data.name}".` };

  // Sales, payments and their cash entries are linked to a customer by name
  // (free-text key, see prisma/schema.prisma). Renaming without carrying
  // that history along would silently orphan every past sale, so the rename
  // and the re-key happen together or not at all.
  const renamed = existing.name !== data.name;
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id }, data });
    if (renamed) {
      await tx.milkSale.updateMany({
        where: { buyer: { equals: existing.name, mode: "insensitive" } },
        data: { buyer: data.name },
      });
      await tx.customerPayment.updateMany({
        where: { buyer: { equals: existing.name, mode: "insensitive" } },
        data: { buyer: data.name },
      });
      await tx.cashTransaction.updateMany({
        where: { category: "Milk Sale Payment", party: { equals: existing.name, mode: "insensitive" } },
        data: { party: data.name },
      });
    }
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/entry/milk-sale");
  revalidatePath("/admin/reports/milk-sales");
  return {
    success: true,
    message: renamed ? `Customer renamed to "${data.name}" and their sales history was carried over.` : "Customer updated.",
  };
}

export async function toggleCustomerActive(formData: FormData): Promise<void> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Customer");
  const active = formData.get("active") === "true";
  await prisma.customer.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/customers");
  revalidatePath("/entry/milk-sale");
}

// A customer with any sale or payment history can't be deleted -- that would
// leave milk sales and receivables pointing at a customer that no longer
// exists. Hide the customer instead (keeps every report intact).
export async function deleteCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteCustomerImpl(formData));
}

async function deleteCustomerImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Customer");

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    redirect("/admin/customers");
  }

  const [sales, payments] = await Promise.all([
    prisma.milkSale.count({ where: { buyer: { equals: customer.name, mode: "insensitive" } } }),
    prisma.customerPayment.count({ where: { buyer: { equals: customer.name, mode: "insensitive" } } }),
  ]);
  if (sales + payments > 0) {
    throw new ValidationError(
      `"${customer.name}" has ${sales} sale${sales === 1 ? "" : "s"} and ${payments} payment${payments === 1 ? "" : "s"} on record, so it can't be deleted. Use "Hide Customer" instead to keep the history.`
    );
  }

  await prisma.customer.delete({ where: { id } });
  revalidatePath("/admin/customers");
  revalidatePath("/entry/milk-sale");
  redirect("/admin/customers");
}
