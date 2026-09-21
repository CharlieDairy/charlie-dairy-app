import { prisma } from "@/lib/prisma";
import { stringifyCsv } from "./csv";
import { getBulkTypeMeta } from "./registry";
import type { BulkTypeKey } from "./types";

function dateOnly(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
function num(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

function dateWhere(from?: Date, to?: Date): { date?: { gte?: Date; lte?: Date } } {
  if (!from && !to) return {};
  const date: { gte?: Date; lte?: Date } = {};
  if (from) date.gte = from;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    date.lte = end;
  }
  return { date };
}

export async function exportCsv(
  key: BulkTypeKey,
  opts: { from?: Date; to?: Date; templateOnly?: boolean } = {}
): Promise<{ filename: string; csv: string }> {
  const meta = getBulkTypeMeta(key);
  if (!meta) throw new Error(`Unknown bulk type: ${key}`);

  const rows: string[][] = [meta.headers];

  if (!opts.templateOnly) {
    switch (key) {
      case "cows": {
        const data = await prisma.cow.findMany({ orderBy: { tag: "asc" } });
        rows.push(
          ...data.map((c) => [
            c.tag, c.gender, c.status, c.condition ?? "",
            dateOnly(c.lastCalvingDate), dateOnly(c.nextAiDate), dateOnly(c.dryDate),
            dateOnly(c.expectedCalving), dateOnly(c.targetSellDate),
            String(c.lactationNumber), c.notes ?? "",
          ])
        );
        break;
      }
      case "milking": {
        const data = await prisma.milkingRecord.findMany({
          where: dateWhere(opts.from, opts.to),
          include: { cow: { select: { tag: true } } },
          orderBy: { date: "asc" },
        });
        rows.push(...data.map((r) => [dateOnly(r.date), r.cow?.tag ?? "", r.shift, num(r.litres), r.enteredBy ?? ""]));
        break;
      }
      case "milkSales": {
        const data = await prisma.milkSale.findMany({ where: dateWhere(opts.from, opts.to), orderBy: { date: "asc" } });
        rows.push(
          ...data.map((r) => [dateOnly(r.date), r.buyer, num(r.litres), num(r.rate), num(r.fatPct), num(r.snf), num(r.amount), r.enteredBy ?? ""])
        );
        break;
      }
      case "feed": {
        const data = await prisma.feedTransaction.findMany({ where: dateWhere(opts.from, opts.to), orderBy: { date: "asc" } });
        rows.push(
          ...data.map((r) => [dateOnly(r.date), r.feedType, r.direction, num(r.quantity), num(r.rate), num(r.cost), r.notes ?? "", r.enteredBy ?? ""])
        );
        break;
      }
      case "cash": {
        const data = await prisma.cashTransaction.findMany({ where: dateWhere(opts.from, opts.to), orderBy: { date: "asc" } });
        rows.push(
          ...data.map((r) => [
            dateOnly(r.date), r.time ?? "", r.account ?? "", r.party ?? "", r.category, r.mode,
            num(r.amountIn), num(r.amountOut), r.enteredBy ?? "", r.projectLand ?? "", r.remark ?? "",
          ])
        );
        break;
      }
      case "capital": {
        const data = await prisma.capitalEntry.findMany({ where: dateWhere(opts.from, opts.to), orderBy: { date: "asc" } });
        rows.push(
          ...data.map((r) => [dateOnly(r.date), r.partner, r.description, num(r.debit), num(r.credit), r.bankAccount ?? "", r.type, r.venture ?? ""])
        );
        break;
      }
      case "assets": {
        const data = await prisma.asset.findMany({ orderBy: { assetClass: "asc" } });
        rows.push(
          ...data.map((r) => [
            r.assetClass, r.details, num(r.qty), num(r.value), num(r.depreciationPct),
            String(r.yearLived), num(r.currentValue), dateOnly(r.valuationDate), r.photoUrl ?? "",
          ])
        );
        break;
      }
      case "heatEvents": {
        const data = await prisma.heatEvent.findMany({
          where: opts.from || opts.to ? { detectedAt: dateWhere(opts.from, opts.to).date } : {},
          include: { cow: { select: { tag: true } } },
          orderBy: { detectedAt: "asc" },
        });
        rows.push(
          ...data.map((r) => [dateOnly(r.detectedAt), r.cow.tag, r.detectionMethod, r.intensity ?? "", r.notes ?? "", r.enteredBy ?? ""])
        );
        break;
      }
      case "inseminations": {
        const data = await prisma.insemination.findMany({
          where: dateWhere(opts.from, opts.to),
          include: { cow: { select: { tag: true } } },
          orderBy: { date: "asc" },
        });
        rows.push(
          ...data.map((r) => [
            dateOnly(r.date), r.cow.tag, r.method, r.semenBatch ?? "", r.bullTag ?? "", r.technician ?? "",
            String(r.serviceNumber), num(r.cost), r.notes ?? "", r.enteredBy ?? "",
          ])
        );
        break;
      }
      case "pregnancyChecks": {
        const data = await prisma.pregnancyCheck.findMany({
          where: dateWhere(opts.from, opts.to),
          include: { cow: { select: { tag: true } } },
          orderBy: { date: "asc" },
        });
        rows.push(
          ...data.map((r) => [dateOnly(r.date), r.cow.tag, r.method, r.result, r.notes ?? "", r.performedBy ?? ""])
        );
        break;
      }
      case "calvings": {
        const data = await prisma.calving.findMany({
          where: dateWhere(opts.from, opts.to),
          include: { dam: { select: { tag: true } } },
          orderBy: { date: "asc" },
        });
        rows.push(
          ...data.map((r) => [
            dateOnly(r.date), r.dam.tag, r.sireTag ?? "", num(r.gestationDays), r.difficulty,
            r.retainedPlacenta ? "true" : "false", r.complications ?? "", String(r.calfCount), r.notes ?? "", r.enteredBy ?? "",
          ])
        );
        break;
      }
      case "calves": {
        const data = await prisma.calf.findMany({
          include: { calving: { include: { dam: { select: { tag: true } } } }, cow: { select: { tag: true } } },
          orderBy: { createdAt: "asc" },
        });
        rows.push(
          ...data.map((r) => [
            r.calvingId, r.calving.dam.tag, r.cow?.tag ?? "", r.sex, r.outcome, num(r.birthWeight), r.tag ?? "", r.notes ?? "",
          ])
        );
        break;
      }
    }
  }

  const rangeSuffix = opts.templateOnly
    ? "_template"
    : opts.from || opts.to
      ? `_${opts.from ? dateOnly(opts.from) : "start"}_to_${opts.to ? dateOnly(opts.to) : "end"}`
      : "";
  const filename = `${key}${rangeSuffix}.csv`;
  return { filename, csv: stringifyCsv(rows) };
}
