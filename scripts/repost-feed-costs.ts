// Re-costs every feed issue first-in, first-out.
//
//   npx tsx scripts/repost-feed-costs.ts            preview only: nothing is written
//   npx tsx scripts/repost-feed-costs.ts --apply    write the new costs (take a backup first)
//
// The preview shows, per feed, what the stored cost is today and what first-in, first-out makes it, then the same by month.
import { prisma } from "@/lib/prisma";
import { runFifo, type FifoTx } from "@/lib/feedFifo";
import { repostFeedCosts } from "@/lib/feedCosting";

const money = (n: number) => Math.round(n).toLocaleString("en-PK");

async function main() {
  const rows = await prisma.feedTransaction.findMany({
    select: { id: true, date: true, createdAt: true, feedType: true, direction: true, quantity: true, rate: true, cost: true },
  });
  const feeds = [...new Set(rows.map((r) => r.feedType))].sort();
  const byMonth = new Map<string, { old: number; fifo: number }>();

  console.log("Feed".padEnd(13), "issues".padStart(7), "stored cost".padStart(14), "FIFO cost".padStart(14), "difference".padStart(12), "  estimated qty", " unpriced qty", " stock left", "  stock value");
  for (const feed of feeds) {
    const list = rows.filter((r) => r.feedType === feed);
    const res = runFifo(list.map((r): FifoTx => ({ id: r.id, date: r.date, createdAt: r.createdAt, direction: r.direction, quantity: r.quantity, rate: r.rate })));
    let issues = 0, oldTotal = 0, newTotal = 0, est = 0, unpriced = 0;
    for (const r of list) {
      if (r.direction !== "OUT") continue;
      const issue = res.issues.get(r.id);
      issues++;
      oldTotal += r.cost ?? 0;
      newTotal += issue?.cost ?? 0;
      est += issue?.estimatedQty ?? 0;
      unpriced += issue?.unpricedQty ?? 0;
      const m = r.date.toISOString().slice(0, 7);
      const e = byMonth.get(m) ?? { old: 0, fifo: 0 };
      e.old += r.cost ?? 0;
      e.fifo += issue?.cost ?? 0;
      byMonth.set(m, e);
    }
    console.log(
      feed.padEnd(13), String(issues).padStart(7), money(oldTotal).padStart(14), money(newTotal).padStart(14), money(newTotal - oldTotal).padStart(12),
      money(est).padStart(15), money(unpriced).padStart(13), money(res.onHand).padStart(11), money(res.stockValue).padStart(13)
    );
  }
  console.log("\nBy month (all feeds)         stored cost      FIFO cost");
  for (const [m, e] of [...byMonth].sort()) console.log(m.padEnd(12), money(e.old).padStart(22), money(e.fifo).padStart(14));

  if (process.argv.includes("--apply")) {
    const r = await repostFeedCosts(undefined, "Script (FIFO re-cost)");
    console.log(`\nApplied: ${r.feeds} feeds, ${r.checked} issues checked, ${r.changed} costs changed.`);
  } else {
    console.log("\nPreview only. Nothing was written. Run again with --apply to save these costs.");
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
