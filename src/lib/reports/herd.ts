import { prisma } from "@/lib/prisma";

export type HerdRow = {
  cowId: string;
  tag: string;
  status: string;
  totalLitres: number;
  daysMilked: number;
  avgLitresPerDay: number;
  avgFatPct: number | null;
  avgSnfPct: number | null;
};


export async function getHerdSummary(): Promise<HerdRow[]> {
  const rows = await prisma.$queryRaw<
    {
      cowId: string;
      tag: string;
      status: string;
      totalLitres: number | null;
      daysMilked: number | bigint;
      avgFatPct: number | null;
      avgSnfPct: number | null;
    }[]
  >`
    SELECT c.id as "cowId", c.tag as tag, c.status as status,
           CAST(COALESCE(SUM(m.litres), 0) AS REAL) as "totalLitres",
           CAST(COUNT(DISTINCT m.date) AS REAL) as "daysMilked",
           CAST(AVG(m."fatPct") AS REAL) as "avgFatPct",
           CAST(AVG(m."snfPct") AS REAL) as "avgSnfPct"
    FROM "Cow" c
    LEFT JOIN "MilkingRecord" m ON m."cowId" = c.id
    GROUP BY c.id, c.tag, c.status
    ORDER BY CAST(c.tag AS INTEGER) ASC
  `;

  return rows.map((r) => {
    const daysMilked = Number(r.daysMilked);
    const totalLitres = r.totalLitres ?? 0;
    return {
      cowId: r.cowId,
      tag: r.tag,
      status: r.status,
      totalLitres,
      daysMilked,
      avgLitresPerDay: daysMilked > 0 ? totalLitres / daysMilked : 0,
      avgFatPct: r.avgFatPct,
      avgSnfPct: r.avgSnfPct,
    };
  });
}
