import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import type { LiveUser } from "@/lib/access";
import { assertStockHolds } from "@/lib/feedStockGuard";
import { repostFeedCosts } from "@/lib/feedCosting";
import { milkingKey, parseMilkingKey } from "@/lib/deletionKeys";

// Deleting a transaction. The Admin deletes straight away. The farm manager (Editor) can ask for any delete, but nothing is
// removed until the Admin approves it on the Delete approvals page. Every delete of these records goes through
// deleteOrRequest(), so there is one place that holds the delete logic and one place that holds the rule.

export type DeletableEntity = "CASH" | "MILKING" | "MILK_SALE" | "MILK_USAGE" | "CUSTOMER_PAYMENT" | "FEED" | "SALARY_PAYMENT" | "RESTOCK";

export const ENTITY_LABEL: Record<DeletableEntity, string> = {
  CASH: "Cash Register entry",
  MILKING: "Milk record",
  MILK_SALE: "Milk sale",
  MILK_USAGE: "Milk used on the farm",
  CUSTOMER_PAYMENT: "Customer payment",
  FEED: "Feed entry",
  SALARY_PAYMENT: "Salary payment",
  RESTOCK: "Medicine restock",
};

export type Outcome = { success: boolean; message: string };

const SHIFT_LABEL: Record<string, string> = { MORNING: "morning", AFTERNOON: "noon", EVENING: "evening" };
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const day = (d: Date) => d.toISOString().slice(0, 10);
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const GONE = "That record no longer exists. Refresh the page.";

export { milkingKey, parseMilkingKey };

type Actor = { name: string };
type Handler = {
  /** The record in words, or null when it no longer exists. */
  describe(id: string): Promise<string | null>;
  /** Checks that can refuse the delete (a linked record, the stock rule). Throws ValidationError. */
  check?(id: string): Promise<void>;
  /** The real delete. Returns the message to show. */
  perform(id: string, actor: Actor): Promise<string>;
  paths: string[];
};

const MONEY_PATHS = ["/admin/reports/cash-register", "/admin/reports/cashflow", "/admin/reports/pl", "/admin/reports/balance-sheet", "/admin"];
const MILK_PATHS = ["/entry/milking", "/entry/milk-sale", "/entry/daily", "/admin/reports/milk-sales", "/admin/reports/herd", "/admin/reports/reconciliation", "/admin/reports/ar-aging", "/admin/reports/milk-analytics", "/admin/customers", "/admin"];

