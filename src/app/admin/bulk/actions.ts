"use server";

import { requireAccess } from "@/lib/access";
import { AccessError } from "@/lib/errors";
import { importCsv } from "@/lib/bulk/import";
import type { BulkTypeKey, ImportResult } from "@/lib/bulk/types";
import { getBulkTypeMeta } from "@/lib/bulk/registry";
import { revalidatePath } from "next/cache";

const fail = (message: string): ImportResult => ({ success: false, message, errors: [], insertedCount: 0 });

export async function uploadBulkData(_prev: ImportResult | undefined, formData: FormData): Promise<ImportResult> {
  try {
    // Bulk import writes thousands of rows at once -- Admin role only.
    const user = await requireAccess({ admin: true });

    const key = formData.get("type") as BulkTypeKey | null;
    const file = formData.get("file");

    if (!key || !getBulkTypeMeta(key)) return fail("Missing or unknown data type.");
    if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file first.");
    if (file.size > 5 * 1024 * 1024) return fail("File is too large (max 5MB).");

    const text = await file.text();
    const result = await importCsv(key, text, user.name);

    if (result.success) {
      revalidatePath("/admin");
      revalidatePath("/admin/cows");
      revalidatePath("/admin/assets");
      revalidatePath("/admin/capital");
      revalidatePath("/admin/reports/herd");
      revalidatePath("/admin/reports/breeding");
    }

    return result;
  } catch (e) {
    if (e instanceof AccessError) return fail(e.message);
    console.error("[bulk import] unexpected error", e);
    return fail("The import failed unexpectedly and nothing was imported. Please check the file and try again.");
  }
}
