// Maps rows of the MIT-licensed hasaneyldrm/exercises-dataset (metadata and text only — its images,
// GIFs and videos belong to Gym visual and must never be copied) onto Form's exercise catalog.
// Kept dependency-free so the seed script can import it directly under Node.

export interface DatasetExercise {
  id: string;
  name: string;
  target: string;
  secondary_muscles?: string[];
  equipment?: string;
}

export interface CatalogExercise {
  name: string;
  searchAliases: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  movementPattern: "squat" | "hinge" | "push" | "pull" | "lunge" | "carry" | "core" | "other";
  equipment?: string;
  images?: string[];
  instructions?: string[];
  externalRef: { source: string; id: string };
}

export const exerciseDatasetSource = "exercises-dataset";
export const freeExerciseSource = "free-exercise-db";

// Canonical muscle vocabulary used everywhere in Form (lowercase English ids; the UI localizes them).
const muscleMap: Record<string, string | null> = {
  pectorals: "chest", chest: "chest", "upper chest": "chest",
  lats: "lats", "latissimus dorsi": "lats",
  "upper back": "upper back", "middle back": "upper back", rhomboids: "upper back", back: "upper back",
  traps: "traps", trapezius: "traps",
  delts: "shoulders", deltoids: "shoulders", "rear deltoids": "shoulders", shoulders: "shoulders", "rotator cuff": "shoulders",
  biceps: "biceps", brachialis: "biceps",
  triceps: "triceps",
  forearms: "forearms", "wrist flexors": "forearms", "wrist extensors": "forearms", "grip muscles": "forearms",
  wrists: "forearms", hands: "forearms",
  abs: "abs", abdominals: "abs", "lower abs": "abs", core: "abs",
  obliques: "obliques",
  quads: "quads", quadriceps: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
  calves: "calves", soleus: "calves",
  "hip flexors": "hip flexors",
  adductors: "adductors", groin: "adductors", "inner thighs": "adductors",
  abductors: "abductors",
  spine: "lower back", "lower back": "lower back",
  "serratus anterior": "serratus",
  "levator scapulae": "neck", sternocleidomastoid: "neck", neck: "neck",
  "cardiovascular system": null, shins: null, ankles: null, feet: null, "ankle stabilizers": null
};

export function canonicalMuscle(raw: string) {
  return muscleMap[raw.trim().toLowerCase()] ?? null;
}

const pullTargets = new Set(["lats", "upper back", "biceps", "traps", "forearms"]);
const pushTargets = new Set(["chest", "triceps", "shoulders"]);

// Heuristic, deliberately conservative: anything not clearly matched falls back to the primary
// muscle, then to "other". The AI/MCP can correct individual exercises later via upsert_exercise.
export function inferMovementPattern(name: string, primary: string[]): CatalogExercise["movementPattern"] {
  const n = name.toLowerCase();
  const target = primary[0];
  if (/carry|farmer|suitcase/.test(n)) return "carry";
  if (/lunge|split squat|step[- ]?up|step[- ]?down/.test(n)) return "lunge";
  if (/deadlift|good morning|hip thrust|romanian|kettlebell swing|hyperextension|back extension|glute bridge|pull[- ]?through|bridge/.test(n)) return "hinge";
  if (/squat|leg press|hack/.test(n)) return "squat";
  if (target && pullTargets.has(target) && /row|pull[- ]?up|chin[- ]?up|pull[- ]?down|curl|face pull|shrug|reverse fly|pullover/.test(n)) return "pull";
  if (target && pushTargets.has(target) && /press|push[- ]?up|dip|fly|flye|pushdown|extension|raise/.test(n)) return "push";
  if (target === "abs" || target === "obliques") return "core";
  if (target && pullTargets.has(target)) return "pull";
  if (target && pushTargets.has(target)) return "push";
  if (target === "quads") return "squat";
  if (target === "hamstrings" || target === "glutes" || target === "lower back") return "hinge";
  return "other";
}

function titleCase(value: string) {
  return value.replace(/(^|[\s(/-])([a-zа-я])/giu, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

export function mapDatasetExercise(row: DatasetExercise): CatalogExercise | null {
  const name = titleCase(row.name.trim().replace(/\s+/g, " "));
  if (!name) return null;
  const primaryMuscle = canonicalMuscle(row.target);
  const primaryMuscles = primaryMuscle ? [primaryMuscle] : [];
  const secondaryMuscles = [...new Set(
    (row.secondary_muscles ?? []).map(canonicalMuscle).filter((muscle): muscle is string => Boolean(muscle))
  )].filter((muscle) => !primaryMuscles.includes(muscle));
  return {
    name,
    searchAliases: [row.name.trim().toLowerCase()].filter((alias) => alias !== name.toLowerCase()),
    primaryMuscles,
    secondaryMuscles,
    movementPattern: inferMovementPattern(row.name, primaryMuscles),
    equipment: row.equipment?.trim().toLowerCase() || undefined,
    externalRef: { source: exerciseDatasetSource, id: row.id }
  };
}

// --- yuhonas/free-exercise-db (Unlicense / public domain): metadata plus two photo frames per exercise.

export interface FreeExerciseRow {
  id: string;
  name: string;
  force?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  images?: string[];
  instructions?: string[];
}

const freeEquipment: Record<string, string | undefined> = {
  "body only": "body weight",
  "e-z curl bar": "ez barbell",
  kettlebells: "kettlebell",
  bands: "band",
  other: undefined
};

/** CDN prefix for the dataset's photos, pinned to a commit so the files never change underneath us. */
export function freeExerciseImageBase(commitSha: string) {
  return `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${commitSha}/exercises/`;
}

export function mapFreeExercise(row: FreeExerciseRow, commitSha: string): CatalogExercise | null {
  const name = titleCase(row.name.trim().replace(/\s+/g, " "));
  if (!name) return null;
  const primaryMuscles = [...new Set(row.primaryMuscles.map(canonicalMuscle).filter((muscle): muscle is string => Boolean(muscle)))];
  const secondaryMuscles = [...new Set(row.secondaryMuscles.map(canonicalMuscle).filter((muscle): muscle is string => Boolean(muscle)))]
    .filter((muscle) => !primaryMuscles.includes(muscle));
  const equipment = row.equipment ? (row.equipment in freeEquipment ? freeEquipment[row.equipment] : row.equipment.toLowerCase()) : undefined;
  const base = freeExerciseImageBase(commitSha);
  return {
    name,
    searchAliases: [row.name.trim().toLowerCase()].filter((alias) => alias !== name.toLowerCase()),
    primaryMuscles,
    secondaryMuscles,
    movementPattern: inferMovementPattern(row.name, primaryMuscles),
    equipment,
    images: (row.images ?? []).slice(0, 4).map((path) => `${base}${path}`),
    instructions: (row.instructions ?? []).map((step) => step.trim()).filter(Boolean).slice(0, 20),
    externalRef: { source: freeExerciseSource, id: row.id }
  };
}
