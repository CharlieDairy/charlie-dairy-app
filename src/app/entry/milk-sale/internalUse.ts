// Internal use shares the Milk Sale form's Customer dropdown so the page has
// one input, not two. It isn't a sale (no rate, no receivable): the action
// stores it as a MilkUsageRecord, which Production Reconciliation already
// reads for Calf/Farm/Employee Use.
export const INTERNAL_USE_OPTIONS = [
  { label: "Calf Use", type: "CALF_USE" },
  { label: "Farm Use", type: "FARM_USE" },
  { label: "Farm Employee", type: "EMPLOYEE_USE" },
] as const;
