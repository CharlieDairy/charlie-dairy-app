import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { parseCsv } from "./csv";
import { getBulkTypeMeta } from "./registry";
import type { BulkTypeKey, ImportResult } from "./types";

function cell(cells: string[], idx: number): string {
  return (cells[idx] ?? "").trim();
}
function req(cells: string[], idx: number, name: string, rowNum: number, errors: string[]): string {
  const v = cell(cells, idx);
  if (!v) errors.push(`Row ${rowNum}: "${name}" is required.`);
  return v;
}
function parseNum(cells: string[], idx: number, name: string, rowNum: number, errors: string[], required: boolean, fallback = 0): number {
  const raw = cell(cells, idx);
  if (!raw) {
    if (required) errors.push(`Row ${rowNum}: "${name}" is required.`);
    return fallback;
  }
  const n = Number(raw);
  if (Number.isNaN(n)) {
    errors.push(`Row ${rowNum}: "${name}" must be a number (got "${raw}").`);
    return fallback;
  }
  return n;
}
function parseOptNum(cells: string[], idx: number, name: string, rowNum: number, errors: string[]): number | null {
  const raw = cell(cells, idx);
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) {
    errors.push(`Row ${rowNum}: "${name}" must be a number (got "${raw}").`);
    return null;
  }
  return n;
}
function parseDate(cells: string[], idx: number, name: string, rowNum: number, errors: string[], required: boolean): Date | null {
  const raw = cell(cells, idx);
  if (!raw) {
    if (required) errors.push(`Row ${rowNum}: "${name}" is required.`);
    return null;
  }
  // Strict YYYY-MM-DD only: "3/4/2026" is 3 April in Pakistan but 4 March to
  // JavaScript, and would be imported silently wrong.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : new Date(NaN);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    errors.push(`Row ${rowNum}: "${name}" is not a valid date (expected YYYY-MM-DD, got "${raw}").`);
    return null;
  }
  if (d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) {
    errors.push(`Row ${rowNum}: "${name}" (${raw}) is outside the supported range 2000-2100.`);
    return null;
  }
  return d;
}
/** Records a row error unless `value` lies in [min, max]. */
function range(errors: string[], rowNum: number, name: string, value: number | null, min: number, max: number, exclusiveMin = false) {
  if (value === null) return;
  if (!Number.isFinite(value) || value > max || value < min || (exclusiveMin && value === min)) {
    errors.push(`Row ${rowNum}: "${name}" must be ${exclusiveMin ? "greater than" : "between"} ${min}${exclusiveMin ? "" : ` and ${max.toLocaleString("en-US")}`} (got ${value}).`);
  }
}
function parseEnum<T extends string>(
  cells: string[], idx: number, name: string, rowNum: number, errors: string[],
  allowed: readonly T[], fallback: T, required: boolean
): T {
  const raw = cell(cells, idx).toUpperCase();
  if (!raw) {
    if (required) errors.push(`Row ${rowNum}: "${name}" is required (one of ${allowed.join("/")}).`);
    return fallback;
  }
  if (!allowed.includes(raw as T)) {
    errors.push(`Row ${rowNum}: "${name}" must be one of ${allowed.join("/")} (got "${cell(cells, idx)}").`);
    return fallback;
  }
  return raw as T;
}

const FAIL = (message: string, errors: string[] = []): ImportResult => ({ success: false, message, errors, insertedCount: 0 });

