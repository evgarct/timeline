import { inbodyMetricSchema, type InBodyMetric } from "@/domain/events";
import { INBODY_EXERCISES, INBODY_SEGMENTS, type InBodySegment } from "@/domain/inbody-catalog";

/**
 * A made-up InBody270 sheet for demo mode, stories and tests (never a real report: those are private). `scale` moves
 * the body between two fabricated visits (0 = leaner start, 1 = later, more muscular).
 */
export function fabricatedInBodyMetrics(scale: 0 | 1): InBodyMetric[] {
  const v = (start: number, later: number) => (scale === 0 ? start : later);
  const input: Array<Record<string, unknown>> = [
    { key: "inbody_score", value: v(78, 82) },
    { key: "total_body_water", value: v(46.8, 48.2), referenceMin: 40.1, referenceMax: 49.0 },
    { key: "protein", value: v(12.6, 13.1), referenceMin: 10.8, referenceMax: 13.2 },
    { key: "minerals", value: v(4.2, 4.4), referenceMin: 3.7, referenceMax: 4.5 },
    { key: "body_fat_mass", value: v(11.4, 10.2), referenceMin: 8.4, referenceMax: 16.9 },
    { key: "weight", value: v(75.0, 76.1), referenceMin: 60.2, referenceMax: 81.4 },
    { key: "skeletal_muscle_mass", value: v(36.4, 38.2), referenceMin: 33.1, referenceMax: 40.5 },
    { key: "bmi", value: v(22.6, 22.9), referenceMin: 18.5, referenceMax: 25, evaluation: "normal" },
    { key: "percent_body_fat", value: v(15.2, 13.4), referenceMin: 10, referenceMax: 20, evaluation: "normal" },
    { key: "waist_hip_ratio", value: v(0.84, 0.82), referenceMin: 0.8, referenceMax: 0.9 },
    { key: "visceral_fat_level", value: v(4, 3), referenceMin: 1, referenceMax: 9 },
    { key: "target_weight", value: 75.5 },
    { key: "weight_control", value: v(0.5, -0.6) },
    { key: "fat_control", value: v(0, -1.1) },
    { key: "muscle_control", value: v(0.5, 0.5) },
    { key: "fat_free_mass", value: v(63.6, 65.9), referenceMin: 52.7, referenceMax: 65.2 },
    { key: "basal_metabolic_rate", value: v(1760, 1810), referenceMin: 1560, referenceMax: 1830 },
    { key: "obesity_degree", value: v(100, 101), referenceMin: 90, referenceMax: 110 },
    { key: "smi", value: v(8.4, 8.8) },
    { key: "recommended_calorie_intake", value: v(2640, 2690) }
  ];

  const segmentValue: Record<InBodySegment, { lean: [number, number]; fat: [number, number] }> = {
    left_arm: { lean: [3.5, 3.7], fat: [0.5, 0.4] },
    right_arm: { lean: [3.6, 3.8], fat: [0.5, 0.4] },
    trunk: { lean: [28.4, 29.6], fat: [5.4, 4.8] },
    left_leg: { lean: [9.9, 10.2], fat: [1.8, 1.6] },
    right_leg: { lean: [10.0, 10.3], fat: [1.8, 1.6] }
  };
  for (const segment of INBODY_SEGMENTS) {
    const { lean, fat } = segmentValue[segment];
    input.push(
      { key: "lean_mass_kg", segment, value: v(lean[0], lean[1]) },
      { key: "lean_mass_pct", segment, value: v(105, 109), evaluation: "normal" },
      { key: "fat_mass_kg", segment, value: v(fat[0], fat[1]) },
      { key: "fat_mass_pct", segment, value: v(88, 80), evaluation: "normal" }
    );
    for (const frequencyKhz of [20, 100]) {
      input.push({ key: "impedance_ohm", segment, frequencyKhz, value: (frequencyKhz === 20 ? 300 : 260) + (segment === "trunk" ? -270 : 0) + segment.length });
    }
  }
  INBODY_EXERCISES.forEach((exercise, index) => input.push({ key: `exercise_kcal_${exercise}`, value: 130 + index * 12 }));

  return input.map((metric) => inbodyMetricSchema.parse(metric));
}
