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
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    errors.push(`Row ${rowNum}: "${name}" is not a valid date (expected YYYY-MM-DD, got "${raw}").`);
    return null;
  }
  return d;
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
        const gender = parseEnum(cells, 1, "gender", rowNum, errors, ["FEMALE", "MALE", "UNKNOWN"] as const, "UNKNOWN", false);
        const status = parseEnum(cells, 2, "status", rowNum, errors, ["MILKING", "DRY", "HEIFER", "CALF", "DORMANT", "SOLD", "DEAD"] as const, "DORMANT", false);
        const condition = cell(cells, 3) || null;
        const lastCalvingDate = parseDate(cells, 4, "lastCalvingDate", rowNum, errors, false);
        const nextAiDate = parseDate(cells, 5, "nextAiDate", rowNum, errors, false);
        const dryDate = parseDate(cells, 6, "dryDate", rowNum, errors, false);
        const expectedCalving = parseDate(cells, 7, "expectedCalving", rowNum, errors, false);
        const targetSellDate = parseDate(cells, 8, "targetSellDate", rowNum, errors, false);
        const lactationNumber = parseNum(cells, 9, "lactationNumber", rowNum, errors, false, 0);
        const notes = cell(cells, 10) || null;
        parsed.push({ tag, gender, status, condition, lastCalvingDate, nextAiDate, dryDate, expectedCalving, targetSellDate, lactationNumber, notes });
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
      dataRows.forEach((cells, i) => {
        const rowNum = i + 2;
        const date = parseDate(cells, 0, "date", rowNum, errors, true);
        const tag = req(cells, 1, "cowTag", rowNum, errors);
        const cowId = tag ? tagToId.get(tag) : undefined;
        if (tag && !cowId) errors.push(`Row ${rowNum}: cow tag "${tag}" not found.`);
        const shift = parseEnum(cells, 2, "shift", rowNum, errors, ["MORNING", "AFTERNOON", "EVENING"] as const, "MORNING", true);
        const litres = parseNum(cells, 3, "litres", rowNum, errors, true);
        const rowEnteredBy = cell(cells, 4) || enteredBy;
        if (date && cowId) parsed.push({ date, cowId, shift, litres, enteredBy: rowEnteredBy });
      });
      if (errors.length > 0) return FAIL("Fix the errors below and re-upload. Nothing was imported.", errors);
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
