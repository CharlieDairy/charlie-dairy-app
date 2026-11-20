import { prisma } from "@/lib/prisma";
import { classifyCash, isFeedCategory, netOf } from "@/lib/accounting/cashClass";
import type { FindingDraft, Rule } from "../types";

// Costs that repeat every month (each person's salary, fuel, A.I., medicine ...) should show up every month. This rule looks
// at the month just finished (and the current month once it is past the 25th, when salaries are normally paid) and says so
// when a cost that appeared in almost every one of the previous six months is missing, or when the month's total is far
// below normal, which usually means entries were not made. Feed is left out: it is costed from stock use, not payments.

export type CostRow = { month: string; category: string; remark: string; amount: number };
export type Person = { name: string; active: boolean };

const PRIOR = 6;
const MIN_PRESENT = 5; // appeared in at least this many of the prior 6 months => treated as recurring
const LOW_TOTAL = 0.5; // a month under half the usual total looks incomplete

export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-US")}`;
const monthName = (ym: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const isSalary = (category: string) => /salar/i.test(category);

/** Months to check: the month just finished, plus the current one once it is past the 25th. */
export function monthsToCheck(todayKey: string): string[] {
  const current = todayKey.slice(0, 7);
  const out = [shiftMonth(current, -1)];
  if (Number(todayKey.slice(8, 10)) >= 26) out.push(current);
  return out;
}

export function findRecurringGaps(rows: CostRow[], people: Person[], todayKey: string): FindingDraft[] {
  const findings: FindingDraft[] = [];
  const base = { ruleId: "opex.recurring", category: "DATA_ENTRY" as const, financeOnly: true };

  for (const month of monthsToCheck(todayKey)) {
    const prior = Array.from({ length: PRIOR }, (_, i) => shiftMonth(month, -(i + 1)));
    const inMonth = (m: string) => rows.filter((r) => r.month === m);

    // Each person's salary.
    for (const p of people.filter((x) => x.active)) {
      // The cash book writes "Basit salary" as often as "Abdul Basit salary", so the last word of the name is what is matched.
      const tag = p.name.trim().split(/\s+/).pop()!.toLowerCase();
      const mine = (m: string) => inMonth(m).filter((r) => isSalary(r.category) && r.remark.toLowerCase().includes(tag));
      const presentIn = prior.filter((m) => mine(m).length > 0).length;
      if (presentIn >= MIN_PRESENT && mine(month).length === 0) {
        findings.push({
          ...base, key: `opex.salary.${p.name.toLowerCase()}.${month}`, severity: "MEDIUM",
          title: `No salary recorded for ${p.name} in ${monthName(month)}`,
          detail: `${p.name}'s salary was recorded in ${presentIn} of the previous ${PRIOR} months but not in ${monthName(month)}. Salaries and advances are read from the Cash Register by the name in the remark.`,
          suggestion: `Enter ${p.name}'s ${monthName(month)} salary in the Cash Register (category Opex Salaries or Advance Salary, with the name in the remark), or mark this resolved if it is not due.`,
          metric: { person: p.name, month, presentInPrior: presentIn },
        });
      }
    }

    // Each other category that normally appears every month.
    const cats = new Map<string, string>(); // lower-case key -> label as written
    for (const r of rows) if (!isSalary(r.category) && prior.includes(r.month)) cats.set(r.category.trim().toLowerCase(), r.category.trim());
    for (const [k, label] of cats) {
      if (k === "" || k === "uncategorized") continue;
      const has = (m: string) => inMonth(m).some((r) => !isSalary(r.category) && r.category.trim().toLowerCase() === k);
      const presentIn = prior.filter(has).length;
      if (presentIn >= MIN_PRESENT && !has(month)) {
        findings.push({
          ...base, key: `opex.category.${k}.${month}`, severity: "LOW",
          title: `No "${label}" cost recorded in ${monthName(month)}`,
          detail: `"${label}" was recorded in ${presentIn} of the previous ${PRIOR} months but not in ${monthName(month)}.`,
          suggestion: `If there was such an expense, enter it in the Cash Register. If there was none, you can mark this as resolved.`,
          metric: { category: label, month, presentInPrior: presentIn },
        });
      }
    }

    // The month's whole operating cost (without feed) far below normal.
    const totalOf = (m: string) => inMonth(m).reduce((n, r) => n + r.amount, 0);
    const usual = median(prior.map(totalOf));
    const now = totalOf(month);
    if (usual > 0 && now < usual * LOW_TOTAL) {
      findings.push({
        ...base, key: `opex.total.${month}`, severity: "MEDIUM",
        title: `${monthName(month)} operating costs look incomplete`,
        detail: `Costs other than feed come to ${rs(now)} for ${monthName(month)}, against a usual ${rs(usual)} a month (the middle of the previous ${PRIOR} months). Some expenses were probably not entered.`,
        suggestion: "Check the petty cash book for entries that have not reached the Cash Register.",
        metric: { month, total: Math.round(now), usual: Math.round(usual) },
      });
    }
  }
  return findings;
}

export const opexRecurringRules: Rule[] = [
  {
    id: "opex.recurring",
    async run({ todayKey }) {
      const from = new Date(`${shiftMonth(todayKey.slice(0, 7), -8)}-01T00:00:00.000Z`);
      const [cash, people] = await Promise.all([
        prisma.cashTransaction.findMany({ where: { date: { gte: from } }, select: { date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true } }),
        prisma.employee.findMany({ select: { name: true, active: true } }),
      ]);
      const rows: CostRow[] = [];
      for (const c of cash) {
        if (classifyCash(c) !== "OPEX" || isFeedCategory(c.category)) continue;
        rows.push({ month: c.date.toISOString().slice(0, 7), category: c.category || "Uncategorized", remark: c.remark ?? "", amount: netOf("OPEX", c.amountIn, c.amountOut) });
      }
      return findRecurringGaps(rows, people, todayKey);
    },
  },
];
