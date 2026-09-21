import { prisma } from "@/lib/prisma";
import CashForm from "./CashForm";

export default async function CashEntryPage() {
  const rows = await prisma.cashTransaction.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = rows.map((r) => r.category);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Cash Entry</h1>
      <CashForm categories={categories} />
    </div>
  );
}
