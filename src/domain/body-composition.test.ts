import { describe, expect, it } from "vitest";
import { buildBodyComposition, bodyCompositionText, localDate, parseMetricsParam } from "./body-composition";
import { timelineEventSchema } from "./events";
import type { InBodyEvent } from "./inbody";

const test = (id: string, occurredAt: string, weight: number, extra: Array<Record<string, unknown>> = []) => timelineEventSchema.parse({
  id,
  type: "inbody",
  occurredAt,
  timezone: "Europe/Prague",
  source: { url: "/demo/inbody-sample.jpg", mimeType: "image/jpeg", fileName: `${id}.jpg` },
  extraction: { method: "mcp_agent", reviewed: true },
  metrics: [
    { key: "weight", value: weight },
    { key: "skeletal_muscle_mass", value: weight / 2 },
    { key: "percent_body_fat", value: 15 },
    ...extra
  ]
}) as InBodyEvent;

const nutrients = (kcal: number, protein: number) => [
  { key: "energy_kcal", value: kcal },
  { key: "protein", value: protein },
  { key: "fat", value: 70 },
  { key: "carbohydrates", value: 250 }
];

const events = [
  test("a0000000-0000-4000-8000-000000000003", "2026-06-20T14:16:00.000Z", 85.1),
  test("a0000000-0000-4000-8000-000000000001", "2026-01-10T08:48:00.000Z", 79.0, [{ key: "lean_mass_kg", segment: "trunk", value: 31.4 }]),
  test("a0000000-0000-4000-8000-000000000002", "2026-03-01T09:00:00.000Z", 75.3, [{ key: "lean_mass_kg", segment: "trunk", value: 31.2 }])
];

const inputs = {
  events,
  photos: [
    { id: "p-before", occurredAt: new Date("2026-01-05T10:00:00Z") },
    { id: "p-between", occurredAt: new Date("2026-02-14T10:00:00Z") },
    { id: "p-after", occurredAt: new Date("2026-03-04T10:00:00Z") },
    { id: "p-late", occurredAt: new Date("2026-03-20T10:00:00Z") }
  ],
  measurements: [
    { id: "m-near", occurredAt: new Date("2026-02-26T10:00:00Z"), values: { waistCm: 80, hipsCm: undefined } },
    { id: "m-far", occurredAt: new Date("2026-01-30T10:00:00Z"), values: { waistCm: 82 } }
  ],
  food: [
    { occurredAt: new Date("2026-01-10T18:00:00Z"), timezone: "Europe/Prague", nutrients: nutrients(2000, 150) },
    { occurredAt: new Date("2026-01-11T18:00:00Z"), timezone: "Europe/Prague", nutrients: nutrients(2400, 170) },
    { occurredAt: new Date("2026-01-11T12:00:00Z"), timezone: "Europe/Prague", nutrients: nutrients(300, 10) },
    // the day of the second test is not part of the interval
    { occurredAt: new Date("2026-03-01T12:00:00Z"), timezone: "Europe/Prague", nutrients: nutrients(9999, 1) }
  ],
  steps: [
    { date: "2026-01-12", steps: 8000 },
    { date: "2026-01-13", steps: 10000 },
    { date: "2026-01-14", steps: 0 },
    { date: "2026-03-01", steps: 99999 }
  ],
  workouts: [
    { date: "2026-01-15", setCount: 20, tonnageKg: 5000.4 },
    { date: "2026-02-20", setCount: 18, tonnageKg: 4000 },
    { date: "2026-03-02", setCount: 99, tonnageKg: 1 }
  ],
  timezone: "Europe/Prague"
};

