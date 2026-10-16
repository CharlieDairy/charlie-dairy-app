// Go-live checklist items that need no decision from the owner (16 Oct 2026).
// Dry run by default; add --apply to write. Safe to re-run: every step looks for what is already there.
// Take a backup first: node scripts/backup-daily.js
const { PrismaClient } = require("@prisma/client");
const APPLY = process.argv.includes("--apply");
const TAG = "Checklist clean-up (16 Oct 2026)";
const p = new PrismaClient();
const day = (s) => new Date(s + "T00:00:00.000Z");
const iso = (x) => x.toISOString().slice(0, 10);
const plus = (x, n) => new Date(x.getTime() + n * 86400000);
const say = (step, msg) => console.log(`[${step}] ${msg}`);
const run = async (fn) => { if (APPLY) await fn(); };

(async () => {
  // 1. Vaccine list (checklist 1.1) + link the existing vaccination records, set missing next-due dates
  const VAC = [
    { name: "FMD (Foot and Mouth Disease)", repeatIntervalDays: 180 },
    { name: "HS (Hemorrhagic Septicemia)", repeatIntervalDays: 365 },
    { name: "Clostridial vaccine", repeatIntervalDays: 365 },
    { name: "LSD (Lumpy Skin Disease)", repeatIntervalDays: 365 },
  ];
  const vdef = {};
  for (const v of VAC) {
    let row = await p.vaccineDef.findUnique({ where: { name: v.name } });
    if (!row) { say("1.1", `add vaccine ${v.name} (every ${v.repeatIntervalDays} days)`); await run(async () => { row = await p.vaccineDef.create({ data: v }); }); }
    vdef[v.name] = row;
  }
  const canon = (n) => (/^hs\b/i.test(n.trim()) ? "HS (Hemorrhagic Septicemia)" : /clostridial/i.test(n) ? "Clostridial vaccine" : /fmd|foot/i.test(n) ? "FMD (Foot and Mouth Disease)" : null);
  for (const r of await p.vaccinationRecord.findMany()) {
    const c = canon(r.vaccineName); if (!c) continue;
    const def = vdef[c]; const data = {};
    if (r.vaccineName !== c) data.vaccineName = c;
    if (def && r.vaccineDefId !== def.id) data.vaccineDefId = def.id;
    if (!r.nextDueDate) data.nextDueDate = plus(r.date, VAC.find((x) => x.name === c).repeatIntervalDays);
    if (Object.keys(data).length) { say("1.1", `vaccination ${r.id.slice(-6)} ${iso(r.date)}: ${Object.keys(data).join(", ")}${data.nextDueDate ? " -> " + iso(data.nextDueDate) : ""}`); await run(() => p.vaccinationRecord.update({ where: { id: r.id }, data })); }
  }

  // 2. Medicine list (1.2): only Ivermectin is a real medicine in the records. Withdrawal days are left for the owner on purpose.
  let iver = await p.medicineDef.findUnique({ where: { name: "Ivermectin (deworming)" } });
  if (!iver) { say("1.2", "add medicine Ivermectin (deworming)"); await run(async () => { iver = await p.medicineDef.create({ data: { name: "Ivermectin (deworming)" } }); }); }
  const tr = await p.treatmentRecord.findMany({ where: { medicineName: "Ivermectin (deworming)", medicineDefId: null } });
  if (tr.length) { say("1.2", `link ${tr.length} deworming treatments to the medicine`); await run(() => p.treatmentRecord.updateMany({ where: { id: { in: tr.map((t) => t.id) } }, data: { medicineDefId: iver.id } })); }

  // 3. Health schedules (1.3)
  const SCH = [
    ["FMD vaccination", "VACCINATION", 180], ["HS vaccination", "VACCINATION", 365], ["Clostridial (BQ) vaccination", "VACCINATION", 365],
    ["Deworming (Ivermectin)", "DEWORMING", 90],
  ];
  for (const [name, type, intervalDays] of SCH) {
    if (!(await p.healthSchedule.findFirst({ where: { name } }))) { say("1.3", `add schedule ${name} every ${intervalDays} days`); await run(() => p.healthSchedule.create({ data: { name, type, intervalDays } })); }
  }

  // 4. Feed reorder levels (1.5): about 7 days of the average daily use of the last 60 days
  const since = plus(new Date(), -60);
  for (const f of await p.feedItem.findMany({ where: { reorderLevel: null } })) {
    const out = await p.feedTransaction.aggregate({ where: { feedType: f.name, direction: "OUT", date: { gte: since } }, _sum: { quantity: true } });
    const used = out._sum.quantity ? out._sum.quantity / 60 : 0;
    const level = Math.max(10, Math.ceil((used * 7) / 10) * 10);
    say("1.5", `${f.name}: uses ${used.toFixed(1)} ${f.unit}/day -> reorder level ${level} ${f.unit}`);
    await run(() => p.feedItem.update({ where: { id: f.id }, data: { reorderLevel: level } }));
  }

  // 5. Engro customer (1.6): it is already a buyer on 8 sales
  if (!(await p.customer.findUnique({ where: { name: "Engro" } }))) { say("1.6", "add customer Engro (buyer on existing sales; phone and terms still to be entered)"); await run(() => p.customer.create({ data: { name: "Engro", notes: TAG + ": created because it already appears on milk sales." } })); }

  // 6. Breed spelling (S1)
  const hol = await p.cow.findMany({ where: { breed: "HOLESTIAN" }, select: { id: true, tag: true } });
  if (hol.length) { say("S1", `breed HOLESTIAN -> Holstein Friesian on tags ${hol.map((c) => c.tag).join(", ")}`); await run(() => p.cow.updateMany({ where: { id: { in: hol.map((c) => c.id) } }, data: { breed: "Holstein Friesian" } })); }

  // 7. Negative pregnancy checks of 30 Sep 2026 for tags 51 and 53 (S4), taken from the WhatsApp note on the animal
  for (const tag of ["51", "53"]) {
    const cow = await p.cow.findFirst({ where: { tag }, select: { id: true, notes: true } });
    if (!cow || !/Pregnancy check 2026-09-30: negative/.test(cow.notes || "")) continue;
    if (await p.pregnancyCheck.findFirst({ where: { cowId: cow.id, date: day("2026-09-30") } })) continue;
    const ai = await p.insemination.findFirst({ where: { cowId: cow.id, date: { lte: day("2026-09-30") } }, orderBy: { date: "desc" } });
    say("S4", `tag ${tag}: negative (open) pregnancy check 2026-09-30${ai ? " linked to the AI of " + iso(ai.date) : ""}`);
    await run(() => p.pregnancyCheck.create({ data: { cowId: cow.id, inseminationId: ai ? ai.id : null, date: day("2026-09-30"), method: "OBSERVATION", result: "OPEN", notes: "From the WhatsApp daily record; AI preparation restarted. " + TAG } }));
  }

  // 8. Cash entries: the three clear fodder sales -> Other income (class override)
  const sales = await p.cashTransaction.findMany({ where: { category: "Uncategorized", amountIn: { gt: 0 }, accountClass: null, OR: [{ remark: { startsWith: "Tori sale" } }, { remark: { startsWith: "Cash Recived L7 Maize Fodder" } }] } });
  for (const s of sales) { say("4.2", `${iso(s.date)} +${s.amountIn} "${(s.remark || "").slice(0, 40)}" -> class OTHER_INCOME`); await run(() => p.cashTransaction.update({ where: { id: s.id }, data: { accountClass: "OTHER_INCOME" } })); }

  // 9. Uncategorized cash-outs whose remark names the cost clearly -> existing categories
  const RULES = [
    [/^(petrol|diesel)\b/i, "Opex Fuel"],
    [/medicine|vaccine|dr bilal|dr ammar/i, "Opex Medical"],
    [/seamon|semen/i, "A.I"],
    [/\bsalary\b/i, "Opex Salaries"],
    [/sailage|silage|beet pulp|wanda|\bsalt\b|tori shifting/i, "Opex Feed"],
    [/rickshaw|repair|welding|generator|inverter|electrician|breaker|internet|water cooler/i, "Opex"],
  ];
  const unc = await p.cashTransaction.findMany({ where: { category: "Uncategorized", amountOut: { gt: 0 }, amountIn: 0 } });
  const tally = {};
  for (const r of unc) {
    const rem = (r.remark || "").replace(/\s+/g, " ");
    if (/wrong|trf|transfer|agri|payment|hafiz|abid|settlement|remaining/i.test(rem)) continue; // money movements and corrections stay for the owner
    const hit = RULES.find(([rx]) => rx.test(rem)); if (!hit) continue;
    tally[hit[1]] = (tally[hit[1]] || 0) + 1;
    console.log(`   ${iso(r.date)} ${r.amountOut} "${rem.slice(0, 50)}" -> ${hit[1]}`);
    await run(() => p.cashTransaction.update({ where: { id: r.id }, data: { category: hit[1] } }));
  }
  say("4.1", "re-categorised: " + (Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(", ") || "none"));

  // 10. Staff from the salary remarks (1.8): only the people with a clear, repeated salary
  const STAFF = [
    { name: "Abdul Basit", monthlySalary: 60000, position: "Accounts and cash entry", active: true },
    { name: "Taha", monthlySalary: 20000, position: null, active: true },
    { name: "Hakeem", monthlySalary: null, position: null, active: true },
  ];
  for (const s of STAFF) {
    if (await p.employee.findFirst({ where: { name: { equals: s.name, mode: "insensitive" } } })) continue;
    say("1.8", `add employee ${s.name}${s.monthlySalary ? " (Rs " + s.monthlySalary + ")" : ""}`);
    await run(() => p.employee.create({ data: { ...s, notes: TAG + ": created from the salary entries in the Cash Register. Confirm role, phone, join date" + (s.monthlySalary ? " and salary." : "; salary varies, so none is set.") } }));
  }

  console.log(APPLY ? "\nAPPLIED." : "\nDRY RUN only. Add --apply to write.");
  await p.$disconnect();
})().catch((e) => { console.error(String(e.message).slice(0, 800)); process.exit(1); });
