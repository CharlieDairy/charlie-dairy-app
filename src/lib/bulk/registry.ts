import type { BulkTypeMeta } from "./types";

export const BULK_TYPES: BulkTypeMeta[] = [
  {
    key: "cows",
    label: "Cows (Register)",
    hasDateFilter: false,
    importable: true,
    headers: [
      "tag", "gender", "status", "condition", "lastCalvingDate", "nextAiDate",
      "dryDate", "expectedCalving", "targetSellDate", "lactationNumber", "notes",
    ],
  },
  {
    key: "milking",
    label: "Milking Records",
    hasDateFilter: true,
    importable: true,
    headers: ["date", "cowTag", "shift", "litres", "enteredBy"],
  },
  {
    key: "milkSales",
    label: "Milk Sales",
    hasDateFilter: true,
    importable: true,
    headers: ["date", "buyer", "litres", "rate", "fatPct", "snf", "amount", "enteredBy"],
  },
  {
    key: "feed",
    label: "Feed Transactions",
    hasDateFilter: true,
    importable: true,
    headers: ["date", "feedType", "direction", "quantity", "rate", "cost", "notes", "enteredBy"],
  },
  {
    key: "cash",
    label: "Cash Transactions",
    hasDateFilter: true,
    importable: true,
    headers: [
      "date", "time", "account", "party", "category", "mode",
      "amountIn", "amountOut", "enteredBy", "projectLand", "remark",
    ],
  },
  {
    key: "capital",
    label: "Capital Entries",
    hasDateFilter: true,
    importable: true,
    headers: ["date", "partner", "description", "debit", "credit", "bankAccount", "type", "venture"],
  },
  {
    key: "assets",
    label: "Assets",
    hasDateFilter: false,
    importable: true,
    headers: ["assetClass", "details", "qty", "value", "depreciationPct", "yearLived", "currentValue", "valuationDate"],
  },
  {
    key: "heatEvents",
    label: "Heat Events (Breeding)",
    hasDateFilter: true,
    importable: false,
    headers: ["detectedAt", "cowTag", "detectionMethod", "intensity", "notes", "enteredBy"],
  },
  {
    key: "inseminations",
    label: "Inseminations (Breeding)",
    hasDateFilter: true,
    importable: false,
    headers: ["date", "cowTag", "method", "semenBatch", "bullTag", "technician", "serviceNumber", "cost", "notes", "enteredBy"],
  },
  {
    key: "pregnancyChecks",
    label: "Pregnancy Checks (Breeding)",
    hasDateFilter: true,
    importable: false,
    headers: ["date", "cowTag", "method", "result", "notes", "performedBy"],
  },
  {
    key: "calvings",
    label: "Calvings (Breeding)",
    hasDateFilter: true,
    importable: false,
    headers: ["date", "damTag", "sireTag", "gestationDays", "difficulty", "retainedPlacenta", "complications", "calfCount", "notes", "enteredBy"],
  },
  {
    key: "calves",
    label: "Calves (Breeding)",
    hasDateFilter: false,
    importable: false,
    headers: ["calvingId", "damTag", "cowTag", "sex", "outcome", "birthWeight", "tag", "notes"],
  },
];

export function getBulkTypeMeta(key: string): BulkTypeMeta | undefined {
  return BULK_TYPES.find((t) => t.key === key);
}
