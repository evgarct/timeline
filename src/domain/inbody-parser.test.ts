import { describe, expect, it } from "vitest";
import { parseInBodyText } from "./inbody-parser";

describe("InBody parser", () => {
  it("extracts canonical metrics from OCR text with decimal commas", () => {
    const metrics = parseInBodyText(`
      Total Body Water 55,3 L
      Weight 85,1 kg
      SMM Skeletal Muscle Mass 43,8 kg
      PBF Percent Body Fat 11,4 %
      Basal Metabolic Rate 1999 kcal
    `);
    expect(metrics.find((metric) => metric.key === "weight")?.value).toBe(85.1);
    expect(metrics.find((metric) => metric.key === "skeletal_muscle_mass")?.value).toBe(43.8);
    expect(metrics.find((metric) => metric.key === "percent_body_fat")?.value).toBe(11.4);
  });
});

