import { prisma } from "@/lib/prisma";
import { getMonthlyPnl } from "./pnl";

export type DashboardSummary = {
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  netMargin: number;
  closingCash: number;
  activeHerdSize: number;
  totalMilkLitres: number;
  capitalRaised: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const monthly = await getMonthlyPnl();
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);
  const netIncome = totalRevenue - totalExpense;

  const [activeHerdSize, milkAgg, capitalAgg] = await Promise.all([
    prisma.cow.count({ where: { status: { in: ["MILKING", "DRY", "HEIFER", "CALF"] } } }),
    prisma.milkingRecord.aggregate({ _sum: { litres: true } }),
    prisma.capitalEntry.aggregate({ _sum: { credit: true, debit: true } }),
  ]);

  return {
    totalRevenue,
    totalExpense,
    netIncome,
    netMargin: totalRevenue > 0 ? netIncome / totalRevenue : 0,
    closingCash: netIncome, // cash-basis: net of all recorded cash in/out to date
    activeHerdSize,
    totalMilkLitres: milkAgg._sum.litres ?? 0,
    capitalRaised: (capitalAgg._sum.credit ?? 0) - (capitalAgg._sum.debit ?? 0),
  };
}
