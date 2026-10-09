"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canWrite, getLiveUser, runAction, type LiveUser } from "@/lib/access";
import { AccessError, ValidationError } from "@/lib/errors";
import { reqEnum, reqId } from "@/lib/validate";
import { runWatch } from "@/lib/watch/engine";
import { AiUnavailableError, generateReview } from "@/lib/watch/ai";

export type FormState = { success: boolean; message: string } | undefined;

async function actor(): Promise<LiveUser> {
  const user = await getLiveUser();
  if (!user) throw new AccessError("Your session has expired. Please sign in again.");
  return user;
}

// Findings and reviews are not logged by the automatic audit (they are
// rewritten every run), so each human action writes its own Audit Log line.
async function audit(user: LiveUser, action: string, entityId: string | null, oldValue: unknown, newValue: unknown) {
  await prisma.auditLog.create({
    data: { userId: user.id, userName: user.name, action, entity: "WatchFinding", entityId, oldValue: oldValue ? JSON.stringify(oldValue) : null, newValue: newValue ? JSON.stringify(newValue) : null },
  });
}

export async function runWatchNow(_prev: FormState, _formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actor();
    if (!canWrite(user)) throw new AccessError("View Only accounts can't run the check.");
    const r = await runWatch({ trigger: "manual", byUser: user.name });
    await audit(user, "watch_run", null, null, { open: r.open, new: r.created, resolved: r.resolved });
    revalidatePath("/admin/watch");
    revalidatePath("/admin");
    const errs = r.ruleErrors.length ? ` ${r.ruleErrors.length} check(s) failed and were skipped.` : "";
    return { success: true, message: `Checked everything in ${(r.durationMs / 1000).toFixed(1)}s: ${r.open} open item${r.open === 1 ? "" : "s"}, ${r.created} new, ${r.resolved} cleared.${errs}` };
  });
}

const STATUSES = ["OPEN", "ACKNOWLEDGED", "SNOOZED", "RESOLVED"] as const;

export async function setFindingStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actor();
    if (!canWrite(user)) throw new AccessError("View Only accounts can't change findings.");
    const id = reqId(formData, "id", "Finding");
    const status = reqEnum(formData, "status", "Status", STATUSES);
    const days = Math.min(90, Math.max(1, Number(formData.get("days")) || 7));

    const f = await prisma.watchFinding.findUnique({ where: { id } });
    if (!f) throw new ValidationError("That item no longer exists. Refresh the page.");
    if (f.financeOnly && user.role !== "ADMIN") throw new AccessError("Only an Admin can change a finance item.");

    await prisma.watchFinding.update({
      where: { id },
      data: {
        status,
        acknowledgedBy: status === "ACKNOWLEDGED" || status === "SNOOZED" || status === "RESOLVED" ? user.name : null,
        snoozedUntil: status === "SNOOZED" ? new Date(Date.now() + days * 86_400_000) : null,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
      },
    });
    await audit(user, `watch_${status.toLowerCase()}`, id, { status: f.status, title: f.title }, { status, ...(status === "SNOOZED" ? { days } : {}) });
    revalidatePath("/admin/watch");
    revalidatePath("/admin");
    return { success: true, message: status === "SNOOZED" ? `Hidden for ${days} days.` : status === "RESOLVED" ? "Marked resolved. It will come back if the problem returns." : status === "ACKNOWLEDGED" ? "Acknowledged." : "Reopened." };
  });
}

export async function generateAiReview(_prev: FormState, _formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actor();
    if (user.role !== "ADMIN") throw new AccessError("Only an Admin can generate the AI review.");
    try {
      // Refresh the findings first so the review reads today's picture.
      await runWatch({ trigger: "manual", byUser: user.name });
      const saved = await generateReview({ byUser: user.name, includeFinance: true });
      await audit(user, "watch_ai_review", saved.id, null, { model: saved.model, inputTokens: saved.inputTokens, outputTokens: saved.outputTokens });
    } catch (e) {
      if (e instanceof AiUnavailableError) return { success: false, message: e.message };
      throw e;
    }
    revalidatePath("/admin/watch");
    return { success: true, message: "AI review ready." };
  });
}
