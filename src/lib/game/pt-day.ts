/** Calendar-day helpers in an IANA timezone (fallback America/Los_Angeles). */

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

/** Return a safe IANA timezone; invalid / empty → America/Los_Angeles. */
export function resolveTimeZone(tz: string | null | undefined): string {
  if (!tz || typeof tz !== "string") return DEFAULT_TIMEZONE;
  const trimmed = tz.trim();
  if (!trimmed) return DEFAULT_TIMEZONE;
  try {
    // Throws RangeError for unknown zones.
    Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** YYYY-MM-DD for the given instant in `tz`. */
export function calendarDay(
  tz: string | null | undefined,
  date: Date = new Date(),
): string {
  const zone = resolveTimeZone(tz);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Add (or subtract) whole calendar days from a YYYY-MM-DD string. */
export function addCalendarDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** First UTC instant whose calendar date in `tz` equals `day`. */
export function startOfDayUtc(day: string, tz: string | null | undefined): Date {
  const zone = resolveTimeZone(tz);
  const anchor = Date.parse(`${day}T12:00:00.000Z`);
  let lo = anchor - 14 * 3600_000;
  let hi = anchor + 14 * 3600_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (calendarDay(zone, new Date(mid)) < day) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/** End of the calendar day in `tz` as an ISO string (last ms of that day). */
export function endOfDayIso(day: string, tz: string | null | undefined): string {
  const next = addCalendarDays(day, 1);
  return new Date(startOfDayUtc(next, tz).getTime() - 1).toISOString();
}

export function yesterday(
  tz: string | null | undefined,
  date: Date = new Date(),
): string {
  return addCalendarDays(calendarDay(tz, date), -1);
}

/** @deprecated Prefer calendarDay(DEFAULT_TIMEZONE, date) */
export function ptCalendarDay(date: Date = new Date()): string {
  return calendarDay(DEFAULT_TIMEZONE, date);
}

/** @deprecated Prefer endOfDayIso(day, DEFAULT_TIMEZONE) */
export function ptEndOfDayIso(day: string): string {
  return endOfDayIso(day, DEFAULT_TIMEZONE);
}

/** @deprecated Prefer yesterday(DEFAULT_TIMEZONE, date) */
export function ptYesterday(date: Date = new Date()): string {
  return yesterday(DEFAULT_TIMEZONE, date);
}
