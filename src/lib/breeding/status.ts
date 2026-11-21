import { BREEDING_CONFIG } from "./rules";

// The breeding tag on a female animal, worked out from the records the farm manager already enters (calving, heat,
// insemination, pregnancy check), so nobody types a status twice. The animal's latest event decides the stage:
//
//   calved (delivered) -> waiting for heat (after the waiting period) -> in heat -> inseminated
//   -> pregnancy check due (day 40) -> confirm pregnancy (overdue from day 60) -> pregnant -> due to calve -> calved ...
//   a negative check sends her back to "open, waiting for heat".
//
// Pure (dates in, tag out) so the rules are tested without a database.

export const FOLLOW_UP = {
  /** pregnancy check is due this many days after the insemination */
  checkDueDays: 40,
  /** the result must be confirmed by this many days after the insemination; after that it is overdue */
  confirmByDays: 60,
  /** a heat seen this long ago and not served is over */
  heatWindowDays: 3,
  /** heifers are ready to breed from this age */
  heiferBreedingMonths: 15,
} as const;

export type BreedingCode =
  | "NOT_YET_BRED"
  | "WAITING_FOR_HEAT" // old enough / past the waiting period, not served
  | "CALVED" // delivered recently, still in the waiting period
  | "IN_HEAT"
  | "INSEMINATED"
  | "CHECK_DUE"
  | "CHECK_OVERDUE"
  | "PREGNANT"
  | "DUE_TO_CALVE"
  | "OPEN"; // checked and not pregnant

export type Tone = "neutral" | "sky" | "amber" | "rose" | "violet" | "red" | "green" | "orange";

export type BreedingInput = {
  gender: string;
  /** the animal's life stage as the farm records it: MILKING, DRY, HEIFER, CALF, SOLD, DEAD ... */
  status: string;
  dateOfBirth: Date | null;
  expectedCalving: Date | null;
  /** latest calving on record (the animal's own date or a calving record, whichever is newer) */
  lastCalving: Date | null;
  lastHeat: Date | null;
  lastInsemination: Date | null;
  lastCheck: { date: Date; result: string } | null;
};

export type BreedingTag = {
  code: BreedingCode;
  label: string;
  tone: Tone;
  /** one short line: how many days, and what happens next */
  detail: string;
  /** days since the event that put her in this stage */
  days: number | null;
  /** the farm manager has something to do for her now */
  needsAction: boolean;
};

const DAY = 86_400_000;
const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

const LABEL: Record<BreedingCode, { label: string; tone: Tone }> = {
  NOT_YET_BRED: { label: "Not yet bred", tone: "neutral" },
  WAITING_FOR_HEAT: { label: "Waiting for heat", tone: "amber" },
  CALVED: { label: "Calved", tone: "sky" },
  IN_HEAT: { label: "In heat", tone: "rose" },
  INSEMINATED: { label: "Inseminated", tone: "violet" },
  CHECK_DUE: { label: "Pregnancy check due", tone: "amber" },
  CHECK_OVERDUE: { label: "Confirm pregnancy (overdue)", tone: "red" },
  PREGNANT: { label: "Pregnant", tone: "green" },
  DUE_TO_CALVE: { label: "Due to calve", tone: "rose" },
  OPEN: { label: "Open, waiting for heat", tone: "orange" },
};

function tag(code: BreedingCode, detail: string, days: number | null, needsAction = false): BreedingTag {
  return { code, ...LABEL[code], detail, days, needsAction };
}

type Event = { type: "heat" | "ai" | "check" | "calving"; date: Date; rank: number; result?: string };

