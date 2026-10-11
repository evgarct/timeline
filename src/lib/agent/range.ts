const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
// ISO 8601 date-time: seconds and fraction optional, zone optional (a missing zone means UTC).
const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/;

export type Range = { from?: Date; to?: Date };

/** A real calendar day: new Date("2026-02-31") would silently become March 3. */
function isRealDay(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

/**
 * Parses the from/to window agents and clients send. A bare YYYY-MM-DD is a whole UTC day (start of day for
 * `from`, end of day for `to`); otherwise an ISO 8601 date-time (UTC when it has no zone). Anything else, an
 * impossible date, or a window that ends before it starts is `invalid_date_range`.
 */
export function parseRange(from?: string | null, to?: string | null): Range | { error: "invalid_date_range" } {
  const bound = (value: string | null | undefined, edge: "start" | "end") => {
    if (!value) return undefined;
    let text: string;
    if (dateOnly.test(value)) {
      if (!isRealDay(value)) return null;
      text = `${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`;
    } else if (dateTime.test(value)) {
      if (!isRealDay(value.slice(0, 10))) return null;
      text = /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
    } else {
      return null;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = bound(from, "start");
  const end = bound(to, "end");
  if (start === null || end === null) return { error: "invalid_date_range" };
  if (start && end && start > end) return { error: "invalid_date_range" };
  return { ...(start ? { from: start } : {}), ...(end ? { to: end } : {}) };
}
