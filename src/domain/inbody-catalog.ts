/**
 * Canonical metrics of an InBody270 result sheet. Agents send only `key` + `value` (plus reference range, evaluation,
 * segment or frequency where the sheet has them); label, unit and category come from here so every test is comparable.
 */
export const INBODY_SEGMENTS = ["left_arm", "right_arm", "trunk", "left_leg", "right_leg"] as const;
export type InBodySegment = (typeof INBODY_SEGMENTS)[number];

export const INBODY_CATEGORIES = [
  "composition", "obesity", "control", "research", "segmental_lean", "segmental_fat", "impedance", "exercise", "other"
] as const;
export type InBodyCategory = (typeof INBODY_CATEGORIES)[number];

export const INBODY_FREQUENCIES_KHZ = [20, 100] as const;

export type InBodyDefinition = {
  key: string;
  label: string;
  unit?: string;
  category: InBodyCategory;
  /** The sheet gives one value per body segment (arms, trunk, legs). */
  segmental?: boolean;
  /** The sheet gives one value per measuring frequency. */
  frequency?: boolean;
};

/** The 30-minute calorie table at the bottom of the sheet. */
export const INBODY_EXERCISES = [
  "golf", "walking", "badminton", "tennis", "boxing", "mountain_climbing", "aerobics", "soccer", "japanese_fencing",
  "squash", "gateball", "yoga", "table_tennis", "bicycling", "basketball", "jumping_rope", "jogging", "swimming",
  "racketball", "taekwondo"
] as const;

const titleCase = (key: string) => key.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export const INBODY_CATALOG: InBodyDefinition[] = [
  { key: "inbody_score", label: "InBody Score", unit: "points", category: "other" },
  { key: "total_body_water", label: "Total Body Water", unit: "L", category: "composition" },
  { key: "protein", label: "Protein", unit: "kg", category: "composition" },
  { key: "minerals", label: "Minerals", unit: "kg", category: "composition" },
  { key: "body_fat_mass", label: "Body Fat Mass", unit: "kg", category: "composition" },
  { key: "weight", label: "Weight", unit: "kg", category: "composition" },
  { key: "skeletal_muscle_mass", label: "Skeletal Muscle Mass", unit: "kg", category: "composition" },
  { key: "bmi", label: "BMI", unit: "kg/m²", category: "obesity" },
  { key: "percent_body_fat", label: "Percent Body Fat", unit: "%", category: "obesity" },
  { key: "waist_hip_ratio", label: "Waist-Hip Ratio", category: "obesity" },
  { key: "visceral_fat_level", label: "Visceral Fat Level", category: "obesity" },
  { key: "target_weight", label: "Target Weight", unit: "kg", category: "control" },
  { key: "weight_control", label: "Weight Control", unit: "kg", category: "control" },
  { key: "fat_control", label: "Fat Control", unit: "kg", category: "control" },
  { key: "muscle_control", label: "Muscle Control", unit: "kg", category: "control" },
  { key: "fat_free_mass", label: "Fat Free Mass", unit: "kg", category: "research" },
  { key: "basal_metabolic_rate", label: "Basal Metabolic Rate", unit: "kcal", category: "research" },
  { key: "obesity_degree", label: "Obesity Degree", unit: "%", category: "research" },
  { key: "smi", label: "SMI", unit: "kg/m²", category: "research" },
  { key: "recommended_calorie_intake", label: "Recommended Calorie Intake", unit: "kcal", category: "research" },
  { key: "lean_mass_kg", label: "Segmental Lean Mass", unit: "kg", category: "segmental_lean", segmental: true },
  { key: "lean_mass_pct", label: "Segmental Lean Evaluation", unit: "%", category: "segmental_lean", segmental: true },
  { key: "fat_mass_kg", label: "Segmental Fat Mass", unit: "kg", category: "segmental_fat", segmental: true },
  { key: "fat_mass_pct", label: "Segmental Fat Evaluation", unit: "%", category: "segmental_fat", segmental: true },
  { key: "impedance_ohm", label: "Impedance", unit: "Ω", category: "impedance", segmental: true, frequency: true },
  ...INBODY_EXERCISES.map((exercise): InBodyDefinition => ({
    key: `exercise_kcal_${exercise}`,
    label: `${titleCase(exercise)} (30 min)`,
    unit: "kcal",
    category: "exercise"
  }))
];

const byKey = new Map(INBODY_CATALOG.map((definition) => [definition.key, definition]));

export function inBodyDefinition(key: string) {
  return byKey.get(key);
}

/** Headline metrics for cards and agent summaries, in display order. */
export const INBODY_SUMMARY_KEYS = [
  "inbody_score", "weight", "skeletal_muscle_mass", "percent_body_fat", "body_fat_mass", "visceral_fat_level", "basal_metabolic_rate"
] as const;

/** Metrics worth trending across tests (the Body page picker and the default of `get_body_composition`). */
export const INBODY_TREND_KEYS = [
  "weight", "skeletal_muscle_mass", "body_fat_mass", "percent_body_fat", "fat_free_mass", "total_body_water", "protein",
  "minerals", "bmi", "visceral_fat_level", "basal_metabolic_rate", "waist_hip_ratio", "smi", "inbody_score"
] as const;

/** Two metrics are the same reading when key, segment and frequency match. */
export function inBodyMetricIdentity(metric: { key: string; segment?: string; frequencyKhz?: number }) {
  return `${metric.key}|${metric.segment ?? ""}|${metric.frequencyKhz ?? ""}`;
}
