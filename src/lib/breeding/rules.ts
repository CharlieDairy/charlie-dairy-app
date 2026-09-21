// Configurable breeding assumptions. See docs/ROADMAP.md "Assumptions log".
export const BREEDING_CONFIG = {
  gestationDays: 280,
  dryOffDaysBeforeCalving: 60,
  voluntaryWaitingPeriodDays: 60,
} as const;

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function calcExpectedCalvingDate(inseminationDate: Date): Date {
  return addDays(inseminationDate, BREEDING_CONFIG.gestationDays);
}

export function calcExpectedDryOffDate(expectedCalvingDate: Date): Date {
  return addDays(expectedCalvingDate, -BREEDING_CONFIG.dryOffDaysBeforeCalving);
}

export function calcVoluntaryWaitingPeriodEnd(calvingDate: Date): Date {
  return addDays(calvingDate, BREEDING_CONFIG.voluntaryWaitingPeriodDays);
}

/** Days between last calving and conception (or "now" if still open). Null if no calving on record. */
export function calcDaysOpen(lastCalvingDate: Date | null, conceptionDate: Date | null, asOf: Date = new Date()): number | null {
  if (!lastCalvingDate) return null;
  const end = conceptionDate ?? asOf;
  return Math.round((end.getTime() - lastCalvingDate.getTime()) / 86_400_000);
}

export function calcCalvingIntervalDays(previousCalvingDate: Date, currentCalvingDate: Date): number {
  return Math.round((currentCalvingDate.getTime() - previousCalvingDate.getTime()) / 86_400_000);
}
