import { prisma } from "@/lib/prisma";
import { getTodaysSellableBalance } from "@/lib/reports/reconciliation";
import MilkSaleForm from "./MilkSaleForm";

export default async function MilkSaleEntryPage() {
  const [rows, balance] = await Promise.all([
    prisma.milkSale.findMany({
      select: { buyer: true },
      distinct: ["buyer"],
      orderBy: { buyer: "asc" },
    }),
    getTodaysSellableBalance(),
  ]);
  const buyers = rows.map((r) => r.buyer);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Milk Sale Entry</h1>
      <div className="max-w-md rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <p className="font-medium text-neutral-700">Available to sell today: {balance.available.toFixed(1)} L</p>
        <p className="text-xs text-neutral-500 mt-1">
          {balance.produced.toFixed(1)} L produced − {(balance.farmUse + balance.employeeUse).toFixed(1)} L farm/employee use
          − {balance.sold.toFixed(1)} L already sold today. Guidance only, not enforced — opening stock or multi-day
          carryover isn&apos;t reflected here.
        </p>
      </div>
      <MilkSaleForm buyers={buyers} />
    </div>
  );
}