const HANDLERS: Record<DeletableEntity, Handler> = {
  CASH: {
    paths: [...MONEY_PATHS, "/entry/cash"],
    async describe(id) {
      const r = await prisma.cashTransaction.findUnique({ where: { id } });
      if (!r) return null;
      const amount = r.amountIn > 0 ? `In ${rs(r.amountIn)}` : `Out ${rs(r.amountOut)}`;
      return clip(`Entry #${r.entryNo} · ${day(r.date)} · ${r.category}${r.party ? ` · ${r.party}` : ""} · ${amount}${r.remark ? ` · ${r.remark}` : ""}`);
    },
    async check(id) {
      // CustomerPayment / SalaryPayment point at the cash row with ON DELETE SET NULL, so deleting it here would orphan them.
      const [payment, salary] = await Promise.all([
        prisma.customerPayment.findUnique({ where: { cashTransactionId: id }, select: { buyer: true } }),
        prisma.salaryPayment.findUnique({ where: { cashTransactionId: id }, select: { employee: { select: { name: true } } } }),
      ]);
      if (payment) throw new ValidationError(`This entry is linked to a customer payment from ${payment.buyer}. Delete that payment first.`);
      if (salary) throw new ValidationError(`This entry is linked to a salary payment for ${salary.employee.name}. Delete that payment first.`);
    },
    async perform(id) {
      await prisma.cashTransaction.deleteMany({ where: { id } });
      return "Cash entry deleted.";
    },
  },

  MILKING: {
    paths: MILK_PATHS,
    async describe(key) {
      const k = parseMilkingKey(key);
      if (!k) return null;
      const [rows, cow] = await Promise.all([
        prisma.milkingRecord.findMany({ where: { cowId: k.cowId, date: k.date }, orderBy: { shift: "asc" }, select: { shift: true, litres: true } }),
        k.cowId ? prisma.cow.findUnique({ where: { id: k.cowId }, select: { tag: true } }) : Promise.resolve(null),
      ]);
      if (rows.length === 0) return null;
      const sessions = rows.map((r) => `${SHIFT_LABEL[r.shift] ?? r.shift.toLowerCase()} ${r.litres} L`).join(", ");
      return `Milk record · ${k.cowId ? `Tag ${cow?.tag ?? "?"}` : "Herd / group total"} · ${day(k.date)} · ${sessions}`;
    },
    async perform(key) {
      const k = parseMilkingKey(key);
      if (!k) throw new ValidationError(GONE);
      const { count } = await prisma.milkingRecord.deleteMany({ where: { cowId: k.cowId, date: k.date } });
      if (count === 0) throw new ValidationError(GONE);
      return `Deleted ${count} session${count === 1 ? "" : "s"}.`;
    },
  },

  MILK_SALE: {
    paths: [...MILK_PATHS, ...MONEY_PATHS],
    async describe(id) {
      const r = await prisma.milkSale.findUnique({ where: { id } });
      return r ? `Milk sale · ${day(r.date)} · ${r.buyer} · ${r.litres} L · ${rs(r.amount)}` : null;
    },
    async perform(id) {
      await prisma.milkSale.deleteMany({ where: { id } });
      return "Sale deleted.";
    },
  },

  MILK_USAGE: {
    paths: MILK_PATHS,
    async describe(id) {
      const r = await prisma.milkUsageRecord.findUnique({ where: { id } });
      return r ? `Milk used · ${day(r.date)} · ${r.type.replace("_USE", "").toLowerCase()} · ${r.litres} L` : null;
    },
    async perform(id) {
      const { count } = await prisma.milkUsageRecord.deleteMany({ where: { id } });
      if (count === 0) throw new ValidationError(GONE);
      return "Milk use deleted.";
    },
  },

  CUSTOMER_PAYMENT: {
    paths: [...MILK_PATHS, ...MONEY_PATHS],
    async describe(id) {
      const r = await prisma.customerPayment.findUnique({ where: { id } });
      return r ? `Customer payment · ${day(r.date)} · ${r.buyer} · ${rs(r.amount)}` : null;
    },
    async perform(id) {
      const existing = await prisma.customerPayment.findUnique({ where: { id } });
      if (!existing) throw new ValidationError(GONE);
      await prisma.$transaction(async (tx) => {
        await tx.customerPayment.delete({ where: { id } });
        if (existing.cashTransactionId) await tx.cashTransaction.deleteMany({ where: { id: existing.cashTransactionId } });
      });
      return "Payment deleted, along with its Cash Register entry.";
    },
  },

  FEED: {
    paths: ["/entry/feed", "/entry/daily", "/admin/reports/feed", "/admin"],
    async describe(id) {
      const r = await prisma.feedTransaction.findUnique({ where: { id } });
      if (!r) return null;
      return `Feed ${r.direction === "IN" ? "purchase" : "issue"} · ${day(r.date)} · ${r.feedType} · ${r.quantity}${r.rate ? ` at Rs ${r.rate}` : ""}`;
    },
    async check(id) {
      // No issue without stock: a purchase that was already used cannot be removed.
      const r = await prisma.feedTransaction.findUnique({ where: { id }, select: { feedType: true } });
      if (r) await assertStockHolds(r.feedType, (before) => before.filter((t) => t.id !== id), "removal");
    },
    async perform(id, actor) {
      const r = await prisma.feedTransaction.findUnique({ where: { id }, select: { feedType: true } });
      if (!r) throw new ValidationError(GONE);
      await prisma.feedTransaction.delete({ where: { id } });
      await repostFeedCosts([r.feedType], actor.name);
      return "Entry deleted and feed costs recalculated.";
    },
  },

  SALARY_PAYMENT: {
    paths: ["/admin/team", "/admin/reports/cash-register", "/admin/reports/cashflow", "/admin/reports/pl", "/admin"],
    async describe(id) {
      const r = await prisma.salaryPayment.findUnique({ where: { id }, include: { employee: { select: { name: true } } } });
      return r ? `Salary payment · ${day(r.date)} · ${r.employee.name} · ${rs(r.amount)}${r.forMonth ? ` · ${r.forMonth}` : ""}` : null;
    },
    async perform(id) {
      const existing = await prisma.salaryPayment.findUnique({ where: { id } });
      if (!existing) throw new ValidationError(GONE);
      await prisma.$transaction(async (tx) => {
        await tx.salaryPayment.delete({ where: { id } });
        if (existing.cashTransactionId) await tx.cashTransaction.deleteMany({ where: { id: existing.cashTransactionId } });
      });
      revalidatePath(`/admin/team/${existing.employeeId}`);
      return "Salary payment deleted, along with its Cash Register entry.";
    },
  },

  RESTOCK: {
    paths: ["/admin/health/medicines/stock", "/admin/health/medicines"],
    async describe(id) {
      const r = await prisma.medicineStockTransaction.findUnique({ where: { id }, include: { medicineDef: { select: { name: true } } } });
      return r && r.direction === "IN" ? `Medicine restock · ${day(r.date)} · ${r.medicineDef.name} · ${r.quantity}${r.cost ? ` · ${rs(r.cost)}` : ""}` : null;
    },
    async perform(id) {
      const { count } = await prisma.medicineStockTransaction.deleteMany({ where: { id, direction: "IN" } });
      if (count === 0) throw new ValidationError(GONE);
      return "Restock deleted.";
    },
  },
};

