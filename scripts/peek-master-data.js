const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.masterDataItem.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  const byCategory = {};
  for (const r of rows) { (byCategory[r.category] ??= []).push(r.label); }
  console.log(JSON.stringify(byCategory, null, 2));
  await prisma.$disconnect();
})();
