"use server";

import { revalidatePath } from "next/cache";
import { requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { driveConfigured } from "@/lib/googleDrive";
import { runDriveBackup } from "@/lib/driveBackup";

export type FormState = { success: boolean; message: string } | undefined;

// "Back up to Google Drive now": the same thing the weekly job does, so the Admin can prove the connection works
// without waiting for Monday.
export async function backupToDriveNow(_prev: FormState, _formData: FormData): Promise<FormState> {
  void _prev;
  void _formData;
  return runAction(async () => {
    const user = await requireAccess({ admin: true });
    if (!driveConfigured()) throw new ValidationError("Google Drive is not connected yet. Follow the steps on this page first.");
    try {
      const r = await runDriveBackup(user.name);
      revalidatePath("/admin/backups");
      revalidatePath("/admin/watch");
      return { success: true, message: `Saved ${r.name} to Google Drive (${r.rows.toLocaleString()} records, ${r.kilobytes} KB).` };
    } catch (e) {
      revalidatePath("/admin/backups");
      throw new ValidationError(`The backup did not reach Google Drive. ${e instanceof Error ? e.message : ""}`.trim());
    }
  });
}
