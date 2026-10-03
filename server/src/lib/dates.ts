// All "day" values are plain calendar strings (YYYY-MM-DD) interpreted in the user's timezone.
// Internally they are handled as UTC midnights so arithmetic never shifts across DST.

export type Day = string;

const DAY_MS = 86_400_000;

export function toDate(day: Day): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function toDay(date: Date): Day {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: Day, n: number): Day {
  return toDay(new Date(toDate(day).getTime() + n * DAY_MS));
}

export function diffDays(a: Day, b: Day): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(day: Day): number {
  return toDate(day).getUTCDay();
}

/** Monday of the ISO week containing `day`. */
export function weekStart(day: Day): Day {
  const dow = weekday(day);
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

export function isValidDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime()) && toDay(toDate(s)) === s;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Current calendar parts in a timezone. */
export function nowInTz(tz: string, now = new Date()): { day: Day; time: string; weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour"));
  return { day, time: `${get("hour")}:${get("minute")}`, weekday: weekday(day), hour };
}

export function todayInTz(tz: string): Day {
  return nowInTz(tz).day;
}

export function minDay(a: Day, b: Day): Day {
  return a < b ? a : b;
}
