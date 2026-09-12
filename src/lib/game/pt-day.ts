/** Pacific Time calendar helpers (America/Los_Angeles). */

const PT = "America/Los_Angeles";

/** YYYY-MM-DD for the given instant in Pacific Time. */
export function ptCalendarDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PT,
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

/** First UTC instant whose PT calendar date equals `day`. */
export function ptStartOfDayUtc(day: string): Date {
  const anchor = Date.parse(`${day}T12:00:00.000Z`);
  let lo = anchor - 14 * 3600_000;
  let hi = anchor + 14 * 3600_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ptCalendarDay(new Date(mid)) < day) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/** End of the PT calendar day as an ISO string (last ms of that day in PT). */
export function ptEndOfDayIso(day: string): string {
  const next = addCalendarDays(day, 1);
  return new Date(ptStartOfDayUtc(next).getTime() - 1).toISOString();
}

export function ptYesterday(date: Date = new Date()): string {
  return addCalendarDays(ptCalendarDay(date), -1);
}
