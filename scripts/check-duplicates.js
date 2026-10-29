// Read-only: lists any day that has more than one milk record for the same cow and shift, more than one sale for
// the same buyer, more than one use record of a type, or more than one feed row of the same feed and direction.
//   node scripts/check-duplicates.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const d = (x) => x.toISOString().slice(0, 10);

(async () => {
  const milk = await prisma.$queryRaw`SELECT "cowId", date, shift, COUNT(*)::int n, SUM(litres) litres FROM "MilkingRecord" WHERE "cowId" IS NOT NULL GROUP BY 1,2,3 HAVING COUNT(*)>1 ORDER BY date`;
  const sales = await prisma.$queryRaw`SELECT buyer, date, COUNT(*)::int n, SUM(litres) litres FROM "MilkSale" GROUP BY 1,2 HAVING COUNT(*)>1 ORDER BY date`;
  const use = await prisma.$queryRaw`SELECT type, date, COUNT(*)::int n, SUM(litres) litres FROM "MilkUsageRecord" GROUP BY 1,2 HAVING COUNT(*)>1 ORDER BY date`;
  const feed = await prisma.$queryRaw`SELECT "feedType", direction, date, COUNT(*)::int n, SUM(quantity) q FROM "FeedTransaction" GROUP BY 1,2,3 HAVING COUNT(*)>1 ORDER BY date`;
  const mixed = await prisma.$queryRaw`SELECT m.date, m.shift, COUNT(*)::int n FROM "MilkingRecord" m WHERE m."cowId" IS NULL AND EXISTS (SELECT 1 FROM "MilkingRecord" c WHERE c."cowId" IS NOT NULL AND c.date=m.date AND c.shift=m.shift) GROUP BY 1,2 ORDER BY 1`;
  console.log("milk cow+shift duplicates:", milk.length);
  for (const r of milk.slice(0, 40)) console.log(" ", r.cowId, d(r.date), r.shift, r.n, r.litres);
  console.log("sales same buyer+day:", sales.length);
  for (const r of sales.slice(0, 60)) console.log(" ", r.buyer, d(r.date), r.n, r.litres);
  console.log("usage same type+day:", use.length);
  for (const r of use.slice(0, 40)) console.log(" ", r.type, d(r.date), r.n, r.litres);
  console.log("feed same feed+direction+day:", feed.length);
  for (const r of feed.slice(0, 40)) console.log(" ", r.feedType, r.direction, d(r.date), r.n, r.q);
  console.log("group total AND cow rows on same day/shift:", mixed.length);
  for (const r of mixed.slice(0, 40)) console.log(" ", d(r.date), r.shift);
  await prisma.$disconnect();
})();
