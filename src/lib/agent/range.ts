const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export type Range = { from?: Date; to?: Date };

/**
 * Parses the from/to window agents and clients send. A bare YYYY-MM-DD is a whole UTC day (start of day for
 * `from`, end of day for `to`); anything else must be an ISO 8601 date-time. Returns `error` for unparsable input
 * or a window that ends before it starts.
 */
export function parseRange(from?: string | null, to?: string | null): Range | { error: "invalid_date_range" } {
  const bound = (value: string | null | undefined, edge: "start" | "end") => {
    if (!value) return undefined;
    const date = new Date(dateOnly.test(value) ? `${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = bound(from, "start");
  const end = bound(to, "end");
  if (start === null || end === null) return { error: "invalid_date_range" };
  if (start && end && start > end) return { error: "invalid_date_range" };
  return { ...(start ? { from: start } : {}), ...(end ? { to: end } : {}) };
}
