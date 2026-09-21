"use server";

import { auth } from "@/auth";
import { importCsv } from "@/lib/bulk/import";
import type { BulkTypeKey, ImportResult } from "@/lib/bulk/types";
import { revalidatePath } from "next/cache";

export async function uploadBulkData(_prev: ImportResult | undefined, formData: FormData): Promise<ImportResult> {
  const session = await auth();
  const key = formData.get("type") as BulkTypeKey | null;
  const file = formData.get("file") as File | null;

  if (!key) return { success: false, message: "Missing data type.", errors: [], insertedCount: 0 };
  if (!file || file.size === 0) return { success: false, message: "Choose a CSV file first.", errors: [], insertedCount: 0 };
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, message: "File is too large (max 5MB).", errors: [], insertedCount: 0 };
  }

  const text = await file.text();
  const result = await importCsv(key, text, session?.user?.name ?? null);

  if (result.success) {
    revalidatePath("/admin");
    revalidatePath("/admin/cows");
    revalidatePath("/admin/assets");
    revalidatePath("/admin/capital");
    revalidatePath("/admin/reports/herd");
    revalidatePath("/admin/reports/breeding");
  }

  return result;
}