/** The breeding tag for one animal, or null when no tag applies (males, calves, sold or dead animals). */
export function breedingTag(a: BreedingInput, today: Date): BreedingTag | null {
  if (a.gender !== "FEMALE") return null;
  if (a.status === "SOLD" || a.status === "DEAD" || a.status === "CALF") return null;

  // Later in the cycle wins a tie on the same day (a check beats the insemination it follows).
  const events: Event[] = [];
  if (a.lastHeat) events.push({ type: "heat", date: a.lastHeat, rank: 1 });
  if (a.lastInsemination) events.push({ type: "ai", date: a.lastInsemination, rank: 2 });
  if (a.lastCheck) events.push({ type: "check", date: a.lastCheck.date, rank: 3, result: a.lastCheck.result });
  if (a.lastCalving) events.push({ type: "calving", date: a.lastCalving, rank: 4 });
  events.sort((x, y) => y.date.getTime() - x.date.getTime() || y.rank - x.rank);

  // A heat that was not served within a few days is over: look past it.
  let last = events[0];
  if (last?.type === "heat" && daysBetween(last.date, today) > FOLLOW_UP.heatWindowDays) last = events.find((e) => e.type !== "heat") as Event;

  const pregnant = (): BreedingTag => {
    if (a.expectedCalving && a.expectedCalving.getTime() <= today.getTime()) {
      return tag("DUE_TO_CALVE", `Expected ${iso(a.expectedCalving)}. Record the calving when she delivers.`, daysBetween(a.expectedCalving, today), true);
    }
    return tag("PREGNANT", a.expectedCalving ? `Expected calving ${iso(a.expectedCalving)}` : "Pregnancy confirmed", null);
  };

  if (!last) {
    if (a.expectedCalving) return pregnant();
    if (a.status === "DRY") return null; // no records to say more
    if (a.status === "HEIFER") {
      const months = a.dateOfBirth ? daysBetween(a.dateOfBirth, today) / 30.44 : null;
      if (months !== null && months >= FOLLOW_UP.heiferBreedingMonths) return tag("WAITING_FOR_HEAT", `Old enough to breed (${Math.floor(months)} months)`, null, true);
      return tag("NOT_YET_BRED", months !== null ? `${Math.floor(months)} months old` : "Age not recorded", null);
    }
    return tag("WAITING_FOR_HEAT", "No insemination on record", null, true);
  }

  const since = daysBetween(last.date, today);

  switch (last.type) {
    case "calving": {
      if (since < BREEDING_CONFIG.voluntaryWaitingPeriodDays) {
        return tag("CALVED", `Calved ${plural(since)} ago. Heat watch from day ${BREEDING_CONFIG.voluntaryWaitingPeriodDays}.`, since);
      }
      return tag("WAITING_FOR_HEAT", `${plural(since)} since calving`, since, true);
    }
    case "heat":
      return tag("IN_HEAT", since === 0 ? "Heat seen today. Inseminate." : `Heat seen ${plural(since)} ago. Inseminate.`, since, true);
    case "ai": {
      if (a.expectedCalving) return pregnant(); // pregnancy already recorded against this service
      if (since >= FOLLOW_UP.confirmByDays) return tag("CHECK_OVERDUE", `${plural(since)} since insemination. Record the result: pregnant or open.`, since, true);
      if (since >= FOLLOW_UP.checkDueDays) return tag("CHECK_DUE", `${plural(since)} since insemination. Check now; confirm by day ${FOLLOW_UP.confirmByDays}.`, since, true);
      return tag("INSEMINATED", `Day ${since} of ${FOLLOW_UP.checkDueDays}. Pregnancy check due ${iso(new Date(last.date.getTime() + FOLLOW_UP.checkDueDays * DAY))}.`, since);
    }
    case "check": {
      if (last.result === "PREGNANT") return pregnant();
      if (last.result === "OPEN") return tag("OPEN", `Checked open ${plural(since)} ago. Watch for heat.`, since, true);
      return tag("CHECK_DUE", `Inconclusive ${plural(since)} ago. Check again.`, since, true);
    }
  }
}

/** The order the farm manager should work through the animals that need action. */
export const NEEDS_ACTION_ORDER: BreedingCode[] = ["CHECK_OVERDUE", "DUE_TO_CALVE", "IN_HEAT", "CHECK_DUE", "OPEN", "WAITING_FOR_HEAT"];

/** How many animals are in each stage. */
export function countByCode(tags: (BreedingTag | null)[]): Partial<Record<BreedingCode, number>> {
  const out: Partial<Record<BreedingCode, number>> = {};
  for (const t of tags) if (t) out[t.code] = (out[t.code] ?? 0) + 1;
  return out;
}
