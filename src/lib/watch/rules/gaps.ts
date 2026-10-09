import { prisma } from "@/lib/prisma";
import { type FindingDraft, type Rule, addDays } from "../types";

// Things the app cannot do, capture or enforce yet. The "static" ones are
// permanent notes (sticky: once someone marks one resolved it stays resolved);
// the conditional ones check the data and clear themselves when fixed.
const STATIC: Omit<FindingDraft, "ruleId" | "category" | "sticky">[] = [
  { key: "gap.other-books", severity: "MEDIUM", financeOnly: true, title: "Only one of the CashBook books is in the app", detail: "CashBook has nine books. Only 'Charlie - daily petty cash' is loaded. Money paid into the bank (Meezan Bank Account, for example Engro milk sales) and the Agri costing, customer-credit and phase books are not, so bank receipts and those costs are missing from profit and cash.", suggestion: "Review each other book (some may duplicate petty cash transfers) and add the ones that hold real receipts or costs, starting with the bank account." },
  { key: "gap.month-close", severity: "MEDIUM", financeOnly: true, title: "No month-end close or period lock", detail: "Any past month can still be changed by an Admin, and nothing checks that a month's records are complete before its numbers are used.", suggestion: "Add a month-close checklist (all milk entered, sales reconciled, payments posted, cash counted, salaries paid) and lock the month once the owner approves." },
  { key: "gap.payables", severity: "MEDIUM", financeOnly: true, title: "Money owed to suppliers and other liabilities are not tracked", detail: "On a cash basis only payments made are recorded. Unpaid feed, medicine or supplier bills, loans and advances do not appear anywhere, so the Balance Sheet cannot show what the farm owes.", suggestion: "Record supplier bills as payables (Vendor Ledger) and loans as liabilities, even if the accounts stay cash-based." },
  { key: "gap.depreciation", severity: "LOW", financeOnly: true, title: "Asset depreciation is stored but never charged to the P&L", detail: "Each asset has a depreciation % and current value, but no monthly depreciation cost reaches profit.", suggestion: "Post a monthly depreciation figure for the P&L (non-cash) so true profit is visible." },
  { key: "gap.budget", severity: "LOW", financeOnly: true, title: "No budget or plan compared with actuals", detail: "Your workbook has a 'Plan vs Actual' sheet, but the app cannot compare what was planned with what happened.", suggestion: "Load the yearly plan by month and show variance on the dashboard." },
  { key: "gap.cost-per-cow", severity: "LOW", title: "No cost or margin per cow", detail: "Feed, medicine and labour are not allocated to individual animals, so it is not possible to see which cows earn more than they cost.", suggestion: "Allocate feed cost by group (milking, dry, heifer, calf) first, then per cow once feeding is recorded by group." },
  { key: "gap.milk-quality", severity: "LOW", title: "Fat %, SNF and CLR are not recorded", detail: "Your sheets track milk quality for Engro-type buyers, but the app has no place to enter it, so price differences by quality cannot be explained.", suggestion: "Add fat / SNF / CLR to Milk Sale Entry where a buyer pays by quality." },
  { key: "gap.alert-channel", severity: "LOW", title: "No way to be notified outside the app", detail: "Findings are only visible when someone opens Farm Watch. There is no daily message to a phone or email.", suggestion: "Send the daily brief by WhatsApp or email, with a short list of the day's High items." },
  { key: "gap.backup", severity: "MEDIUM", title: "Backups are manual", detail: "A full backup is a script that someone has to run (the last ones were taken around history loads). There is no automatic daily copy kept outside the database host.", suggestion: "Schedule an automatic daily backup and keep at least 30 days." },
  { key: "gap.two-step-signin", severity: "LOW", title: "No two-step sign-in", detail: "Anyone with an Admin password has full access, including finance and bulk delete.", suggestion: "Add a second sign-in step (code on phone) for Admin accounts." },
  { key: "gap.offline-entry", severity: "LOW", title: "Entry needs a phone signal", detail: "The shed may have poor coverage; an entry that fails to save is easy to lose.", suggestion: "Add offline entry that saves on the phone and sends when the signal returns." },
];

export const gapRules: Rule[] = [
  {
    id: "gap.static",
    async run() {
      return STATIC.map((g) => ({ ...g, ruleId: "gap.static", category: "GAP" as const, sticky: true }));
    },
  },
  {
    id: "gap.team-unused",
    async run({ today }) {
      const [employees, salaryLines] = await Promise.all([
        prisma.employee.count(),
        prisma.cashTransaction.count({ where: { date: { gte: addDays(today, -90) }, category: { contains: "Salar", mode: "insensitive" } } }),
      ]);
      if (employees > 0 || salaryLines === 0) return [];
      return [
        {
          key: "gap.team-unused",
          ruleId: "gap.team-unused",
          category: "GAP",
          severity: "MEDIUM",
          title: "The Team module is empty, but salaries are being paid",
          detail: `${salaryLines} salary / advance payments in the last 90 days are in the cash book only. There are no employees, attendance or salary records, so leave, advances and what each person is owed cannot be tracked.`,
          suggestion: "Add the employees, then record salaries with Salary Payment (which also writes the cash entry).",
        },
      ];
    },
  },
  {
    id: "gap.vendors-unused",
    async run({ today }) {
      const [vendors, parties] = await Promise.all([
        prisma.vendor.count(),
        prisma.cashTransaction.groupBy({ by: ["party"], where: { date: { gte: addDays(today, -180) }, amountOut: { gt: 0 }, party: { not: null } }, _count: { _all: true } }),
      ]);
      if (vendors > 0 || parties.length < 5) return [];
      return [
        {
          key: "gap.vendors-unused",
          ruleId: "gap.vendors-unused",
          category: "GAP",
          severity: "LOW",
          title: "No suppliers are set up although many payees appear in the cash book",
          detail: `${parties.length} different payees were paid in the last 6 months, but the Vendor Ledger is empty, so spending per supplier and what is owed to each cannot be seen.`,
          suggestion: "Create the main suppliers (feed, medicine, fuel, repairs) and use the same names on cash entries.",
        },
      ];
    },
  },
  {
    id: "gap.unconfirmed-status",
    async run() {
      const cows = await prisma.cow.findMany({ where: { notes: { contains: "not confirmed", mode: "insensitive" } }, select: { tag: true, status: true } });
      if (cows.length === 0) return [];
      return [
        {
          key: "gap.unconfirmed-status",
          ruleId: "gap.unconfirmed-status",
          category: "GAP",
          severity: "LOW",
          title: `${cows.length} animal${cows.length === 1 ? " has" : "s have"} a status that still needs confirming`,
          detail: cows.map((c) => `Cow ${c.tag} (currently ${c.status})`).join("; ") + ". These were created from milk history and the real status (sold, died, dry) is not in the workbooks.",
          suggestion: "Open the animal, set the correct status, and clear the note.",
        },
      ];
    },
  },
];
