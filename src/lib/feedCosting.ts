import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runFifo, type FifoTx } from "@/lib/feedFifo";

export const FEED_COST_AUDIT = { entity: "FeedCost", action: "feed_cost_recalculated" } as const;

export type Repost = { feeds: number; checked: number; changed: number };

/**
 * Re-costs the feed issues (OUT) of the given feeds (all feeds when none are named) by first-in, first-out.
 * Call it after any change to feed entries: a new purchase, an edit, a delete or a back-dated entry can change the cost of
 * every issue after it, so the whole history of that feed is recalculated. Only rows whose cost actually changes are written,
 * in one statement, and the run leaves a single Audit Log line instead of one per row.
 */
export async function repostFeedCosts(feedTypes?: string[], who = "System (FIFO)"): Promise<Repost> {
  const names = feedTypes ? [...new Set(feedTypes)] : undefined;
  if (names && names.length === 0) return { feeds: 0, checked: 0, changed: 0 };

  const rows = await prisma.feedTransaction.findMany({
    where: names ? { feedType: { in: names } } : undefined,
    select: { id: true, date: true, createdAt: true, feedType: true, direction: true, quantity: true, rate: true, cost: true },
  });
  const byFeed = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byFeed.get(r.feedType);
    if (list) list.push(r);
    else byFeed.set(r.feedType, [r]);
  }

  const setCost: { id: string; cost: number }[] = [];
  const clearCost: string[] = [];
  let checked = 0;
  for (const list of byFeed.values()) {
    const txs: FifoTx[] = list.map((r) => ({ id: r.id, date: r.date, createdAt: r.createdAt, direction: r.direction, quantity: r.quantity, rate: r.rate }));
    const { issues } = runFifo(txs);
    for (const r of list) {
      if (r.direction !== "OUT") continue;
      checked++;
      const next = issues.get(r.id)?.cost ?? null;
      if (next === null) {
        if (r.cost !== null) clearCost.push(r.id);
      } else if (r.cost === null || Math.abs(r.cost - next) > 0.004) {
        setCost.push({ id: r.id, cost: next });
      }
    }
  }

  // Receipts never carry a cost; clear any left over from an entry that was edited from Out to In.
  const staleIn = rows.filter((r) => r.direction === "IN" && r.cost !== null).map((r) => r.id);
  clearCost.push(...staleIn);

  const CHUNK = 500;
  for (let i = 0; i < setCost.length; i += CHUNK) {
    const part = setCost.slice(i, i + CHUNK);
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "FeedTransaction" AS f SET "cost" = v.cost FROM (SELECT unnest(${part.map((p) => p.id)}::text[]) AS id, unnest(${part.map((p) => p.cost)}::float8[]) AS cost) AS v WHERE f."id" = v.id`
    );
  }
  for (let i = 0; i < clearCost.length; i += CHUNK) {
    const part = clearCost.slice(i, i + CHUNK);
    await prisma.$executeRaw(Prisma.sql`UPDATE "FeedTransaction" SET "cost" = NULL WHERE "id" = ANY(${part}::text[])`);
  }

  const changed = setCost.length + clearCost.length;
  if (changed > 0) {
    await prisma.auditLog
      .create({
        data: {
          userName: who,
          action: FEED_COST_AUDIT.action,
          entity: FEED_COST_AUDIT.entity,
          newValue: JSON.stringify({ feeds: [...byFeed.keys()], issuesChecked: checked, costsChanged: changed }),
        },
      })
      .catch(() => undefined);
  }
  return { feeds: byFeed.size, checked, changed };
}