export async function importCsv(key: BulkTypeKey, csvText: string, enteredBy: string | null): Promise<ImportResult> {
  const meta = getBulkTypeMeta(key);
  if (!meta) return FAIL("Unknown data type.");
  if (!meta.importable) return FAIL(`${meta.label} can be exported but not bulk-uploaded — it's derived from multi-step breeding logic. Use the dedicated entry forms instead.`);

  const rows = parseCsv(csvText);
  if (rows.length === 0) return FAIL("File is empty.");

  const [header, ...dataRows] = rows;
  if (header.length < meta.headers.length) {
    return FAIL(`Expected ${meta.headers.length} columns (${meta.headers.join(", ")}), found ${header.length}.`);
  }
  if (dataRows.length === 0) return FAIL("No data rows found below the header.");
  if (dataRows.length > 5000) {
    return FAIL(`File has ${dataRows.length} rows; the limit per upload is 5000. Split it into smaller files.`);
  }

  const errors: string[] = [];

  switch (key) {
    case "cows": {
      const parsed: Prisma.CowCreateManyInput[] = [];
      const seenTags = new Set<string>();
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const tag = req(cells, 0, "tag", rowNum, errors);
        if (tag) {
          if (seenTags.has(tag)) errors.push(`Row ${rowNum}: duplicate tag "${tag}" within this file.`);
          seenTags.add(tag);
        }
        const breed = cell(cells, 1) || null;
        const gender = parseEnum(cells, 2, "gender", rowNum, errors, ["FEMALE", "MALE", "UNKNOWN"] as const, "UNKNOWN", false);
        const status = parseEnum(cells, 3, "status", rowNum, errors, ["MILKING", "DRY", "HEIFER", "CALF", "INSEMINATED", "SOLD", "DEAD"] as const, "INSEMINATED", false);
        const dateOfBirth = parseDate(cells, 4, "dateOfBirth", rowNum, errors, false);
        const condition = cell(cells, 5) || null;
        const lastCalvingDate = parseDate(cells, 6, "lastCalvingDate", rowNum, errors, false);
        const nextAiDate = parseDate(cells, 7, "nextAiDate", rowNum, errors, false);
        const dryDate = parseDate(cells, 8, "dryDate", rowNum, errors, false);
        const expectedCalving = parseDate(cells, 9, "expectedCalving", rowNum, errors, false);
        const targetSellDate = parseDate(cells, 10, "targetSellDate", rowNum, errors, false);
        const lactationNumber = parseNum(cells, 11, "lactationNumber", rowNum, errors, false, 0);
        const purchasePrice = parseOptNum(cells, 12, "purchasePrice", rowNum, errors);
        range(errors, rowNum, "purchasePrice", purchasePrice, 0, 100_000_000);
        range(errors, rowNum, "lactationNumber", lactationNumber, 0, 30);
        const source = cell(cells, 13) || null;
        const notes = cell(cells, 14) || null;
        parsed.push({
          tag, breed, gender, status, dateOfBirth, condition, lastCalvingDate, nextAiDate, dryDate,
          expectedCalving, targetSellDate, lactationNumber, purchasePrice, source, notes,
        });
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);

      const existing = await prisma.cow.findMany({ where: { tag: { in: parsed.map((p) => p.tag) } }, select: { tag: true } });
      if (existing.length > 0) {
        return FAIL("Some tags already exist — nothing was imported.", existing.map((e) => `Tag "${e.tag}" already exists.`));
      }
      const result = await prisma.cow.createMany({ data: parsed });
      return { success: true, message: `Imported ${result.count} cows.`, errors: [], insertedCount: result.count };
    }

    case "milking": {
      const cows = await prisma.cow.findMany({ select: { id: true, tag: true } });
      const tagToId = new Map(cows.map((c) => [c.tag, c.id]));
      const parsed: Prisma.MilkingRecordCreateManyInput[] = [];
      const seenMilking = new Set<string>();
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const date = parseDate(cells, 0, "date", rowNum, errors, true);
        const tag = req(cells, 1, "cowTag", rowNum, errors);
        const cowId = tag ? tagToId.get(tag) : undefined;
        if (tag && !cowId) errors.push(`Row ${rowNum}: cow tag "${tag}" not found.`);
        const shift = parseEnum(cells, 2, "shift", rowNum, errors, ["MORNING", "AFTERNOON", "EVENING"] as const, "MORNING", true);
        const litres = parseNum(cells, 3, "litres", rowNum, errors, true);
        range(errors, rowNum, "litres", litres, 0, 200);
        const rowEnteredBy = cell(cells, 4) || enteredBy;
        if (date && cowId) {
          const dupKey = `${cowId}|${date.toISOString().slice(0, 10)}|${shift}`;
          if (seenMilking.has(dupKey)) errors.push(`Row ${rowNum}: cow "${tag}" already appears for ${shift.toLowerCase()} on ${date.toISOString().slice(0, 10)} earlier in this file.`);
          seenMilking.add(dupKey);
          parsed.push({ date, cowId, shift, litres, enteredBy: rowEnteredBy });
        }
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);

      // Re-uploading the same file must not silently double production.
      if (parsed.length > 0) {
        const times = parsed.map((r) => (r.date as Date).getTime());
        const existingRows = await prisma.milkingRecord.findMany({
          where: {
            cowId: { in: [...new Set(parsed.map((r) => r.cowId as string))] },
            date: { gte: new Date(Math.min(...times)), lte: new Date(Math.max(...times)) },
          },
          select: { cowId: true, date: true, shift: true },
        });
        const existingKeys = new Set(existingRows.map((r) => `${r.cowId}|${r.date.toISOString().slice(0, 10)}|${r.shift}`));
        const clashes = parsed.filter((r) => existingKeys.has(`${r.cowId}|${(r.date as Date).toISOString().slice(0, 10)}|${r.shift}`));
        if (clashes.length > 0) {
          return FAIL(
            `${clashes.length} row${clashes.length === 1 ? "" : "s"} match milking records that already exist — nothing was imported (was this file uploaded before?).`,
            clashes.slice(0, 20).map((r) => `${(r.date as Date).toISOString().slice(0, 10)} ${r.shift} for cow id ${r.cowId} already recorded.`)
          );
        }
      }
      const result = await prisma.milkingRecord.createMany({ data: parsed });
      return { success: true, message: `Imported ${result.count} milking records.`, errors: [], insertedCount: result.count };
    }

    case "milkSales": {
      const parsed: Prisma.MilkSaleCreateManyInput[] = [];
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const date = parseDate(cells, 0, "date", rowNum, errors, true);
        const buyer = req(cells, 1, "buyer", rowNum, errors);
        const litres = parseNum(cells, 2, "litres", rowNum, errors, true);
        const rate = parseOptNum(cells, 3, "rate", rowNum, errors);
        const fatPct = parseOptNum(cells, 4, "fatPct", rowNum, errors);
        const snf = parseOptNum(cells, 5, "snf", rowNum, errors);
        const amount = parseNum(cells, 6, "amount", rowNum, errors, true);
        range(errors, rowNum, "litres", litres, 0, 100_000, true);
        range(errors, rowNum, "rate", rate, 0, 10_000);
        range(errors, rowNum, "fatPct", fatPct, 0, 20);
        range(errors, rowNum, "snf", snf, 0, 20);
        range(errors, rowNum, "amount", amount, 0, 1_000_000_000);
        if (rate !== null && litres > 0 && Math.abs(amount - rate * litres) > Math.max(5, rate * litres * 0.05)) {
          errors.push(`Row ${rowNum}: amount ${amount} doesn't match litres × rate (${Math.round(rate * litres)}).`);
        }
        const rowEnteredBy = cell(cells, 7) || enteredBy;
        if (date && buyer) parsed.push({ date, buyer, litres, rate, fatPct, snf, amount, enteredBy: rowEnteredBy });
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);
      const result = await prisma.milkSale.createMany({ data: parsed });
      return { success: true, message: `Imported ${result.count} milk sales.`, errors: [], insertedCount: result.count };
    }

    case "feed": {
      const parsed: Prisma.FeedTransactionCreateManyInput[] = [];
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const date = parseDate(cells, 0, "date", rowNum, errors, true);
        const feedType = req(cells, 1, "feedType", rowNum, errors);
        const direction = parseEnum(cells, 2, "direction", rowNum, errors, ["IN", "OUT"] as const, "IN", true);
        const quantity = parseNum(cells, 3, "quantity", rowNum, errors, true);
        const rate = parseOptNum(cells, 4, "rate", rowNum, errors);
        const cost = parseOptNum(cells, 5, "cost", rowNum, errors);
        range(errors, rowNum, "quantity", quantity, 0, 10_000_000, true);
        range(errors, rowNum, "rate", rate, 0, 1_000_000);
        range(errors, rowNum, "cost", cost, 0, 10_000_000_000);
        const notes = cell(cells, 6) || null;
        const rowEnteredBy = cell(cells, 7) || enteredBy;
        if (date && feedType) parsed.push({ date, feedType, direction, quantity, rate, cost, notes, enteredBy: rowEnteredBy });
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);
      const result = await prisma.feedTransaction.createMany({ data: parsed });
      return { success: true, message: `Imported ${result.count} feed transactions.`, errors: [], insertedCount: result.count };
    }

    case "cash": {
      const parsed: Prisma.CashTransactionCreateManyInput[] = [];
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const date = parseDate(cells, 0, "date", rowNum, errors, true);
        const time = cell(cells, 1) || null;
        const account = cell(cells, 2) || null;
        const party = cell(cells, 3) || null;
        const category = req(cells, 4, "category", rowNum, errors);
        const mode = parseEnum(cells, 5, "mode", rowNum, errors, ["CASH", "BANK"] as const, "CASH", true);
        const amountIn = parseNum(cells, 6, "amountIn", rowNum, errors, false, 0);
        const amountOut = parseNum(cells, 7, "amountOut", rowNum, errors, false, 0);
        range(errors, rowNum, "amountIn", amountIn, 0, 1_000_000_000);
        range(errors, rowNum, "amountOut", amountOut, 0, 1_000_000_000);
        if (amountIn > 0 && amountOut > 0) errors.push(`Row ${rowNum}: only one of amountIn / amountOut may be filled.`);
        if (amountIn === 0 && amountOut === 0) errors.push(`Row ${rowNum}: amountIn and amountOut are both empty or zero.`);
        const rowEnteredBy = cell(cells, 8) || enteredBy;
        const projectLand = cell(cells, 9) || null;
        const remark = cell(cells, 10) || null;
        if (date && category) {
          parsed.push({ date, time, account, party, category, mode, amountIn, amountOut, enteredBy: rowEnteredBy, projectLand, remark });
        }
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);
      const result = await prisma.cashTransaction.createMany({ data: parsed });
      return { success: true, message: `Imported ${result.count} cash transactions.`, errors: [], insertedCount: result.count };
    }

    case "capital": {
      const parsed: Prisma.CapitalEntryCreateManyInput[] = [];
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const date = parseDate(cells, 0, "date", rowNum, errors, true);
        const partner = req(cells, 1, "partner", rowNum, errors);
        const description = req(cells, 2, "description", rowNum, errors);
        const debit = parseNum(cells, 3, "debit", rowNum, errors, false, 0);
        const credit = parseNum(cells, 4, "credit", rowNum, errors, false, 0);
        range(errors, rowNum, "debit", debit, 0, 10_000_000_000);
        range(errors, rowNum, "credit", credit, 0, 10_000_000_000);
        if (debit === 0 && credit === 0) errors.push(`Row ${rowNum}: debit and credit are both empty or zero.`);
        const bankAccount = cell(cells, 5) || null;
        const type = parseEnum(cells, 6, "type", rowNum, errors, ["CONTRIBUTION", "WITHDRAWAL", "LOAN", "REPAYMENT", "OTHER"] as const, "OTHER", false);
        const venture = cell(cells, 7) || null;
        if (date && partner && description) parsed.push({ date, partner, description, debit, credit, bankAccount, type, venture });
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);
      const result = await prisma.capitalEntry.createMany({ data: parsed });
      return { success: true, message: `Imported ${result.count} capital entries.`, errors: [], insertedCount: result.count };
    }

    case "assets": {
      const parsed: Prisma.AssetCreateManyInput[] = [];
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const assetClass = req(cells, 0, "assetClass", rowNum, errors);
        const details = req(cells, 1, "details", rowNum, errors);
        const qty = parseNum(cells, 2, "qty", rowNum, errors, true);
        const value = parseNum(cells, 3, "value", rowNum, errors, true);
        const depreciationPct = parseNum(cells, 4, "depreciationPct", rowNum, errors, false, 0);
        const yearLived = parseNum(cells, 5, "yearLived", rowNum, errors, false, 0);
        const currentValue = parseNum(cells, 6, "currentValue", rowNum, errors, true);
        range(errors, rowNum, "qty", qty, 0, 1_000_000, true);
        range(errors, rowNum, "value", value, 0, 10_000_000_000);
        range(errors, rowNum, "currentValue", currentValue, 0, 10_000_000_000);
        range(errors, rowNum, "depreciationPct", depreciationPct, 0, 100);
        const valuationDate = parseDate(cells, 7, "valuationDate", rowNum, errors, false);
        if (assetClass && details) {
          parsed.push({ assetClass, details, qty, value, depreciationPct, yearLived: Math.trunc(yearLived), currentValue, valuationDate });
        }
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);
      const result = await prisma.asset.createMany({ data: parsed });
      return { success: true, message: `Imported ${result.count} assets.`, errors: [], insertedCount: result.count };
    }

    default:
      return FAIL(`${meta.label} is not importable.`);
  }
}
