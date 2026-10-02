import { prisma } from "@/lib/prisma";
import { getActiveWithdrawals } from "@/lib/reports/withdrawal";
import WithdrawalWarningBanner from "@/components/WithdrawalWarningBanner";
import MilkSaleForm from "./MilkSaleForm";

// Recording only: the sales ledger, reconciliation and customer balances
// live on their own report pages (Milk Sales, Production Reconciliation,
// Customers), not here.
export default async function MilkSaleEntryPage() {
  const [customers, activeWithdrawals] = await Promise.all([
    prisma.customer.findMany({ where: { active: true }, select: { id: true, name: true, agreedRate: true }, orderBy: { name: "asc" } }),
    getActiveWithdrawals(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Milk Sale Entry</h1>
      <WithdrawalWarningBanner withdrawals={activeWithdrawals} />
      <MilkSaleForm customers={customers} />
    </div>
  );
}
