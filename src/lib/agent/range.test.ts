import { describe, expect, it } from "vitest";
import { parseRangeInTimezone, zonedStartOfDay } from "./range";

describe("zonedStartOfDay", () => {
  it("starts a day at local midnight, including daylight-saving offsets", () => {
    expect(zonedStartOfDay("2026-03-01", "UTC").toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(zonedStartOfDay("2026-03-01", "Europe/Prague").toISOString()).toBe("2026-02-28T23:00:00.000Z");
    expect(zonedStartOfDay("2026-07-01", "Europe/Prague").toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(zonedStartOfDay("2026-03-01", "America/Los_Angeles").toISOString()).toBe("2026-03-01T08:00:00.000Z");
    // the day the clocks go forward in Prague (2026-03-29) is 23 hours long, so the next day starts 23 hours later
    expect(zonedStartOfDay("2026-03-30", "Europe/Prague").getTime() - zonedStartOfDay("2026-03-29", "Europe/Prague").getTime()).toBe(23 * 3_600_000);
  });
});

describe("parseRangeInTimezone", () => {
  it("reads a bare date as a whole day in the requested timezone", () => {
    const range = parseRangeInTimezone("2026-03-01", "2026-03-01", "America/Los_Angeles");
    expect(range).toEqual({ from: new Date("2026-03-01T08:00:00.000Z"), to: new Date("2026-03-02T07:59:59.999Z") });
    // a test at 18:00 local on that day (02:00 UTC the next day) is inside the window
    expect(new Date("2026-03-02T02:00:00.000Z") <= (range as { to: Date }).to).toBe(true);
  });

  it("keeps date-times as they are and still rejects bad or reversed windows", () => {
    expect(parseRangeInTimezone("2026-03-01T10:00:00Z", undefined, "Europe/Prague")).toEqual({ from: new Date("2026-03-01T10:00:00Z") });
    expect(parseRangeInTimezone("2026-02-31", undefined, "UTC")).toEqual({ error: "invalid_date_range" });
    expect(parseRangeInTimezone("2026-03-05", "2026-03-01", "Europe/Prague")).toEqual({ error: "invalid_date_range" });
    expect(parseRangeInTimezone(undefined, undefined, "UTC")).toEqual({});
  });
});
