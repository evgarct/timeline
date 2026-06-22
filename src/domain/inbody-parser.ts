import type { InBodyMetric } from "./events";

const definitions: Array<{
  key: string;
  category: InBodyMetric["category"];
  labels: RegExp[];
  unit?: string;
}> = [
  { key: "total_body_water", category: "composition", labels: [/total body water/i], unit: "L" },
  { key: "protein", category: "composition", labels: [/\bprotein\b/i], unit: "kg" },
  { key: "minerals", category: "composition", labels: [/\bminerals?\b/i], unit: "kg" },
  { key: "body_fat_mass", category: "composition", labels: [/body fat mass/i], unit: "kg" },
  { key: "weight", category: "composition", labels: [/\bweight\b/i], unit: "kg" },
  { key: "skeletal_muscle_mass", category: "composition", labels: [/skeletal muscle mass/i, /\bSMM\b/i], unit: "kg" },
  { key: "bmi", category: "obesity", labels: [/\bBMI\b/i], unit: "kg/m²" },
  { key: "percent_body_fat", category: "obesity", labels: [/percent body fat/i, /\bPBF\b/i], unit: "%" },
  { key: "inbody_score", category: "other", labels: [/inbody score/i], unit: "points" },
  { key: "waist_hip_ratio", category: "obesity", labels: [/waist[- ]hip ratio/i] },
  { key: "visceral_fat_level", category: "obesity", labels: [/visceral fat level/i] },
  { key: "fat_free_mass", category: "research", labels: [/fat free mass/i], unit: "kg" },
  { key: "basal_metabolic_rate", category: "research", labels: [/basal metabolic rate/i], unit: "kcal" },
  { key: "obesity_degree", category: "research", labels: [/obesity degree/i], unit: "%" },
  { key: "smi", category: "research", labels: [/\bSMI\b/i], unit: "kg/m²" },
  { key: "recommended_calorie_intake", category: "research", labels: [/recommended calorie intake/i], unit: "kcal" }
];

function normalizeNumber(value: string) {
  return Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
}

export function parseInBodyText(text: string): InBodyMetric[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const metrics: InBodyMetric[] = [];

  for (const definition of definitions) {
    const line = lines.find((candidate) => definition.labels.some((label) => label.test(candidate)));
    if (!line) continue;
    const numbers = line.match(/-?\d+(?:[.,]\d+)?/g);
    if (!numbers?.length) continue;
    const value = normalizeNumber(numbers[0]);
    if (!Number.isFinite(value)) continue;
    metrics.push({
      key: definition.key,
      label: line.replace(/-?\d+(?:[.,]\d+)?.*$/, "").trim() || definition.key,
      value,
      unit: definition.unit,
      category: definition.category
    });
  }

  return metrics;
}

