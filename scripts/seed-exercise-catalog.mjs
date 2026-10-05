// Seeds a user's personal exercise catalog from the MIT-licensed hasaneyldrm/exercises-dataset
// (data/exercises.json — metadata and text only; never copy its images/GIFs, they belong to Gym visual).
//
//   node scripts/seed-exercise-catalog.mjs --file <exercises.json> --user <userId>            # dry run
//   node scripts/seed-exercise-catalog.mjs --file ... --user ... --staging-host <host> --apply # staging
//   node scripts/seed-exercise-catalog.mjs --file ... --user ... --apply                      # DATABASE_URL as is
//
// Idempotent: rows are keyed by (user, "exercises-dataset", dataset id) and existing rows are left
// untouched, so user edits survive a re-run. Names that already exist for the user are skipped.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { loadEnvFile } from "./env.mjs";
import { exerciseDatasetSource, mapDatasetExercise } from "../src/domain/exercise-catalog.ts";

loadEnvFile();

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const file = option("file");
const userId = option("user");
const stagingHost = option("staging-host");
const apply = args.includes("--apply");

if (!file || !userId) {
  console.error("Usage: --file <exercises.json> --user <userId> [--staging-host <host>] [--apply]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
if (stagingHost) {
  // Neon branches share roles, so the same credentials work on a staging branch's endpoint.
  url.hostname = stagingHost;
}
console.log(`Target host: ${url.hostname}  (${apply ? "APPLY" : "dry run"})`);

const normalize = (value) => value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");

const dataset = JSON.parse(readFileSync(file, "utf8"));
const mapped = dataset.map(mapDatasetExercise).filter(Boolean);

// Disambiguate repeated names by equipment, then drop what is still ambiguous.
const seen = new Map();
for (const item of mapped) {
  const key = normalize(item.name);
  seen.set(key, (seen.get(key) ?? 0) + 1);
}
const unique = new Map();
let skippedDuplicateNames = 0;
for (const item of mapped) {
  let name = item.name;
  if (seen.get(normalize(name)) > 1 && item.equipment) name = `${item.name} (${item.equipment})`;
  const key = normalize(name);
  if (unique.has(key)) { skippedDuplicateNames += 1; continue; }
  unique.set(key, { ...item, name });
}

const sql = neon(url.toString());
const existing = await sql`select normalized_name, external_id from exercises where user_id = ${userId}`;
const existingNames = new Set(existing.map((row) => row.normalized_name));
const existingExternal = new Set(existing.filter((row) => row.external_id).map((row) => row.external_id));

const toInsert = [...unique.entries()].filter(([key, item]) => (
  !existingNames.has(key) && !existingExternal.has(item.externalRef.id)
)).map(([key, item]) => ({ key, ...item }));

console.log(`dataset rows: ${dataset.length}, mapped: ${mapped.length}, unique names: ${unique.size}`);
console.log(`already in catalog (name or dataset id): ${unique.size - toInsert.length}, skipped duplicate names: ${skippedDuplicateNames}`);
console.log(`to insert: ${toInsert.length}`);
const patterns = {};
for (const item of toInsert) patterns[item.movementPattern] = (patterns[item.movementPattern] ?? 0) + 1;
console.log("movement patterns:", JSON.stringify(patterns));
console.log("sample:", JSON.stringify(toInsert.slice(0, 3), null, 1));

if (!apply) {
  console.log("Dry run only. Pass --apply to write.");
  process.exit(0);
}

// The picker lists exercises by updated_at (newest first). Seeded rows get an old timestamp so the
// thousand dataset entries never push the user's own exercises out of the first page.
const stale = "'2000-01-01T00:00:00Z'::timestamptz";
const chunkSize = 200;
let inserted = 0;
for (let start = 0; start < toInsert.length; start += chunkSize) {
  const chunk = toInsert.slice(start, start + chunkSize);
  const params = [];
  const rows = chunk.map((item) => {
    const base = params.length;
    params.push(
      randomUUID(), userId, item.name, item.key,
      JSON.stringify(item.primaryMuscles), JSON.stringify(item.primaryMuscles), JSON.stringify(item.secondaryMuscles),
      item.movementPattern, item.equipment ?? null,
      JSON.stringify(item.searchAliases),
      item.searchAliases.length ? item.searchAliases.map(normalize).join(" | ") : null,
      exerciseDatasetSource, item.externalRef.id
    );
    const p = (offset) => `$${base + offset}`;
    return `(${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}::jsonb, ${p(6)}::jsonb, ${p(7)}::jsonb, ${p(8)}, ${p(9)}, ${p(10)}::jsonb, ${p(11)}, ${p(12)}, ${p(13)}, ${stale}, ${stale})`;
  });
  const result = await sql.query(
    `insert into exercises (id, user_id, name, normalized_name, muscle_groups, primary_muscles, secondary_muscles,
       movement_pattern, equipment, search_aliases, normalized_search_aliases, external_source, external_id,
       created_at, updated_at)
     values ${rows.join(", ")}
     on conflict (user_id, external_source, external_id) do nothing
     returning id`,
    params
  );
  inserted += result.length;
}
console.log(`inserted: ${inserted}`);
