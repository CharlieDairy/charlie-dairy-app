import { prisma } from "@/lib/prisma";
import FeedForm from "./FeedForm";

export default async function FeedEntryPage() {
  const [historical, master] = await Promise.all([
    prisma.feedTransaction.findMany({ select: { feedType: true }, distinct: ["feedType"] }),
    prisma.feedItem.findMany({ where: { active: true }, select: { name: true } }),
  ]);
  const feedTypes = Array.from(new Set([...master.map((m) => m.name), ...historical.map((h) => h.feedType)])).sort();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Feed Entry</h1>
      <FeedForm feedTypes={feedTypes} />
    </div>
  );
}
