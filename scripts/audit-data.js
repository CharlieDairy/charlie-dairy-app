// Read-only audit of the live database: one record per animal plus the farm-wide checks.
//   node scripts/audit-data.js <output.json>
// Nothing is written to the database.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const DAY = 86_400_000;

(async () => {
  const p = new PrismaClient();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  const cows = await p.cow.findMany({
    include: {
      vaccinations: { orderBy: { date: "desc" } },
      treatments: { orderBy: { date: "desc" } },
      weightRecords: { orderBy: { date: "desc" } },
      inseminations: { orderBy: { date: "desc" } },
      pregnancyChecks: { orderBy: { date: "desc" } },
      heatEvents: { orderBy: { detectedAt: "desc" } },
      calvingsAsDam: { orderBy: { date: "asc" }, include: { calves: { include: { cow: { select: { tag: true, status: true } } } } } },
      calfRecord: { include: { calving: { select: { date: true, dam: { select: { tag: true } } } } } },
      movements: true,
      customFieldValues: true,
    },
    orderBy: { tag: "asc" },
  });

  const milk = await p.$queryRaw`SELECT "cowId", COUNT(*)::int AS rows, COUNT(DISTINCT date)::int AS days, MIN(date) AS first, MAX(date) AS last, COALESCE(SUM(litres),0)::float AS litres FROM "MilkingRecord" WHERE "cowId" IS NOT NULL GROUP BY "cowId"`;
  const milk30 = await p.$queryRaw`SELECT "cowId", COUNT(DISTINCT date)::int AS days FROM "MilkingRecord" WHERE "cowId" IS NOT NULL AND date >= ${new Date(today.getTime() - 30 * DAY)} GROUP BY "cowId"`;
  const milkMap = new Map(milk.map((r) => [r.cowId, r]));
  const milk30Map = new Map(milk30.map((r) => [r.cowId, r.days]));

  const cash = await p.cashTransaction.findMany({ select: { date: true, category: true, amountIn: true, amountOut: true, remark: true } });

  const out = { generated: today.toISOString(), animals: [], farm: {} };

  for (const c of cows) {
    const m = milkMap.get(c.id);
    out.animals.push({
      id: c.id, tag: c.tag, breed: c.breed, gender: c.gender, status: c.status, condition: c.condition,
      dob: iso(c.dateOfBirth), purchaseDate: iso(c.purchaseDate), purchasePrice: c.purchasePrice, source: c.source,
      lastCalving: iso(c.lastCalvingDate), nextAi: iso(c.nextAiDate), dryDate: iso(c.dryDate), expectedCalving: iso(c.expectedCalving), targetSell: iso(c.targetSellDate),
      lactation: c.lactationNumber, notes: c.notes, hasPhoto: !!c.photoUrl,
      milk: m ? { rows: m.rows, days: m.days, first: iso(m.first), last: iso(m.last), litres: Math.round(m.litres), days30: milk30Map.get(c.id) ?? 0 } : { rows: 0, days: 0, first: null, last: null, litres: 0, days30: 0 },
      vaccinations: c.vaccinations.map((v) => ({ name: v.vaccineName, date: iso(v.date), next: iso(v.nextDueDate) })),
      treatments: c.treatments.map((t) => ({ medicine: t.medicineName, date: iso(t.date), reason: t.reason, cost: t.cost })),
      weights: c.weightRecords.map((w) => ({ date: iso(w.date), kg: w.weightKg })),
      inseminations: c.inseminations.map((i) => ({ date: iso(i.date), method: i.method, bull: i.bullTag, cost: i.cost })),
      pregChecks: c.pregnancyChecks.map((x) => ({ date: iso(x.date), result: x.result })),
      heats: c.heatEvents.length,
      calvings: c.calvingsAsDam.map((k) => ({ date: iso(k.date), calves: k.calves.map((x) => ({ sex: x.sex, outcome: x.outcome, tag: x.cow?.tag ?? x.tag, status: x.cow?.status ?? null })) })),
      calfOf: c.calfRecord ? { dam: c.calfRecord.calving.dam.tag, born: iso(c.calfRecord.calving.date) } : null,
      movements: c.movements.length, customFields: c.customFieldValues.length,
    });
  }

  const count = async (m) => p[m].count();
  const lastDate = async (m, f = "date") => { const r = await p[m].aggregate({ _max: { [f]: true } }); return iso(r._max[f]); };
  out.farm.counts = {};
  for (const m of ["cow", "milkingRecord", "milkSale", "milkUsageRecord", "customer", "customerPayment", "employee", "salaryPayment", "attendanceRecord", "feedTransaction", "feedItem", "vendor", "cashTransaction", "capitalEntry", "asset", "vaccineDef", "medicineDef", "treatmentRecord", "vaccinationRecord", "weightRecord", "insemination", "pregnancyCheck", "calving", "calf", "heatEvent", "healthSchedule", "productionTarget", "weightStandard", "user", "auditLog"]) out.farm.counts[m] = await count(m);
  out.farm.last = { milking: await lastDate("milkingRecord"), sale: await lastDate("milkSale"), usage: await lastDate("milkUsageRecord"), feed: await lastDate("feedTransaction"), cash: await lastDate("cashTransaction"), attendance: await lastDate("attendanceRecord"), salary: await lastDate("salaryPayment"), treatment: await lastDate("treatmentRecord"), vaccination: await lastDate("vaccinationRecord"), weight: await lastDate("weightRecord"), insemination: await lastDate("insemination"), calving: await lastDate("calving") };
  out.farm.customers = await p.customer.findMany({ select: { name: true, phone: true, address: true, paymentTerms: true, agreedRate: true, active: true } });
  out.farm.vendors = await p.vendor.findMany({ select: { name: true, phone: true, category: true, active: true } });
  out.farm.employees = await p.employee.findMany({ select: { name: true, position: true, phone: true, monthlySalary: true, joinDate: true, active: true, photoUrl: true } });
  out.farm.feedItems = await p.feedItem.findMany({ select: { name: true, unit: true, reorderLevel: true, active: true } });
  out.farm.medicines = await p.medicineDef.findMany({ select: { name: true, withdrawalDays: true, reorderLevel: true, active: true } });
  out.farm.vaccines = await p.vaccineDef.findMany({ select: { name: true, repeatIntervalDays: true, active: true } });
  out.farm.assets = await p.asset.findMany({ select: { assetClass: true, details: true, value: true, currentValue: true, valuationDate: true, photoUrl: true } });
  out.farm.users = await p.user.findMany({ select: { name: true, username: true, role: true, active: true } });
  out.farm.findings = await p.watchFinding.findMany({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: [{ severity: "asc" }], select: { ruleId: true, category: true, severity: true, title: true, status: true, suggestion: true } });
  out.farm.capital = await p.capitalEntry.groupBy({ by: ["venture", "partner"], _sum: { credit: true, debit: true }, _count: true });
  out.farm.cashByYear = await p.$queryRaw`SELECT EXTRACT(YEAR FROM date)::int AS y, COUNT(*)::int AS n, SUM("amountIn")::float AS i, SUM("amountOut")::float AS o FROM "CashTransaction" GROUP BY 1 ORDER BY 1`;
  out.farm.milkByMonth = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') AS m, COUNT(DISTINCT date)::int AS days, COUNT(*)::int AS rows, SUM(litres)::float AS litres FROM "MilkingRecord" GROUP BY 1 ORDER BY 1`;
  out.farm.salesByMonth = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') AS m, COUNT(DISTINCT date)::int AS days, SUM(litres)::float AS litres, SUM(amount)::float AS amount FROM "MilkSale" GROUP BY 1 ORDER BY 1`;
  out.farm.feedByMonth = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') AS m, COUNT(DISTINCT date)::int AS days, COUNT(*)::int AS rows FROM "FeedTransaction" GROUP BY 1 ORDER BY 1`;
  out.farm.cashUncategorized = cash.filter((r) => /^(uncategorized|)$/i.test((r.category || "").trim())).map((r) => ({ date: iso(r.date), amount: r.amountIn || -r.amountOut, remark: (r.remark || "").replace(/\s+/g, " ").slice(0, 80) }));
  out.farm.salesBuyersNotCustomers = (await p.$queryRaw`SELECT DISTINCT buyer FROM "MilkSale" WHERE buyer NOT IN (SELECT name FROM "Customer")`).map((r) => r.buyer);
  out.farm.dupTags = await p.$queryRaw`SELECT upper(trim(tag)) AS tag, COUNT(*)::int AS n FROM "Cow" GROUP BY 1 HAVING COUNT(*) > 1`;

  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log("animals:", out.animals.length, "-> written", process.argv[2]);
  await p.$disconnect();
})();
