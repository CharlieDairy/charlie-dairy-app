// Applies the data transcribed from the farm's handwritten registers (E:\Charlie\health\register-transcription.json)
// to the app WITHOUT creating duplicates: every item is matched to what the app already has first.
//
//   node scripts/apply-health-register.js            dry run: prints what would change, writes nothing
//   node scripts/apply-health-register.js --apply    makes the changes
//
// Nothing is deleted. Every new record carries enteredBy = BY so it can be found again.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const APPLY = process.argv.includes("--apply");
const FILE = process.env.REGISTER_JSON || "E:/Charlie/health/register-transcription.json";
const BY = "Register import (photos, 15 Oct 2026)";
const DAY = 86_400_000;
const D = (s) => new Date(s + "T00:00:00Z");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dayDiff = (a, b) => Math.abs(Math.round((new Date(a) - new Date(b)) / DAY));

(async () => {
  const p = new PrismaClient();
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const log = { planned: [], skipped: [], warnings: [] };
  const plan = (kind, msg) => log.planned.push([kind, msg]);
  const skip = (msg) => log.skipped.push(msg);
  const run = async (fn) => { if (APPLY) await fn(); };

  const cows = await p.cow.findMany({ include: { calfRecord: true, calvingsAsDam: { include: { calves: true } }, inseminations: true, vaccinations: true, treatments: true } });
  const byTag = new Map(cows.map((c) => [c.tag.trim(), c]));
  const addNote = (c, text) => (c.notes ? c.notes + "; " : "") + text;
  const touched = new Map();
  const change = (tag, fields, note) => { const t = touched.get(tag) || { fields: {}, notes: [] }; Object.assign(t.fields, fields); if (note) t.notes.push(note); touched.set(tag, t); };

  // ---------------------------------------------------------------- 1. birth register: DOB, sex, dam, calving
  for (const k of data.calves) {
    const calf = byTag.get(k.tag), dam = byTag.get(k.dam);
    if (!calf) { log.warnings.push(`calf ${k.tag} is not in the app`); continue; }
    if (!dam) { log.warnings.push(`dam ${k.dam} of calf ${k.tag} is not in the app`); continue; }
    if (k.doubt) log.warnings.push(`calf ${k.tag}: ${k.doubt}`);
    const dob = D(k.dob);
    if (!calf.dateOfBirth || iso(calf.dateOfBirth) !== k.dob) {
      plan("dob", `${k.tag}: date of birth ${iso(calf.dateOfBirth) || "blank"} -> ${k.dob}`);
      change(k.tag, { dateOfBirth: dob }, calf.dateOfBirth ? `Date of birth corrected from ${iso(calf.dateOfBirth)} to ${k.dob} (birth register)` : `Date of birth ${k.dob} from the birth register`);
    }
    if (calf.gender !== k.sex) {
      plan("sex", `${k.tag}: sex ${calf.gender} -> ${k.sex}`);
      change(k.tag, { gender: k.sex }, `Sex set to ${k.sex.toLowerCase()} (birth register; was ${calf.gender.toLowerCase()})`);
    }
    const existing = dam.calvingsAsDam.find((c) => dayDiff(c.date, dob) <= 3);
    const linked = existing && existing.calves.some((x) => x.cowId === calf.id);
    if (calf.calfRecord || linked) { skip(`calf ${k.tag} is already linked to a calving`); }
    else if (existing) {
      const open = existing.calves.find((x) => !x.cowId);
      if (open) { plan("link", `${k.tag}: attach to the existing calving of ${k.dam} on ${iso(existing.date)}`); await run(() => p.calf.update({ where: { id: open.id }, data: { cowId: calf.id, tag: k.tag, sex: k.sex } })); }
      else { plan("calf", `${k.tag}: add as a calf of the existing calving of ${k.dam} on ${iso(existing.date)}`); await run(() => p.calf.create({ data: { calvingId: existing.id, cowId: calf.id, sex: k.sex, outcome: "ALIVE", tag: k.tag } })); }
    } else {
      plan("calving", `${k.dam}: new calving ${k.dob} with calf ${k.tag} (${k.sex.toLowerCase()})`);
      await run(() => p.calving.create({ data: { damId: dam.id, date: dob, calfCount: 1, enteredBy: BY, notes: "From the farm's birth register", calves: { create: [{ sex: k.sex, outcome: "ALIVE", tag: k.tag, cowId: calf.id }] } } }));
      dam.calvingsAsDam.push({ id: "new", date: dob, calves: [{ cowId: calf.id }] });
    }
  }
  for (const c of cows) {
    if (["SOLD", "DEAD"].includes(c.status) || !c.calvingsAsDam.length) continue;
    const latest = c.calvingsAsDam.map((x) => new Date(x.date)).sort((a, b) => b - a)[0];
    if (!c.lastCalvingDate || new Date(c.lastCalvingDate) < latest) {
      plan("lastCalving", `${c.tag}: last calving ${iso(c.lastCalvingDate) || "blank"} -> ${iso(latest)}`);
      change(c.tag, { lastCalvingDate: latest });
    }
  }

  // ---------------------------------------------------------------- 2. breeding register: inseminations
  const serviceNo = new Map();
  for (const b of data.breeding) {
    const cow = byTag.get(b.tag);
    if (!cow) { log.warnings.push(`breeding: cow ${b.tag} is not in the app`); continue; }
    const date = D(b.date);
    const semen = b.semen ? `${b.semen} semen` : b.method === "NATURAL" ? "natural service" : "";
    const detail = [semen, b.note].filter(Boolean).join("; ");
    const match = cow.inseminations.find((i) => dayDiff(i.date, date) <= 1);
    if (match) {
      if (!match.bullTag) {
        plan("ai-enrich", `${b.tag}: AI ${iso(match.date)} already in the app (register date ${b.date}): add bull ${b.bull}`);
        await run(() => p.insemination.update({ where: { id: match.id }, data: { bullTag: b.bull, notes: [match.notes, `Register: ${detail}${iso(match.date) !== b.date ? ` (register date ${b.date})` : ""}`].filter(Boolean).join("; ") } }));
      } else skip(`${b.tag}: AI ${b.date} already complete`);
      continue;
    }
    const n = (serviceNo.get(b.tag) || cow.inseminations.length) + 1; serviceNo.set(b.tag, n);
    plan("ai-new", `${b.tag}: new ${b.method === "NATURAL" ? "natural service" : "AI"} ${b.date} (${b.bull}${b.semen ? ", " + b.semen : ""})`);
    await run(() => p.insemination.create({ data: { cowId: cow.id, date, method: b.method, bullTag: b.bull, serviceNumber: n, notes: detail || null, enteredBy: BY } }));
  }

  // ---------------------------------------------------------------- 3. cow status from the breeding register
  for (const s of data.cowStatus) {
    const cow = byTag.get(s.tag);
    if (!cow) continue;
    const fields = {};
    if (cow.status !== s.status) fields.status = s.status;
    if (s.dryDate && iso(cow.dryDate) !== s.dryDate) fields.dryDate = D(s.dryDate);
    if (s.expectedCalving && iso(cow.expectedCalving) !== s.expectedCalving) fields.expectedCalving = D(s.expectedCalving);
    if (Object.keys(fields).length) { plan("status", `${s.tag}: ${Object.entries(fields).map(([k, v]) => `${k} ${k === "status" ? cow.status : iso(cow[k]) || "blank"} -> ${v instanceof Date ? iso(v) : v}`).join(", ")}`); change(s.tag, fields, s.note); }
  }

  // ---------------------------------------------------------------- 4. herd-wide vaccine and deworming dates from the register footer
  const he = data.herdEvents;
  const hasVac = (cow, rx, date) => cow.vaccinations.some((v) => rx.test(v.vaccineName) && dayDiff(v.date, date) <= 3);
  for (const t of he.cows) {
    const cow = byTag.get(t);
    if (!cow) continue;
    if (!hasVac(cow, /\bhs\b|haemorr|hemorr/i, D(he.hs))) { plan("vac", `${t}: HS vaccine ${he.hs}`); await run(() => p.vaccinationRecord.create({ data: { cowId: cow.id, vaccineName: "HS (Hemorrhagic Septicemia)", date: D(he.hs), nextDueDate: new Date(D(he.hs).getTime() + 365 * DAY), notes: "From the breeding register footer (12/12/25)", enteredBy: BY } })); } else skip(`${t}: HS ${he.hs} already there`);
    if (!hasVac(cow, /clostrid/i, D(he.clostridial))) { plan("vac", `${t}: Clostridial vaccine ${he.clostridial}`); await run(() => p.vaccinationRecord.create({ data: { cowId: cow.id, vaccineName: "Clostridial vaccine", date: D(he.clostridial), notes: "From the breeding register footer (08/4/26)", enteredBy: BY } })); } else skip(`${t}: Clostridial ${he.clostridial} already there`);
    if (!cow.treatments.some((x) => /ivermectin|deworm/i.test(x.medicineName) && dayDiff(x.date, D(he.deworming)) <= 3)) { plan("treat", `${t}: deworming / Ivermectin ${he.deworming}`); await run(() => p.treatmentRecord.create({ data: { cowId: cow.id, medicineName: "Ivermectin (deworming)", date: D(he.deworming), reason: "Deworming", notes: "From the breeding register footer (21/10/25)", enteredBy: BY } })); } else skip(`${t}: deworming ${he.deworming} already there`);
  }

  // ---------------------------------------------------------------- write the cow field changes
  for (const [tag, t] of touched) {
    const cow = byTag.get(tag);
    const notes = t.notes.length ? addNote(cow, t.notes.join("; ")) : cow.notes;
    await run(() => p.cow.update({ where: { id: cow.id }, data: { ...t.fields, notes } }));
  }

  // ---------------------------------------------------------------- report
  const kinds = {};
  for (const [k] of log.planned) kinds[k] = (kinds[k] || 0) + 1;
  console.log(APPLY ? "APPLIED" : "DRY RUN (nothing written)");
  for (const [k, m] of log.planned) console.log(`  [${k}] ${m}`);
  console.log("\nSummary:", JSON.stringify(kinds));
  console.log("Skipped as already in the app:", log.skipped.length);
  if (log.warnings.length) { console.log("\nWarnings:"); log.warnings.forEach((w) => console.log("  - " + w)); }
  if (APPLY) await p.auditLog.create({ data: { userName: "Claude (register import)", action: "IMPORT", entity: "BreedingRegister", newValue: JSON.stringify({ summary: kinds, source: "E:/Charlie/health photos" }) } });
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
