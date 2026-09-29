import { ValidationError } from "@/lib/errors";

// Strict form-field readers. Each throws ValidationError with a message that
// is safe to show the user; runAction() (src/lib/access.ts) turns that into
// a normal `{ success: false, message }` result.
//
// Why not parseFloat/new Date directly: parseFloat("12abc") is 12, "1e9" is a
// billion, new Date("garbage") is an Invalid Date that crashes Prisma, and
// nothing stopped a date in 2099 or a litres value of 1,000,000.

const DAY_MS = 86_400_000;
const MIN_DATE = Date.UTC(2000, 0, 1);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function raw(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null; // absent or a File
  const t = v.trim();
  return t === "" ? null : t;
}

export function optText(fd: FormData, key: string, label: string, opts: { max?: number } = {}): string | null {
  const v = raw(fd, key);
  if (v === null) return null;
  const max = opts.max ?? 500;
  if (v.length > max) throw new ValidationError(`${label} is too long (max ${max} characters).`);
  return v;
}

export function reqText(fd: FormData, key: string, label: string, opts: { max?: number } = {}): string {
  const v = optText(fd, key, label, opts);
  if (v === null) throw new ValidationError(`${label} is required.`);
  return v;
}

export function reqId(fd: FormData, key: string, label: string): string {
  const v = raw(fd, key);
  if (v === null || !ID_RE.test(v)) throw new ValidationError(`${label} is required.`);
  return v;
}

export function optId(fd: FormData, key: string, label: string): string | null {
  const v = raw(fd, key);
  if (v === null) return null;
  if (!ID_RE.test(v)) throw new ValidationError(`${label} is not valid.`);
  return v;
}

type NumOpts = {
  /** inclusive minimum (default 0) */
  min?: number;
  /** inclusive maximum (default 1,000,000,000) */
  max?: number;
  /** must be strictly greater than zero */
  positive?: boolean;
  /** round to this many decimals (default 2) */
  decimals?: number;
};

export function parseNumber(value: string, label: string, opts: NumOpts = {}): number {
  const s = value.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new ValidationError(`${label} must be a number.`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new ValidationError(`${label} must be a number.`);
  const min = opts.min ?? 0;
  const max = opts.max ?? 1_000_000_000;
  if (opts.positive && n <= 0) throw new ValidationError(`${label} must be greater than zero.`);
  if (n < min) throw new ValidationError(`${label} can't be less than ${min.toLocaleString("en-US")}.`);
  if (n > max) throw new ValidationError(`${label} can't be more than ${max.toLocaleString("en-US")}.`);
  const f = 10 ** (opts.decimals ?? 2);
  return Math.round(n * f) / f;
}

export function reqNum(fd: FormData, key: string, label: string, opts: NumOpts = {}): number {
  const v = raw(fd, key);
  if (v === null) throw new ValidationError(`${label} is required.`);
  return parseNumber(v, label, opts);
}

export function optNum(fd: FormData, key: string, label: string, opts: NumOpts = {}): number | null {
  const v = raw(fd, key);
  return v === null ? null : parseNumber(v, label, opts);
}

type DateOpts = {
  /** how many days into the future are allowed (default 0 = not in the future) */
  futureDays?: number;
  /** earliest allowed date (default 2000-01-01) */
  minDate?: Date;
};

export function parseDateValue(value: string, label: string, opts: DateOpts = {}): Date {
  const s = value.trim();
  let d: Date;
  if (DATE_RE.test(s)) {
    d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      throw new ValidationError(`${label} is not a real calendar date.`);
    }
  } else if (DATETIME_RE.test(s)) {
    d = new Date(s);
    const datePart = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || datePart.toISOString().slice(0, 10) !== s.slice(0, 10)) {
      throw new ValidationError(`${label} is not a real date and time.`);
    }
  } else {
    throw new ValidationError(`${label} must be a valid date.`);
  }
  const min = opts.minDate?.getTime() ?? MIN_DATE;
  if (d.getTime() < min) throw new ValidationError(`${label} is too far in the past.`);
  // 1.5 days of slack so a Karachi "today" is never rejected by UTC skew.
  const max = Date.now() + (opts.futureDays ?? 0) * DAY_MS + 1.5 * DAY_MS;
  if (d.getTime() > max) {
    throw new ValidationError(
      opts.futureDays ? `${label} is too far in the future.` : `${label} can't be in the future.`
    );
  }
  return d;
}

export function reqDate(fd: FormData, key: string, label: string, opts: DateOpts = {}): Date {
  const v = raw(fd, key);
  if (v === null) throw new ValidationError(`${label} is required.`);
  return parseDateValue(v, label, opts);
}

export function optDate(fd: FormData, key: string, label: string, opts: DateOpts = {}): Date | null {
  const v = raw(fd, key);
  return v === null ? null : parseDateValue(v, label, opts);
}

export function reqEnum<T extends string>(fd: FormData, key: string, label: string, allowed: readonly T[]): T {
  const v = raw(fd, key);
  if (v === null) throw new ValidationError(`${label} is required.`);
  if (!(allowed as readonly string[]).includes(v)) throw new ValidationError(`${label} isn't one of the allowed choices.`);
  return v as T;
}

export function optEnum<T extends string>(fd: FormData, key: string, label: string, allowed: readonly T[]): T | null {
  const v = raw(fd, key);
  if (v === null) return null;
  if (!(allowed as readonly string[]).includes(v)) throw new ValidationError(`${label} isn't one of the allowed choices.`);
  return v as T;
}

/** Shared enum value lists, matching prisma/schema.prisma. */
export const SHIFTS = ["MORNING", "AFTERNOON", "EVENING"] as const;
export const CASH_MODES = ["CASH", "BANK"] as const;
export const DIRECTIONS = ["IN", "OUT"] as const;
export const MILK_USE_TYPES = ["CALF_USE", "FARM_USE", "EMPLOYEE_USE"] as const;
