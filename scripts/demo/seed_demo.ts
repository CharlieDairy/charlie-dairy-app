// Fills the DEMO database schema with a made-up farm: invented people, customers, vendors and cattle, a year of
// milk, sales, costs and cash. Nothing here comes from the real farm.
//
// Usage (the DATABASE_URL must point at the demo schema; the script refuses to run anywhere else):
//   npm run demo:seed
//
// Re-running wipes the demo schema and builds it again, dated up to yesterday.
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { MASTER_CATEGORIES } from "../../src/lib/masterData";
import { classifyCash, CLASS_LABEL } from "../../src/lib/accounting/cashClass";

const prisma = new PrismaClient();

export const DEMO_PASSWORD = "Demo@1234";

// ---------- tiny helpers ----------
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261010);
const between = (a: number, b: number) => a + rnd() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T,>(xs: T[]): T => xs[int(0, xs.length - 1)];
const round10 = (n: number) => Math.round(n / 10) * 10;
const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => iso(d).slice(0, 7);
const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

const farmToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const TODAY = new Date(`${farmToday()}T00:00:00Z`);
const LAST = addDays(TODAY, -1); // data runs to yesterday
const START = new Date(Date.UTC(TODAY.getUTCFullYear() - 1, TODAY.getUTCMonth() - 0, 1)); // 1st of this month, a year ago
const BOOKS_START = START;

function* eachDay(from: Date, to: Date) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}
async function insertMany<T>(label: string, rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 1500) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
  console.log(`  ${label}: ${rows.length}`);
}

// ---------- the made-up cast ----------
const ADMIN = { name: "Demo Admin", username: "demo-admin", role: "ADMIN" as const };
const EDITOR = { name: "Demo Editor", username: "demo-editor", role: "EDITOR" as const };
const VIEWER = { name: "Demo Viewer", username: "demo-viewer", role: "VIEWER" as const };
const PARTNER = { name: "Demo Partner", username: "demo-partner", role: "PARTNER" as const };

const PARTNERS = ["Ahmed Raza", "Bilal Siddiqui", "Danish Qureshi", "Farid Malik"];
const EMPLOYEES = [
  { name: "Imran Farooq", position: "Farm Manager", salary: 70000, bank: true },
  { name: "Shahid Mehmood", position: "Milker", salary: 31000, bank: false },
  { name: "Naveed Akhtar", position: "Milker", salary: 31000, bank: false },
  { name: "Rizwan Abbas", position: "Milker", salary: 30000, bank: false },
  { name: "Tariq Hussain", position: "Feeder", salary: 29000, bank: false },
  { name: "Adeel Khan", position: "Labourer", salary: 28000, bank: false },
  { name: "Zubair Ahmad", position: "Driver", salary: 34000, bank: false },
  { name: "Kamran Sheikh", position: "Vet Assistant", salary: 45000, bank: true },
];
const VENDORS = [
  { name: "Rehman Feed Mills", category: "Feed" },
  { name: "Fresh Fodder Traders", category: "Feed" },
  { name: "Green Valley Silage", category: "Feed" },
  { name: "Vet Care Pharmacy", category: "Medicine" },
  { name: "Punjab Electric Supply", category: "Utilities" },
  { name: "Sunrise Engineering Works", category: "Repairs" },
];
// Milk customers. share = part of the litres sold; the bulk buyer pays into the bank.
const CUSTOMERS = [
  { name: "Valley Foods Ltd", share: 0.5, rate0: 150, rate1: 164, mode: "BANK" as const, every: 14, terms: "Bulk tanker, paid by bank every 2 weeks", phone: "042-111-000-101", address: "Industrial Estate, Lahore" },
  { name: "Al-Noor Dairy Shop", share: 0.16, rate0: 176, rate1: 190, mode: "CASH" as const, every: 7, terms: "Weekly, cash", phone: "0300-1112233", address: "Main Market, Sheikhupura" },
  { name: "City Fresh Milk Co.", share: 0.13, rate0: 168, rate1: 183, mode: "CASH" as const, every: 10, terms: "Every 10 days, cash", phone: "0321-4445566", address: "Canal Road, Lahore" },
  { name: "Greenfield Cafe", share: 0.05, rate0: 190, rate1: 205, mode: "CASH" as const, every: 30, terms: "Monthly account", phone: "0333-7778899", address: "Gulberg, Lahore" },
  { name: "Hassan Sweets", share: 0.07, rate0: 182, rate1: 196, mode: "CASH" as const, every: 30, terms: "Monthly account", phone: "0345-2223344", address: "Bhatti Gate, Lahore" },
  { name: "Farm Sale", share: 0.09, rate0: 198, rate1: 215, mode: "CASH" as const, every: 7, terms: "Walk-in, paid on the spot", phone: null, address: null },
];
const FEEDS = [
  { name: "Silage", unit: "kg", category: "Roughage", perDay: 560, rate0: 8.5, rate1: 9.5, vendor: "Green Valley Silage", every: 12, reorder: 6000 },
  { name: "Concentrate (Wanda)", unit: "kg", category: "Concentrate", perDay: 205, rate0: 64, rate1: 71, vendor: "Rehman Feed Mills", every: 10, reorder: 2500 },
  { name: "Cottonseed Cake", unit: "kg", category: "Concentrate", perDay: 68, rate0: 82, rate1: 92, vendor: "Rehman Feed Mills", every: 14, reorder: 900 },
  { name: "Wheat Straw (Turi)", unit: "kg", category: "Roughage", perDay: 185, rate0: 13, rate1: 15.5, vendor: "Fresh Fodder Traders", every: 15, reorder: 2000 },
  { name: "Green Fodder (Jawar)", unit: "kg", category: "Roughage", perDay: 330, rate0: 3.6, rate1: 4.3, vendor: "Fresh Fodder Traders", every: 6, reorder: 1500 },
  { name: "Mineral Mix", unit: "kg", category: "Supplement", perDay: 6, rate0: 210, rate1: 235, vendor: "Rehman Feed Mills", every: 30, reorder: 60 },
];

