import { describe, expect, it } from "vitest";
import { fabricatedInBodyMetrics } from "@/data/seed-inbody";
import { inbodyMetricSchema, timelineEventSchema } from "./events";
import { findMetric, inBodyHeadline, inBodyLine, inBodyText, metricDelta, referenceStatus, type InBodyEvent } from "./inbody";
import { INBODY_CATALOG, inBodyMetricIdentity } from "./inbody-catalog";

const base = {
  id: "7c1d3b52-5f0a-4f0e-9d3e-0f4f8c1a2b11",
  type: "inbody" as const,
  occurredAt: "2026-06-20T14:16:00.000Z",
  timezone: "Europe/Prague",
  source: { assetId: "5b7f2a40-1c8e-4d6a-9f3b-2e1d0c9b8a77", mimeType: "image/jpeg" as const, fileName: "sheet.jpg" },
  extraction: { method: "mcp_agent" as const, reviewed: false }
};

describe("InBody metric catalog", () => {
  it("has unique keys and fills label, unit and category from the catalog", () => {
    expect(new Set(INBODY_CATALOG.map((definition) => definition.key)).size).toBe(INBODY_CATALOG.length);
    expect(inbodyMetricSchema.parse({ key: "skeletal_muscle_mass", value: 40.2 })).toEqual({
      key: "skeletal_muscle_mass", value: 40.2, label: "Skeletal Muscle Mass", unit: "kg", category: "composition"
    });
  });

  it("keeps what the sender provided and files unknown keys under other", () => {
    expect(inbodyMetricSchema.parse({ key: "custom_thing", value: 1, label: "Custom", unit: "x" })).toMatchObject({ label: "Custom", unit: "x", category: "other" });
    expect(inbodyMetricSchema.parse({ key: "weight", value: 1, label: "Body mass", unit: "lb" })).toMatchObject({ label: "Body mass", unit: "lb" });
  });

  it("requires a segment for segmental readings and a frequency for impedance", () => {
    expect(inbodyMetricSchema.safeParse({ key: "lean_mass_kg", value: 4.1 }).success).toBe(false);
    expect(inbodyMetricSchema.safeParse({ key: "lean_mass_kg", segment: "left_arm", value: 4.1 }).success).toBe(true);
    expect(inbodyMetricSchema.safeParse({ key: "impedance_ohm", segment: "trunk", value: 23.5 }).success).toBe(false);
    expect(inbodyMetricSchema.safeParse({ key: "impedance_ohm", segment: "trunk", frequencyKhz: 20, value: 23.5 }).success).toBe(true);
  });
});

describe("InBody event", () => {
  it("rejects the same reading twice but allows one key per segment", () => {
    const twice = timelineEventSchema.safeParse({ ...base, metrics: [{ key: "weight", value: 75 }, { key: "weight", value: 76 }] });
    expect(twice.success).toBe(false);
    const perSegment = timelineEventSchema.safeParse({
      ...base,
      metrics: [{ key: "lean_mass_kg", segment: "left_arm", value: 4 }, { key: "lean_mass_kg", segment: "right_arm", value: 4.1 }]
    });
    expect(perSegment.success).toBe(true);
  });

  it("still accepts events stored before the catalog existed (full metrics, no evaluation or report)", () => {
    const parsed = timelineEventSchema.parse({
      ...base,
      metrics: [{ key: "weight", label: "Weight", value: 85.1, unit: "kg", category: "composition" }]
    });
    expect(parsed.type === "inbody" && parsed.metrics[0].label).toBe("Weight");
  });

  it("parses the fabricated full sheet and reads it back by key, segment and frequency", () => {
    const event = timelineEventSchema.parse({ ...base, report: { device: "InBody270", heightCm: 180 }, metrics: fabricatedInBodyMetrics(1) }) as InBodyEvent;
    expect(event.metrics.length).toBeGreaterThan(60);
    expect(findMetric(event, "lean_mass_kg", "trunk")?.value).toBeGreaterThan(20);
    expect(findMetric(event, "impedance_ohm", "left_leg", 100)).toBeDefined();
    expect(findMetric(event, "lean_mass_kg")).toBeUndefined();
    expect(new Set(event.metrics.map(inBodyMetricIdentity)).size).toBe(event.metrics.length);
    expect(inBodyHeadline(event).map((metric) => metric.key)).toEqual(["inbody_score", "weight", "skeletal_muscle_mass", "percent_body_fat", "body_fat_mass", "visceral_fat_level", "basal_metabolic_rate"]);
    expect(inBodyLine(event)).toContain("weight 76.1 kg");
  });

  it("computes changes to the sheet's precision and a reference status", () => {
    const before = timelineEventSchema.parse({ ...base, metrics: fabricatedInBodyMetrics(0) }) as InBodyEvent;
    const after = timelineEventSchema.parse({ ...base, metrics: fabricatedInBodyMetrics(1) }) as InBodyEvent;
    expect(metricDelta(after, before, "weight")).toBe(1.1);
    expect(metricDelta(after, undefined, "weight")).toBeUndefined();
    expect(metricDelta(after, before, "nope")).toBeUndefined();
    expect(referenceStatus({ value: 8, referenceMin: 9.2, referenceMax: 18.5 })).toBe("under");
    expect(referenceStatus({ value: 11.4, referenceMin: 9.2, referenceMax: 18.5 })).toBe("normal");
    expect(referenceStatus({ value: 3 })).toBeUndefined();
  });

  it("writes every reading into the agent text, with segment, reference range and evaluation", () => {
    const event = timelineEventSchema.parse({ ...base, metrics: fabricatedInBodyMetrics(1), report: { device: "InBody270" } }) as InBodyEvent;
    const text = inBodyText(event);
    expect(text).toContain("id 7c1d3b52-5f0a-4f0e-9d3e-0f4f8c1a2b11");
    expect(text).toContain("get_inbody_original");
    expect(text).toContain("weight 76.1 kg (ref 60.2-81.4)");
    expect(text).toContain("lean_mass_pct[left_arm] 109 % normal");
    expect(text).toContain("impedance_ohm[trunk@20kHz]");
    expect(text).toContain("exercise_kcal_golf 130 kcal");
  });
});
