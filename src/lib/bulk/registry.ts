import type { BulkTypeMeta } from "./types";

export const BULK_TYPES: BulkTypeMeta[] = [
  {
    key: "cows",
    label: "Cows (Register)",
    hasDateFilter: false,
    importable: true,
    headers: [
      "tag", "breed", "gender", "status", "dateOfBirth", "condition", "lastCalvingDate", "nextAiDate",
      "dryDate", "expectedCalving", "targetSellDate", "lactationNumber", "purchasePrice", "source", "notes",
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
    label: "Milk Sales & Internal Use",
    hasDateFilter: true,
    importable: true,
    headers: ["date", "buyer", "litres", "rate", "fatPct", "snf", "amount", "enteredBy"],
    note: 'To record milk usage, put "Calf Use", "Farm Use" or "Farm Employee" in the buyer column — those rows are saved as internal use (rate and amount ignored, leave them blank). Any other buyer is a normal sale and needs an amount.',
  },
  {
    key: "feed",
    label: "Feed Transactions",
    hasDateFilter: true,
    importable: true,
    headers: ["date", "feedType", "direction", "quantity", "rate", "cost", "notes", "enteredBy"],
    note: 'feedType must be a feed already in Feed Master (any capitalisation). direction is IN (received) or OUT (issued). Dates are YYYY-MM-DD. For an OUT row, leave cost blank and it is worked out as rate × quantity. To load opening stock, add one IN row per feed dated before your first usage (notes: "Opening stock").',
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
    headers: ["assetClass", "details", "qty", "value", "depreciationPct", "yearLived", "currentValue", "valuationDate", "photoUrl"],
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
