export type BulkTypeKey =
  | "cows"
  | "milking"
  | "milkSales"
  | "feed"
  | "cash"
  | "capital"
  | "assets"
  | "heatEvents"
  | "inseminations"
  | "pregnancyChecks"
  | "calvings"
  | "calves";

export interface BulkTypeMeta {
  key: BulkTypeKey;
  label: string;
  headers: string[];
  hasDateFilter: boolean;
  /** false = export/download only; bulk upload isn't offered (multi-table business rules make raw import unsafe). */
  importable: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  errors: string[];
  insertedCount: number;
}
