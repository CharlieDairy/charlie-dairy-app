"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addCow(_prev: FormState, formData: FormData): Promise<FormState> {
  const tag = (formData.get("tag") as string | null)?.trim();
  const gender = formData.get("gender") as string | null;
  const status = formData.get("status") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!tag || !gender || !status) {
    return { success: false, message: "Tag, gender and status are required." };
  }

  const existing = await prisma.cow.findUnique({ where: { tag } });
  if (existing) {
    return { success: false, message: `Cow tag "${tag}" already exists.` };
  }

  await prisma.cow.create({
    data: { tag, gender: gender as "FEMALE" | "MALE" | "UNKNOWN", status: status as never, notes },
  });

  revalidatePath("/admin/cows");
  return { success: true, message: `Cow ${tag} added.` };
}

export async function updateCowStatus(formData: FormData): Promise<void> {
  const cowId = formData.get("cowId") as string;
  const status = formData.get("status") as string;
  await prisma.cow.update({ where: { id: cowId }, data: { status: status as never } });
  revalidatePath("/admin/cows");
}
