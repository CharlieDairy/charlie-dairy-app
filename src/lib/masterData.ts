import { prisma } from "@/lib/prisma";

export interface MasterCategoryDef {
  key: string;
  label: string;
  description: string;
  /** true = the underlying codes are fixed by app logic (e.g. status comparisons in breeding rules).
   *  Admins can rename the display label and hide (deactivate) a code, but can't add/remove codes. */
  locked: boolean;
  seedCodes?: { code: string; label: string }[];
}

export const MASTER_CATEGORIES: MasterCategoryDef[] = [
  {
    key: "COW_STATUS",
    label: "Cow Status",
    locked: true,
    description:
      "Lifecycle status on the Cow Register. Codes are fixed by breeding/health logic elsewhere in the app — only the display label and whether it's offered can change.",
    seedCodes: [
      { code: "MILKING", label: "Milking" },
      { code: "DRY", label: "Dry" },
      { code: "HEIFER", label: "Heifer" },
      { code: "CALF", label: "Calf" },
      { code: "DORMANT", label: "Dormant" },
      { code: "SOLD", label: "Sold" },
      { code: "DEAD", label: "Dead" },
    ],
  },
  {
    key: "COW_GENDER",
    label: "Cow Gender",
    locked: true,
    description: "Fixed by breeding logic (only FEMALE animals can breed/calve).",
    seedCodes: [
      { code: "FEMALE", label: "Female" },
      { code: "MALE", label: "Male" },
      { code: "UNKNOWN", label: "Unknown" },
    ],
  },
  {
    key: "MILKING_SHIFT",
    label: "Milking Shift",
    locked: true,
    description: "Fixed set used by milking entry and reports.",
    seedCodes: [
      { code: "MORNING", label: "Morning" },
      { code: "AFTERNOON", label: "Afternoon" },
      { code: "EVENING", label: "Evening" },
    ],
  },
  {
    key: "CASH_MODE",
    label: "Cash Mode",
    locked: true,
    description: "Fixed Cash/Bank split used by cash flow reports.",
    seedCodes: [
      { code: "CASH", label: "Cash" },
      { code: "BANK", label: "Bank" },
    ],
  },
  {
    key: "CAPITAL_ENTRY_TYPE",
    label: "Capital Entry Type",
    locked: true,
    description: "Fixed set used by the Capital Ledger.",
    seedCodes: [
      { code: "CONTRIBUTION", label: "Contribution" },
      { code: "WITHDRAWAL", label: "Withdrawal" },
      { code: "LOAN", label: "Loan" },
      { code: "REPAYMENT", label: "Repayment" },
      { code: "OTHER", label: "Other" },
    ],
  },
  {
    key: "FEED_DIRECTION",
    label: "Feed Direction",
    locked: true,
    description: "Fixed set used by feed inventory transactions.",
    seedCodes: [
      { code: "IN", label: "In (received)" },
      { code: "OUT", label: "Out (consumed)" },
    ],
  },
  {
    key: "FEED_TYPE",
    label: "Feed Types",
    locked: false,
    description: "Open list — add, rename or retire feed ingredient types used in feed entry.",
  },
  {
    key: "CASH_CATEGORY",
    label: "Cash Categories",
    locked: false,
    description: "Open list — add, rename or retire cash transaction categories.",
  },
  {
    key: "ASSET_CLASS",
    label: "Asset Classes",
    locked: false,
    description: "Open list — add, rename or retire asset classes on the Assets register.",
  },
  {
    key: "CAPITAL_PARTNER",
    label: "Capital Partners",
    locked: false,
    description: "Open list — the partners/parties who appear on the Capital Ledger.",
  },
];

export function getCategoryDef(key: string): MasterCategoryDef | undefined {
  return MASTER_CATEGORIES.find((c) => c.key === key);
}

/** code -> label for active items in a category. Falls back to the raw code for anything not in the master list. */
export async function getLabelMap(category: string): Promise<Map<string, string>> {
  const items = await prisma.masterDataItem.findMany({ where: { category }, orderBy: { sortOrder: "asc" } });
  return new Map(items.map((i) => [i.code, i.label]));
}

export function labelFor(map: Map<string, string>, code: string): string {
  return map.get(code) ?? code;
}