async function main() {
  // ---------- safety: only ever touch the demo schema ----------
  const [{ s }] = await prisma.$queryRaw<{ s: string }[]>`SELECT current_schema() AS s`;
  if (s !== "demo") {
    console.error(`STOPPED: the connection points at the "${s}" schema. The demo seed only runs against the "demo" schema (add &schema=demo to DATABASE_URL).`);
    process.exit(1);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'demo' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"demo"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  console.log(`Demo schema cleared. Building a farm from ${iso(START)} to ${iso(LAST)}.`);

  // ---------- users ----------
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, { id: string; name: string }> = {};
  for (const u of [ADMIN, EDITOR, VIEWER, PARTNER]) {
    const row = await prisma.user.create({ data: { name: u.name, username: u.username, role: u.role, passwordHash: hash } });
    users[u.username] = { id: row.id, name: row.name };
  }
  const ed = users[EDITOR.username];

  // ---------- catalogues ----------
  for (const c of MASTER_CATEGORIES.filter((m) => m.locked)) {
    for (let i = 0; i < (c.seedCodes ?? []).length; i++) {
      const sc = c.seedCodes![i];
      await prisma.masterDataItem.create({ data: { category: c.key, code: sc.code, label: sc.label, locked: true, sortOrder: i } });
    }
  }
  await prisma.scoringFactor.createMany({
    data: [
      { key: "VACCINATION_COMPLIANCE", label: "Vaccination compliance", weightPct: 40 },
      { key: "TREATMENT_FREQUENCY", label: "Treatment frequency", weightPct: 30 },
      { key: "HEALTH_RECENCY", label: "Health recency", weightPct: 30 },
    ],
  });
  await prisma.weightStandard.createMany({
    data: [
      { ageMonths: 3, minWeightKg: 80, maxWeightKg: 110 },
      { ageMonths: 6, minWeightKg: 130, maxWeightKg: 175 },
      { ageMonths: 12, minWeightKg: 220, maxWeightKg: 290 },
      { ageMonths: 18, minWeightKg: 310, maxWeightKg: 390 },
      { ageMonths: 24, minWeightKg: 380, maxWeightKg: 470 },
    ],
  });
  const vaccines = await Promise.all(
    [["FMD (Foot and Mouth)", 180], ["HS (Haemorrhagic Septicaemia)", 365], ["BQ (Black Quarter)", 365], ["LSD (Lumpy Skin Disease)", 365]].map(([name, d]) =>
      prisma.vaccineDef.create({ data: { name: name as string, repeatIntervalDays: d as number } })
    )
  );
  const medicines = await Promise.all(
    [
      ["Oxytetracycline", "ml", 7, 200], ["Ivermectin", "ml", 14, 150], ["Meloxicam", "ml", 5, 100],
      ["Calcium Borogluconate", "ml", 0, 500], ["Cefquinome Mastitis Tube", "tube", 4, 40], ["Multivitamin Injection", "ml", 0, 200],
    ].map(([name, unit, w, r]) => prisma.medicineDef.create({ data: { name: name as string, unit: unit as string, withdrawalDays: w as number, reorderLevel: r as number } }))
  );
  await prisma.healthSchedule.createMany({
    data: [
      { name: "FMD (Foot and Mouth)", type: "VACCINATION", intervalDays: 180 },
      { name: "Ivermectin", type: "DEWORMING", intervalDays: 90 },
      { name: "Monthly herd check-up", type: "CHECKUP", intervalDays: 30 },
    ],
  });
  await prisma.feedItem.createMany({ data: FEEDS.map((f) => ({ name: f.name, unit: f.unit, category: f.category, reorderLevel: f.reorder })) });
  await prisma.customer.createMany({
    data: CUSTOMERS.map((c) => ({ name: c.name, phone: c.phone, address: c.address, paymentTerms: c.terms, agreedRate: c.rate1 })),
  });
  await prisma.vendor.createMany({ data: VENDORS.map((v) => ({ name: v.name, category: v.category })) });
  const emp = await Promise.all(
    EMPLOYEES.map((e, i) =>
      prisma.employee.create({ data: { name: e.name, position: e.position, monthlySalary: e.salary, joinDate: addDays(START, -400 - i * 37), phone: `03${int(0, 4)}${int(10, 99)}-${int(1000000, 9999999)}` } })
    )
  );

  // ---------- herd, breeding, milk ----------
  type Cow = {
    id: string; tag: string; breed: string; gender: "FEMALE" | "MALE"; status: "MILKING" | "DRY" | "HEIFER" | "CALF" | "INSEMINATED" | "SOLD" | "DEAD";
    dob: Date; peak: number; calvings: Date[]; milker: boolean; purchasePrice?: number; lastCalving?: Date; expectedCalving?: Date; dryDate?: Date; lactation: number;
  };
  const BREEDS = ["Holstein Friesian", "Sahiwal", "Jersey Cross", "Holstein Cross"];
  const cows: Cow[] = [];
  const cowRows: Prisma.CowCreateManyInput[] = [];
  const calvingRows: Prisma.CalvingCreateManyInput[] = [];
  const calfRows: Prisma.CalfCreateManyInput[] = [];
  const heatRows: Prisma.HeatEventCreateManyInput[] = [];
  const insemRows: Prisma.InseminationCreateManyInput[] = [];
  const pregRows: Prisma.PregnancyCheckCreateManyInput[] = [];
  const cashEvents: CashEvent[] = [];
  const BULLS = ["HF-2291 Sunrise", "HF-3340 Atlas", "SH-1127 Raja", "JC-884 Duke"];

  type CashEvent = {
    date: Date; mode: "CASH" | "BANK"; inn?: number; out?: number; category: string; party?: string | null; remark?: string; cls?: string;
    link?: { type: "customer"; buyer: string } | { type: "salary"; employeeId: string; forMonth: string };
    id?: string; time?: string; by?: string;
  };

  const milkers = 24;
  for (let i = 0; i < milkers; i++) {
    const o = int(-190, 175); // days from START of one calving in the cycle
    const calvings: Date[] = [];
    for (let k = -2; k <= 2; k++) { const c = addDays(START, o + 365 * k); if (c >= addDays(START, -400) && c <= LAST) calvings.push(c); }
    const latest = calvings[calvings.length - 1];
    const dim = dayDiff(LAST, latest);
    const status: Cow["status"] = dim <= 305 ? "MILKING" : "DRY";
    cows.push({
      id: randomUUID(), tag: `C-${101 + i}`, breed: BREEDS[i % 4], gender: "FEMALE", status, dob: addDays(START, -int(1100, 2400)),
      peak: round1(between(18, 31)), calvings, milker: true, lastCalving: latest, lactation: int(1, 5), purchasePrice: i % 3 === 0 ? int(18, 26) * 10000 : undefined,
      dryDate: status === "DRY" ? addDays(latest, 305) : undefined,
    });
  }
  // young stock: heifers (some in calf)
  for (let i = 0; i < 8; i++) {
    const inCalf = i < 5;
    cows.push({
      id: randomUUID(), tag: `H-${201 + i}`, breed: BREEDS[i % 4], gender: "FEMALE", status: inCalf ? "INSEMINATED" : "HEIFER",
      dob: addDays(LAST, -int(430, 760)), peak: 0, calvings: [], milker: false, lactation: 0,
    });
  }

  const milkingRows: Prisma.MilkingRecordCreateManyInput[] = [];
  const dailyProduction = new Map<string, number>();
  const season = (d: Date) => [1.03, 1.04, 1.02, 0.99, 0.96, 0.92, 0.91, 0.93, 0.97, 1.0, 1.03, 1.04][d.getUTCMonth()];
  const lactF = (dim: number) => (dim < 60 ? 0.6 + 0.4 * Math.pow(dim / 60, 0.7) : 1 - 0.0022 * (dim - 60));
  const skipDays = new Set([iso(addDays(LAST, -9)), iso(addDays(LAST, -23))]); // two days nobody entered milk (a gap for Farm Watch to find)

  for (const cow of cows.filter((c) => c.milker)) {
    for (const d of eachDay(START, LAST)) {
      if (skipDays.has(iso(d))) continue;
      const prior = cow.calvings.filter((c) => c <= d).pop();
      if (!prior) continue;
      const dim = dayDiff(d, prior);
      if (dim > 305 || dim < 3) continue;
      const day = cow.peak * lactF(dim) * season(d) * between(0.93, 1.07);
      const fat = round1(between(3.7, 4.6)), snf = round1(between(8.2, 8.9));
      const m = round1(day * 0.56), e = round1(day * 0.44);
      milkingRows.push({ cowId: cow.id, date: d, shift: "MORNING", litres: m, fatPct: fat, snfPct: snf, enteredBy: ed.name });
      milkingRows.push({ cowId: cow.id, date: d, shift: "EVENING", litres: e, fatPct: round1(fat - 0.1), snfPct: snf, enteredBy: ed.name });
      dailyProduction.set(iso(d), (dailyProduction.get(iso(d)) ?? 0) + m + e);
    }
  }

  // calvings, calves, and the breeding that led to each one
  let calfNo = 301;
  const soldAnimals: { cowId: string; tag: string; date: Date; price: number; kind: "Calves" | "Cows"; text: string }[] = [];
  for (const cow of cows.filter((c) => c.milker)) {
    for (const c of cow.calvings) {
      const insDate = addDays(c, -283);
      const heatId = randomUUID(), insId = randomUUID();
      if (insDate >= addDays(START, -30)) {
        heatRows.push({ id: heatId, cowId: cow.id, detectedAt: addDays(insDate, -1), detectionMethod: pick(["VISUAL", "ACTIVITY_MONITOR", "TAIL_PAINT"] as const), intensity: pick(["Strong", "Medium"]), enteredBy: ed.name });
        insemRows.push({ id: insId, cowId: cow.id, heatEventId: heatId, date: insDate, method: "AI", semenBatch: `B${int(1000, 9999)}`, bullTag: pick(BULLS), technician: "Kamran Sheikh", serviceNumber: 1, cost: pick([4500, 6500, 9500]), enteredBy: ed.name });
        if (addDays(insDate, 45) <= LAST) pregRows.push({ cowId: cow.id, inseminationId: insId, date: addDays(insDate, 45), method: "ULTRASOUND", result: "PREGNANT", performedBy: "Dr. Samina Iqbal" });
      }
      if (c >= START && c <= LAST) {
        const calvingId = randomUUID();
        const female = rnd() < 0.52;
        const alive = rnd() > 0.05;
        calvingRows.push({ id: calvingId, damId: cow.id, inseminationId: insDate >= addDays(START, -30) ? insId : null, sireTag: pick(BULLS), date: c, gestationDays: 283 + int(-6, 7), difficulty: rnd() < 0.85 ? "UNASSISTED" : "EASY_PULL", calfCount: 1, enteredBy: ed.name });
        if (!alive) { calfRows.push({ calvingId, sex: female ? "FEMALE" : "MALE", outcome: "STILLBORN", birthWeight: round1(between(28, 36)) }); continue; }
        const tag = `K-${calfNo++}`;
        const ageDays = dayDiff(LAST, c);
        const calfCowId = randomUUID();
        const sold = !female && ageDays > 75;
        const status: Cow["status"] = sold ? "SOLD" : ageDays > 240 ? "HEIFER" : "CALF";
        cows.push({ id: calfCowId, tag, breed: cow.breed, gender: female ? "FEMALE" : "MALE", status, dob: c, peak: 0, calvings: [], milker: false, lactation: 0 });
        calfRows.push({ calvingId, cowId: calfCowId, sex: female ? "FEMALE" : "MALE", outcome: "ALIVE", birthWeight: round1(between(28, 38)), tag });
        if (sold) soldAnimals.push({ cowId: calfCowId, tag, date: addDays(c, int(70, Math.min(110, ageDays))), price: round10(between(55000, 95000)), kind: "Calves", text: `Male calf ${tag} sale` });
      }
    }
    // next pregnancy, if the next calving is still to come
    const latest = cow.calvings[cow.calvings.length - 1];
    const nextCalving = addDays(latest, 365);
    const nextIns = addDays(nextCalving, -283);
    if (nextCalving > LAST && nextIns <= LAST) {
      const heatId = randomUUID(), insId = randomUUID();
      heatRows.push({ id: heatId, cowId: cow.id, detectedAt: addDays(nextIns, -1), detectionMethod: "VISUAL", intensity: "Strong", enteredBy: ed.name });
      insemRows.push({ id: insId, cowId: cow.id, heatEventId: heatId, date: nextIns, method: "AI", semenBatch: `B${int(1000, 9999)}`, bullTag: pick(BULLS), technician: "Kamran Sheikh", serviceNumber: 1, cost: 6500, enteredBy: ed.name });
      if (addDays(nextIns, 45) <= LAST) { pregRows.push({ cowId: cow.id, inseminationId: insId, date: addDays(nextIns, 45), method: "ULTRASOUND", result: "PREGNANT", performedBy: "Dr. Samina Iqbal" }); cow.expectedCalving = nextCalving; }
    }
  }
  // heifers: AI + pregnancy check for the ones marked in calf
  for (const h of cows.filter((c) => c.tag.startsWith("H-"))) {
    if (h.status !== "INSEMINATED") continue;
    const d = addDays(LAST, -int(55, 150));
    const heatId = randomUUID(), insId = randomUUID();
    heatRows.push({ id: heatId, cowId: h.id, detectedAt: addDays(d, -1), detectionMethod: "VISUAL", enteredBy: ed.name });
    insemRows.push({ id: insId, cowId: h.id, heatEventId: heatId, date: d, method: "AI", semenBatch: `B${int(1000, 9999)}`, bullTag: pick(BULLS), technician: "Kamran Sheikh", serviceNumber: 1, cost: 6500, enteredBy: ed.name });
    pregRows.push({ cowId: h.id, inseminationId: insId, date: addDays(d, 45), method: "ULTRASOUND", result: "PREGNANT", performedBy: "Dr. Samina Iqbal" });
    h.expectedCalving = addDays(d, 283);
  }
  // two older cows sold earlier in the year (culled)
  for (let i = 0; i < 2; i++) {
    const id = randomUUID();
    const tag = `C-${90 + i}`;
    cows.push({ id, tag, breed: BREEDS[i], gender: "FEMALE", status: "SOLD", dob: addDays(START, -2800), peak: 0, calvings: [], milker: false, lactation: 5 });
    soldAnimals.push({ cowId: id, tag, date: addDays(START, 80 + i * 120), price: round10(between(260000, 330000)), kind: "Cows", text: `Cow ${tag} sold (culled, low yield)` });
  }
  // a heifer sold
  { const h = cows.find((c) => c.tag === "H-208")!; h.status = "SOLD"; soldAnimals.push({ cowId: h.id, tag: h.tag, date: addDays(LAST, -40), price: 340000, kind: "Cows", text: `Heifer ${h.tag} sale` }); }

  for (const c of cows) {
    cowRows.push({
      id: c.id, tag: c.tag, breed: c.breed, gender: c.gender, status: c.status, dateOfBirth: c.dob, lactationNumber: c.lactation,
      lastCalvingDate: c.lastCalving ?? null, expectedCalving: c.expectedCalving ?? null, dryDate: c.dryDate ?? null,
      purchasePrice: c.purchasePrice ?? null, source: c.purchasePrice ? "Bought at livestock market" : "Born on farm", condition: c.status === "DRY" ? "Good" : null,
    });
  }

  // ---------- health ----------
  const vacRows: Prisma.VaccinationRecordCreateManyInput[] = [];
  const treatRows: Prisma.TreatmentRecordCreateManyInput[] = [];
  const stockRows: Prisma.MedicineStockTransactionCreateManyInput[] = [];
  const adults = cows.filter((c) => c.status !== "SOLD" && c.status !== "CALF");
  for (const c of adults) {
    const fmd = vaccines[0];
    const overdue = rnd() < 0.12; // a few animals are overdue
    const when = overdue ? addDays(LAST, -int(190, 230)) : addDays(LAST, -int(20, 170));
    vacRows.push({ cowId: c.id, vaccineDefId: fmd.id, vaccineName: fmd.name, date: when, nextDueDate: addDays(when, 180), cost: 70, administeredBy: "Kamran Sheikh", enteredBy: ed.name });
    if (rnd() < 0.85) {
      const v = vaccines[int(1, 3)];
      const w = addDays(LAST, -int(30, 300));
      vacRows.push({ cowId: c.id, vaccineDefId: v.id, vaccineName: v.name, date: w, nextDueDate: addDays(w, 365), cost: 60, administeredBy: "Kamran Sheikh", enteredBy: ed.name });
    }
  }
  const reasons: [string, number[]][] = [["Mastitis (udder infection)", [4]], ["Fever", [0, 2]], ["Lameness", [2]], ["Milk fever", [3]], ["Indigestion", [5]], ["Worm control", [1]]];
  for (let i = 0; i < 34; i++) {
    const c = pick(adults);
    const [reason, meds] = pick(reasons);
    const m = medicines[pick(meds)];
    const date = i < 3 ? addDays(LAST, -int(1, 4)) : addDays(START, int(5, 370));
    const qty = m.unit === "tube" ? int(2, 4) : int(10, 40);
    treatRows.push({
      cowId: c.id, medicineDefId: m.id, medicineName: m.name, date, dosage: m.unit === "tube" ? `${qty} tubes, one per day` : `${qty} ml`, quantityUsed: qty,
      withdrawalUntil: m.withdrawalDays ? addDays(date, m.withdrawalDays) : null, reason, cost: round10(qty * (m.unit === "tube" ? 420 : 38)), administeredBy: "Kamran Sheikh", enteredBy: ed.name,
    });
    stockRows.push({ medicineDefId: m.id, date, direction: "OUT", quantity: qty, notes: `Treatment: ${reason}`, enteredBy: ed.name });
  }
  for (const m of medicines) {
    for (const when of [START, addDays(START, 120), addDays(START, 240)]) {
      const qty = m.unit === "tube" ? 60 : 450;
      stockRows.push({ medicineDefId: m.id, date: when, direction: "IN", quantity: qty, cost: round10(qty * (m.unit === "tube" ? 380 : 30)), notes: "Restock from Vet Care Pharmacy", enteredBy: ed.name });
    }
  }
  // weights for young stock every two months
  const weightRows: Prisma.WeightRecordCreateManyInput[] = [];
  for (const c of cows.filter((x) => ["HEIFER", "CALF", "INSEMINATED"].includes(x.status))) {
    for (let k = 0; k < 6; k++) {
      const d = addDays(LAST, -k * 58);
      const ageM = Math.max(0.5, dayDiff(d, c.dob) / 30);
      if (ageM < 0.4) continue;
      weightRows.push({ cowId: c.id, date: d, weightKg: round1(38 + ageM * 17.5 + between(-8, 8)), enteredBy: ed.name });
    }
  }

  // ---------- milk usage and sales ----------
  const usageRows: Prisma.MilkUsageRecordCreateManyInput[] = [];
  const saleRows: Prisma.MilkSaleCreateManyInput[] = [];
  const billed: Record<string, { date: Date; amount: number }[]> = {};
  for (const [dayKey, litres] of dailyProduction) {
    const d = new Date(`${dayKey}T00:00:00Z`);
    usageRows.push({ date: d, type: "CALF_USE", litres: round1(litres * 0.05), enteredBy: ed.name });
    usageRows.push({ date: d, type: "FARM_USE", litres: round1(litres * 0.02), enteredBy: ed.name });
    usageRows.push({ date: d, type: "EMPLOYEE_USE", litres: round1(litres * 0.015), enteredBy: ed.name });
    const sellable = litres * 0.91 * between(0.985, 1.015);
    const t = dayDiff(d, START) / 375;
    for (const c of CUSTOMERS) {
      const l = round1(sellable * c.share * between(0.94, 1.06));
      const rate = round1(c.rate0 + (c.rate1 - c.rate0) * t);
      const amount = Math.round(l * rate);
      saleRows.push({ date: d, buyer: c.name, litres: l, rate, fatPct: round1(between(3.8, 4.4)), snf: round1(between(8.3, 8.8)), amount, enteredBy: ed.name });
      (billed[c.name] ??= []).push({ date: d, amount });
    }
  }

  // customer payments -> cash entries linked to the customer
  for (const c of CUSTOMERS) {
    const list = billed[c.name];
    let lastPaid = addDays(START, -1);
    for (let d = addDays(START, c.every); d <= LAST; d = addDays(d, c.every + (c.every > 10 ? int(-1, 2) : 0))) {
      // pay for what was billed up to a week before the payment day
      const cutoff = addDays(d, c.every >= 14 ? -7 : -2);
      const due = list.filter((r) => r.date > lastPaid && r.date <= cutoff);
      if (!due.length) continue;
      let amount = due.reduce((n, r) => n + r.amount, 0);
      if (c.name === "Hassan Sweets" && rnd() < 0.25) amount *= 0.8; // pays part now, the rest later
      lastPaid = cutoff;
      cashEvents.push({ date: d, mode: c.mode, inn: round10(amount), category: "Milk Sale Payment", party: c.name, remark: `Milk sale payment from ${c.name}`, link: { type: "customer", buyer: c.name } });
    }
  }

  // ---------- feed ----------
  const feedRows: Prisma.FeedTransactionCreateManyInput[] = [];
  for (const f of FEEDS) {
    const rateAt = (d: Date) => round1(f.rate0 + (f.rate1 - f.rate0) * (dayDiff(d, START) / 375));
    let stock = f.perDay * 14; // opening stock: two weeks
    feedRows.push({ date: START, feedType: f.name, direction: "IN", quantity: stock, rate: rateAt(START), cost: Math.round(stock * rateAt(START)), notes: "Opening stock", enteredBy: ed.name });
    for (const d of eachDay(START, LAST)) {
      const use = round1(f.perDay * between(0.94, 1.06) * (f.name.startsWith("Green") ? season(d) : 1));
      feedRows.push({ date: d, feedType: f.name, direction: "OUT", quantity: use, enteredBy: ed.name });
      stock -= use;
      if (stock < f.perDay * 6) {
        const qty = Math.round(f.perDay * f.every * 1.05);
        const rate = rateAt(d);
        const cost = Math.round(qty * rate);
        feedRows.push({ date: d, feedType: f.name, direction: "IN", quantity: qty, rate, cost, notes: `Bought from ${f.vendor}`, enteredBy: ed.name });
        stock += qty;
        cashEvents.push({ date: d, mode: cost >= 150000 ? "BANK" : "CASH", out: round10(cost), category: "Opex Feed", party: f.vendor, remark: `${f.name} ${qty.toLocaleString()} kg @ ${rate}` });
      }
    }
  }

  // ---------- salaries and attendance ----------
  const salaryRows: Prisma.SalaryPaymentCreateManyInput[] = [];
  const salaryLinks: { emp: number; forMonth: string; amount: number; date: Date; mode: "CASH" | "BANK"; id: string }[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(Date.UTC(START.getUTCFullYear(), START.getUTCMonth() + m, 1));
    const payDate = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 2));
    if (payDate > LAST) continue;
    EMPLOYEES.forEach((e, i) => {
      const id = randomUUID();
      const amount = e.salary + (m > 6 && i < 3 ? 2000 : 0);
      salaryLinks.push({ emp: i, forMonth: monthKey(monthStart), amount, date: payDate, mode: e.bank ? "BANK" : "CASH", id });
      cashEvents.push({ date: payDate, mode: e.bank ? "BANK" : "CASH", out: amount, category: "Opex Salaries", party: e.name, remark: `Salary for ${e.name} — ${monthKey(monthStart)}`, link: { type: "salary", employeeId: emp[i].id, forMonth: monthKey(monthStart) }, id });
    });
  }
  const attendance: Prisma.AttendanceRecordCreateManyInput[] = [];
  for (let i = 0; i < emp.length; i++) {
    for (const d of eachDay(addDays(LAST, -44), LAST)) {
      const r = rnd();
      attendance.push({ employeeId: emp[i].id, date: d, status: r < 0.9 ? "PRESENT" : r < 0.94 ? "HALF_DAY" : r < 0.97 ? "LEAVE" : "ABSENT", enteredBy: ed.name });
    }
  }

  // ---------- running costs and other cash ----------
  for (const d of eachDay(START, LAST)) {
    const dom = d.getUTCDate();
    if (d.getUTCDay() % 3 === 0 && rnd() < 0.8) cashEvents.push({ date: d, mode: "CASH", out: round10(between(2800, 6200)), category: "Opex Fuel", remark: pick(["Diesel for generator and tractor", "Petrol for pickup", "Diesel, fodder chopper"]) });
    if (rnd() < 0.18) cashEvents.push({ date: d, mode: "CASH", out: round10(between(1500, 9000)), category: "Opex", remark: pick(["Shed repair and welding", "Water pump service", "Tools and spare parts", "Cleaning supplies", "Rope and buckets", "Lights and wiring"]) });
    if (rnd() < 0.05) cashEvents.push({ date: d, mode: "CASH", out: round10(between(3000, 8000)), category: "Opex", party: null, remark: "Casual labour for shed cleaning" });
    if (dom === 12) cashEvents.push({ date: d, mode: "BANK", out: round10(between(68000, 112000)), category: "Opex", party: "Punjab Electric Supply", remark: "Electricity bill" });
    if (dom === 20 && rnd() < 0.5) cashEvents.push({ date: d, mode: "CASH", out: round10(between(9000, 22000)), category: "Opex Medical", party: "Vet Care Pharmacy", remark: "Medicines and vet visit" });
    if (dom === 5 && rnd() < 0.5) cashEvents.push({ date: d, mode: "CASH", out: round10(between(6000, 12000)), category: "A.I", remark: "Semen and AI technician fee" });
  }
  for (const t of treatRows) if (t.cost && (t.date as Date) <= LAST) cashEvents.push({ date: t.date as Date, mode: "CASH", out: t.cost as number, category: "Opex Medical", remark: `${t.medicineName}: ${t.reason}` });
  for (const s of soldAnimals) cashEvents.push({ date: s.date, mode: s.price >= 200000 ? "BANK" : "CASH", inn: s.price, category: `Cash sale proceed for ${s.kind}`, remark: s.text });
  // other income and one entry the manager forgot to categorise
  cashEvents.push({ date: addDays(START, 150), mode: "CASH", inn: 38000, category: "Cash Recived Other", remark: "Sale of manure (6 trolleys)" });
  cashEvents.push({ date: addDays(START, 260), mode: "CASH", inn: 27500, category: "Cash Recived Other", remark: "Sale of empty feed bags" });
  cashEvents.push({ date: addDays(LAST, -5), mode: "CASH", inn: 8000, category: "Uncategorized", remark: "Received from visitor, not sure what for" });
  // capital spending, matched by assets below
  const capex = [
    { date: addDays(START, 170), amount: 680000, remark: "New 6-unit milking machine", asset: "Milking equipment" },
    { date: addDays(START, 300), amount: 540000, remark: "Shed extension (roof and flooring)", asset: "Buildings" },
  ];
  for (const c of capex) cashEvents.push({ date: c.date, mode: "BANK", out: c.amount, category: "CAPEX", remark: c.remark });

  // ---------- run the cash books day by day ----------
  const OPEN_PETTY = 250000, OPEN_BANK = 4_550_000;
  let petty = OPEN_PETTY, bank = OPEN_BANK;
  const byDay = new Map<string, CashEvent[]>();
  for (const e of cashEvents) { const k = iso(e.date); (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e); }
  const finalCash: (CashEvent & { time: string; id: string })[] = [];
  const capitalRows: Prisma.CapitalEntryCreateManyInput[] = [];
  const clock = (n: number) => { const m = 8 * 60 + Math.floor((n % 100) * 6.1); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`; };
  finalCash.push({ date: BOOKS_START, mode: "CASH", inn: OPEN_PETTY, category: "Opening Balance", remark: "Petty cash carried forward", time: "08:00:00", id: randomUUID(), by: "Opening balance" });
  finalCash.push({ date: BOOKS_START, mode: "BANK", inn: OPEN_BANK, category: "Opening Balance", remark: "Bank account balance carried forward", time: "08:00:00", id: randomUUID(), by: "Opening balance" });
  let partnerTurn = 0;
  for (const d of eachDay(START, LAST)) {
    const todays = byDay.get(iso(d)) ?? [];
    const push = (e: CashEvent) => finalCash.push({ ...e, time: e.time ?? clock(finalCash.length * 37 + int(0, 99)), id: e.id ?? randomUUID() });
    for (const e of todays) {
      const amt = (e.inn ?? 0) - (e.out ?? 0);
      if (e.mode === "BANK" && bank + amt < 150000) {
        // the partners top the account up
        const top = round10(Math.max(500000, -(bank + amt) + 600000));
        const who = PARTNERS[partnerTurn++ % PARTNERS.length];
        push({ date: d, mode: "BANK", inn: top, category: "Cash from Company", party: who, remark: `Partner contribution - ${who}`, time: "08:00:00" });
        capitalRows.push({ date: d, partner: who, description: "Additional capital to the farm account", credit: top, debit: 0, type: "CONTRIBUTION", venture: "Dairy" });
        bank += top;
      }
      if (e.mode === "CASH" && petty + amt < 40000) {
        const mv = 400000;
        if (bank - mv < 200000) {
          const who = PARTNERS[partnerTurn++ % PARTNERS.length];
          push({ date: d, mode: "BANK", inn: 800000, category: "Cash from Company", party: who, remark: `Partner contribution - ${who}`, time: "08:00:00" });
          capitalRows.push({ date: d, partner: who, description: "Additional capital to the farm account", credit: 800000, debit: 0, type: "CONTRIBUTION", venture: "Dairy" });
          bank += 800000;
        }
        push({ date: d, mode: "BANK", out: mv, category: "Ops", remark: "Petty cash withdrawal to manager", cls: "TRANSFER", time: "08:05:00" });
        push({ date: d, mode: "CASH", inn: mv, category: "Cash from Company", remark: "Cash from bank for petty cash", cls: "TRANSFER", time: "08:06:00" });
        bank -= mv; petty += mv;
      }
      push(e);
      if (e.mode === "BANK") bank += amt; else petty += amt;
    }
    if (petty > 900000) { // too much cash in the drawer: bank some
      const dep = 500000;
      push({ date: d, mode: "CASH", out: dep, category: "Bank", remark: "Cash deposited in the bank", cls: "TRANSFER", time: "18:30:00" });
      push({ date: d, mode: "BANK", inn: dep, category: "Bank", remark: "Cash deposit from petty cash", cls: "TRANSFER", time: "18:31:00" });
      petty -= dep; bank += dep;
    }
  }
  // one profit distribution to the partners, mid-year
  {
    const d = addDays(START, 240);
    const each = 150000;
    for (const who of PARTNERS) {
      finalCash.push({ date: d, mode: "BANK", out: each, category: "Cash from Company", party: who, remark: `Profit share paid to ${who}`, time: "16:30:00", id: randomUUID() });
      capitalRows.push({ date: d, partner: who, description: "Profit share withdrawn", credit: 0, debit: each, type: "WITHDRAWAL", venture: "Dairy" });
      bank -= each;
    }
  }

  // ---------- capital before the books start, and assets ----------
  const ASSETS = [
    { assetClass: "Buildings", details: "Cattle sheds, milking parlour and store", qty: 1, value: 4_800_000, dep: 5, years: 3 },
    { assetClass: "Milking equipment", details: "Milking machine, 4-unit (old)", qty: 1, value: 520_000, dep: 15, years: 3 },
    { assetClass: "Cooling", details: "Bulk milk chiller, 1000 litre", qty: 1, value: 780_000, dep: 15, years: 2 },
    { assetClass: "Vehicles", details: "Pickup truck for milk delivery", qty: 1, value: 1_850_000, dep: 20, years: 3 },
    { assetClass: "Machinery", details: "Tractor and fodder trolley", qty: 1, value: 950_000, dep: 15, years: 3 },
    { assetClass: "Machinery", details: "Fodder chopper and mixer", qty: 1, value: 180_000, dep: 15, years: 2 },
    { assetClass: "Power", details: "Generator 40 kVA and solar inverter", qty: 1, value: 120_000, dep: 15, years: 2 },
  ];
  const assetCost = ASSETS.reduce((n, a) => n + a.value, 0);
  const assetRows: Prisma.AssetCreateManyInput[] = ASSETS.map((a) => ({
    assetClass: a.assetClass, details: a.details, qty: a.qty, value: a.value, depreciationPct: a.dep, yearLived: a.years,
    currentValue: Math.round(a.value * Math.pow(1 - a.dep / 100, a.years)), valuationDate: BOOKS_START,
  }));
  // the machines bought during the year are on the books at cost
  for (const c of capex) assetRows.push({ assetClass: c.asset, details: c.remark, qty: 1, value: c.amount, depreciationPct: 10, yearLived: 0, currentValue: c.amount, valuationDate: c.date });
  // Capital before the books start equals opening cash plus the cost of the assets already owned, so the Balance Sheet balances.
  const capitalBefore = OPEN_PETTY + OPEN_BANK + assetCost;
  const share = Math.floor(capitalBefore / PARTNERS.length / 1000) * 1000;
  const remainder = capitalBefore - share * PARTNERS.length;
  PARTNERS.forEach((p, i) => capitalRows.push({ date: addDays(START, -420 + i * 20), partner: p, description: "Initial capital contribution", credit: share + (i === 0 ? remainder : 0), debit: 0, type: "CONTRIBUTION", venture: "Dairy" }));

  // ---------- write everything ----------
  console.log("Writing…");
  await insertMany("animals", cowRows, (data) => prisma.cow.createMany({ data }));
  await insertMany("heat events", heatRows, (data) => prisma.heatEvent.createMany({ data }));
  await insertMany("inseminations", insemRows, (data) => prisma.insemination.createMany({ data }));
  await insertMany("pregnancy checks", pregRows, (data) => prisma.pregnancyCheck.createMany({ data }));
  await insertMany("calvings", calvingRows, (data) => prisma.calving.createMany({ data }));
  await insertMany("calves", calfRows, (data) => prisma.calf.createMany({ data }));
  await insertMany("vaccinations", vacRows, (data) => prisma.vaccinationRecord.createMany({ data }));
  await insertMany("treatments", treatRows, (data) => prisma.treatmentRecord.createMany({ data }));
  await insertMany("medicine stock", stockRows, (data) => prisma.medicineStockTransaction.createMany({ data }));
  await insertMany("weights", weightRows, (data) => prisma.weightRecord.createMany({ data }));
  await insertMany("milking records", milkingRows, (data) => prisma.milkingRecord.createMany({ data }), 2500);
  await insertMany("milk usage", usageRows, (data) => prisma.milkUsageRecord.createMany({ data }));
  await insertMany("milk sales", saleRows, (data) => prisma.milkSale.createMany({ data }), 2500);
  await insertMany("feed", feedRows, (data) => prisma.feedTransaction.createMany({ data }), 2500);
  await insertMany("attendance", attendance, (data) => prisma.attendanceRecord.createMany({ data }));
  await insertMany("assets", assetRows, (data) => prisma.asset.createMany({ data }));
  await insertMany("capital entries", capitalRows, (data) => prisma.capitalEntry.createMany({ data }));

  // cash rows: in date order so the entry numbers read chronologically
  finalCash.sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));
  const cashData: Prisma.CashTransactionCreateManyInput[] = finalCash.map((e) => ({
    id: e.id, date: e.date, time: e.time, party: e.party ?? null, category: e.category, mode: e.mode, amountIn: e.inn ?? 0, amountOut: e.out ?? 0,
    enteredBy: e.by ?? ed.name, createdById: e.by ? null : ed.id, remark: e.remark ?? null, accountClass: (e.cls as Prisma.CashTransactionCreateManyInput["accountClass"]) ?? null,
    projectLand: e.by ? null : "A",
  }));
  await insertMany("cash entries", cashData, (data) => prisma.cashTransaction.createMany({ data }));
  const paymentRows: Prisma.CustomerPaymentCreateManyInput[] = finalCash.filter((e) => e.link?.type === "customer").map((e) => ({
    buyer: (e.link as { buyer: string }).buyer, date: e.date, amount: e.inn ?? 0, mode: e.mode, cashTransactionId: e.id, enteredBy: ed.name,
  }));
  await insertMany("customer payments", paymentRows, (data) => prisma.customerPayment.createMany({ data }));
  const salData: Prisma.SalaryPaymentCreateManyInput[] = finalCash.filter((e) => e.link?.type === "salary").map((e) => {
    const l = e.link as { employeeId: string; forMonth: string };
    return { employeeId: l.employeeId, date: e.date, amount: e.out ?? 0, forMonth: l.forMonth, mode: e.mode, cashTransactionId: e.id, enteredBy: ed.name };
  });
  void salaryRows; void salaryLinks;
  await insertMany("salary payments", salData, (data) => prisma.salaryPayment.createMany({ data }));

  // open categories for the pick-lists, from what now exists
  const open: [string, string[]][] = [
    ["FEED_TYPE", FEEDS.map((f) => f.name)],
    ["CASH_CATEGORY", [...new Set(finalCash.map((e) => e.category))]],
    ["ASSET_CLASS", [...new Set(ASSETS.map((a) => a.assetClass).concat(capex.map((c) => c.asset)))]],
    ["CAPITAL_PARTNER", PARTNERS],
  ];
  for (const [category, values] of open) {
    await prisma.masterDataItem.createMany({ data: values.map((code, i) => ({ category, code, label: code, locked: false, sortOrder: i })), skipDuplicates: true });
  }

  // ---------- a quick read-back of the books ----------
  const sum: Record<string, number> = {};
  for (const e of finalCash) { const c = classifyCash({ category: e.category, amountIn: e.inn ?? 0, amountOut: e.out ?? 0, remark: e.remark, accountClass: e.cls }); sum[c] = (sum[c] ?? 0) + (e.inn ?? 0) - (e.out ?? 0); }
  console.log("\nCash by class (net):");
  for (const [k, v] of Object.entries(sum)) console.log(`  ${CLASS_LABEL[k as keyof typeof CLASS_LABEL].padEnd(24)} ${Math.round(v).toLocaleString()}`);
  console.log(`Petty cash now ${Math.round(petty).toLocaleString()}, bank ${Math.round(bank).toLocaleString()}`);
  console.log(`\nDemo logins (password ${DEMO_PASSWORD}): demo-admin, demo-editor, demo-viewer, demo-partner`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
