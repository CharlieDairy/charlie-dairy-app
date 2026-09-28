import { prisma } from "@/lib/prisma";
import CashForm from "./CashForm";

export default async function CashEntryPage() {
  const [rows, vendors] = await Promise.all([
    prisma.cashTransaction.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    prisma.vendor.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const categories = rows.map((r) => r.category);
  const vendorNames = vendors.map((v) => v.name);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Cash Entry</h1>
      <CashForm categories={categories} vendorNames={vendorNames} />
    </div>
  );
}
