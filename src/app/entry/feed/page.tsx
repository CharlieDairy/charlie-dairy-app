import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import FeedForm from "./FeedForm";

export default async function FeedEntryPage() {
  const [items, sums] = await Promise.all([
    prisma.feedItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true, unit: true } }),
    prisma.feedTransaction.groupBy({ by: ["feedType", "direction"], _sum: { quantity: true } }),
  ]);

  // Stock on hand per feed (all IN minus all OUT), shown next to the picker so
  // you can see what's left before issuing.
  const stock: Record<string, number> = {};
  for (const s of sums) {
    stock[s.feedType] = (stock[s.feedType] ?? 0) + (s.direction === "IN" ? 1 : -1) * (s._sum.quantity ?? 0);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Feed Entry</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/reports/feed" className="link-btn">Balances &amp; history →</Link>
          <Link href="/admin/feed/items" className="link-btn">Feed Master</Link>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">
          There are no feeds yet. Add them in <Link href="/admin/feed/items" className="text-primary underline">Feed Master</Link> first,
          then record purchases and daily issues here.
        </p>
      ) : (
        <FeedForm items={items} stock={stock} today={farmDateKey()} />
      )}
    </div>
  );
}
