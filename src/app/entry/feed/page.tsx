import { prisma } from "@/lib/prisma";
import FeedForm from "./FeedForm";

export default async function FeedEntryPage() {
  const rows = await prisma.feedTransaction.findMany({
    select: { feedType: true },
    distinct: ["feedType"],
    orderBy: { feedType: "asc" },
  });
  const feedTypes = rows.map((r) => r.feedType);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Feed Entry</h1>
      <FeedForm feedTypes={feedTypes} />
    </div>
  );
}