describe("buildBodyComposition", () => {
  const tests = buildBodyComposition(inputs);

  it("orders tests oldest first and computes change since previous and since the first test", () => {
    expect(tests.map((item) => item.date)).toEqual(["2026-01-10", "2026-03-01", "2026-06-20"]);
    const weight = (index: number) => tests[index].metrics.find((metric) => metric.key === "weight")!;
    expect(weight(0).deltaFromPrevious).toBeUndefined();
    expect(weight(1)).toMatchObject({ value: 75.3, deltaFromPrevious: -3.7, deltaFromFirst: -3.7 });
    expect(weight(2)).toMatchObject({ value: 85.1, deltaFromPrevious: 9.8, deltaFromFirst: 6.1 });
  });

  it("returns only the trend set by default and every reading, with refs, for metrics=all", () => {
    expect(tests[1].metrics.map((metric) => metric.key)).toEqual(["weight", "skeletal_muscle_mass", "percent_body_fat"]);
    const all = buildBodyComposition({ ...inputs, metrics: "all" })[1];
    expect(all.metrics.find((metric) => metric.segment === "trunk")?.ref).toBe("lean_mass_kg:trunk");
    expect(buildBodyComposition({ ...inputs, metrics: ["lean_mass_kg:trunk"] })[1].metrics).toHaveLength(1);
  });

  it("summarizes diet, steps and training between two tests without counting the later test's own day", () => {
    expect(tests[0].interval).toBeNull();
    const interval = tests[1].interval!;
    expect(interval).toMatchObject({ fromDate: "2026-01-10", toDate: "2026-03-01", days: 50 });
    // 2026-01-10 = 2000 kcal, 2026-01-11 = 2700 kcal
    expect(interval.nutrition).toMatchObject({ loggedDays: 2, avgKcal: 2350, avgProteinG: 165 });
    expect(interval.steps).toEqual({ days: 2, avgSteps: 9000 });
    expect(interval.workouts).toEqual({ count: 2, setCount: 38, tonnageKg: 9000 });
    // the earlier test's own day opens the next interval
    expect(tests[2].interval?.nutrition).toMatchObject({ loggedDays: 1, avgKcal: 9999 });
    expect(tests[2].interval?.steps).toEqual({ days: 1, avgSteps: 99999 });
    expect(tests[2].interval?.workouts.count).toBe(1);
  });

  it("attaches progress photos between the tests and a week after, and the nearest tape measurement", () => {
    expect(tests[1].photos.map((photo) => [photo.eventId, photo.daysFromTest])).toEqual([["p-between", -15], ["p-after", 3]]);
    // the first test has no previous test: only photos within a week of it count
    expect(tests[0].photos.map((photo) => photo.eventId)).toEqual(["p-before"]);
    expect(tests[1].measurement).toMatchObject({ eventId: "m-near", daysFromTest: -3, values: { waistCm: 80 } });
    expect(tests[0].measurement).toBeUndefined();
  });

  it("reads days in the requested timezone", () => {
    expect(localDate(new Date("2026-03-01T23:30:00Z"), "Europe/Prague")).toBe("2026-03-02");
    expect(localDate(new Date("2026-03-01T23:30:00Z"), "UTC")).toBe("2026-03-01");
  });
});

describe("bodyCompositionText", () => {
  it("lists every test with changes, the interval context and attached photos", () => {
    const text = bodyCompositionText(buildBodyComposition(inputs));
    expect(text).toContain("3 InBody tests");
    expect(text).toContain("2026-03-01");
    expect(text).toContain("weight 75.3 kg (-3.7)");
    expect(text).toContain("diet logged 2/50 days: avg 2350 kcal, 165 g protein");
    expect(text).toContain("2 workouts, 38 sets, 9000 kg tonnage");
    expect(text).toContain("progress photos: 2026-02-14 (event p-between, -15d)");
    expect(text).toContain("tape measurements 2026-02-26 (-3d): waistCm 80");
    expect(bodyCompositionText([])).toBe("No InBody tests in this range.");
  });

  it("parses the metrics query value", () => {
    expect(parseMetricsParam(undefined)).toBeUndefined();
    expect(parseMetricsParam("all")).toBe("all");
    expect(parseMetricsParam("weight, percent_body_fat")).toEqual(["weight", "percent_body_fat"]);
  });
});