function refresh(entity: DeletableEntity) {
  for (const p of HANDLERS[entity].paths) revalidatePath(p);
  revalidatePath("/admin/approvals");
}

const audit = (who: string, whoId: string | null, action: string, requestId: string, note: string) =>
  prisma.auditLog.create({ data: { userId: whoId, userName: who, action, entity: "DeletionRequest", entityId: requestId, newValue: note } }).catch(() => undefined);

/**
 * The one way to delete a transaction. The caller has already checked the person may delete in that module.
 * Admin: deleted now. Anyone else: a request is saved for the Admin and nothing is deleted.
 */
export async function deleteOrRequest(user: LiveUser, entity: DeletableEntity, recordId: string): Promise<Outcome> {
  const handler = HANDLERS[entity];
  const summary = await handler.describe(recordId);
  if (summary === null) return { success: false, message: GONE };
  await handler.check?.(recordId);

  if (user.role === "ADMIN") {
    const message = await handler.perform(recordId, user);
    // A request that was waiting for this record is settled by the Admin deleting it directly.
    await prisma.deletionRequest.updateMany({
      where: { entity, recordId, status: "PENDING" },
      data: { status: "APPROVED", decidedBy: user.name, decidedAt: new Date(), decisionNote: "Deleted directly by the Admin." },
    });
    refresh(entity);
    return { success: true, message };
  }

  const waiting = await prisma.deletionRequest.findFirst({ where: { entity, recordId, status: "PENDING" }, select: { id: true } });
  if (waiting) return { success: true, message: "A request to delete this is already waiting for the Admin's approval. Nothing has been deleted." };
  const req = await prisma.deletionRequest.create({ data: { entity, recordId, summary, requestedById: user.id, requestedBy: user.name } });
  await audit(user.name, user.id, "delete_requested", req.id, `${ENTITY_LABEL[entity]}: ${summary}`);
  refresh(entity);
  return { success: true, message: "Sent to the Admin for approval. Nothing has been deleted yet." };
}

/** The Admin approves a request: the record is deleted now. If it cannot be (stock rule, linked record) the request stays waiting. */
export async function approveDeletion(requestId: string, admin: LiveUser): Promise<Outcome> {
  const req = await prisma.deletionRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") return { success: false, message: "That request has already been dealt with. Refresh the page." };
  const entity = req.entity as DeletableEntity;
  const handler = HANDLERS[entity];
  if (!handler) return { success: false, message: "Unknown kind of record." };

  const stillThere = (await handler.describe(req.recordId)) !== null;
  let message = "The record was already gone, so there was nothing to delete.";
  if (stillThere) {
    await handler.check?.(req.recordId);
    message = await handler.perform(req.recordId, admin);
  }
  await prisma.deletionRequest.update({ where: { id: requestId }, data: { status: "APPROVED", decidedBy: admin.name, decidedAt: new Date() } });
  await audit(admin.name, admin.id, "delete_approved", requestId, `${ENTITY_LABEL[entity]}: ${req.summary}`);
  refresh(entity);
  return { success: true, message };
}

export async function rejectDeletion(requestId: string, admin: LiveUser, note: string | null): Promise<Outcome> {
  const req = await prisma.deletionRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") return { success: false, message: "That request has already been dealt with. Refresh the page." };
  await prisma.deletionRequest.update({ where: { id: requestId }, data: { status: "REJECTED", decidedBy: admin.name, decidedAt: new Date(), decisionNote: note } });
  await audit(admin.name, admin.id, "delete_rejected", requestId, `${req.summary}${note ? ` (${note})` : ""}`);
  revalidatePath("/admin/approvals");
  return { success: true, message: "Request rejected. The record was kept." };
}

export const pendingDeletionCount = () => prisma.deletionRequest.count({ where: { status: "PENDING" } });
