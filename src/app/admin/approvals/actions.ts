"use server";

import { requireAccess, runAction } from "@/lib/access";
import { reqId, optText } from "@/lib/validate";
import { approveDeletion, rejectDeletion } from "@/lib/deletionApproval";

// Only the Admin can decide a delete request. Approving deletes the record for real; rejecting keeps it.

export type FormState = { success: boolean; message: string } | undefined;

export async function approveDeletionRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const admin = await requireAccess({ admin: true });
    return approveDeletion(reqId(formData, "id", "Request"), admin);
  });
}

export async function rejectDeletionRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const admin = await requireAccess({ admin: true });
    return rejectDeletion(reqId(formData, "id", "Request"), admin, optText(formData, "note", "Reason", { max: 300 }));
  });
}
