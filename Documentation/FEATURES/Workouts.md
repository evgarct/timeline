# Workouts (strength training builder)

Source of truth for the strength-training model. Product intent comes from the Anqui note "Form: билдер силовых тренировок" (2026-10-05): build the builder inside Form in three layers.

## Layers
1. **Catalog** — `exercises`: name, aliases, `primaryMuscles` / `secondaryMuscles` (canonical lowercase names), `movementPattern` (squat, hinge, push, pull, lunge, carry, core, other), `equipment`, `isArchived`. Legacy `muscleGroups` is kept and backfilled into `primaryMuscles`.
2. **Plan** (next iterations) — mesocycle → weeks → days → slots with prescription (sets, rep range, target RIR) and a progression rule. Not implemented yet.
3. **Analytics** (next iterations) — weekly sets per muscle (primary 1, secondary 0.5), e1RM, RIR as a fatigue signal, muscle map.

## Data model
- A session is one `workout` timeline event plus `workout_sets` rows (FK to `events`, `on delete cascade`).
- A set: `exerciseId`, `setIndex`, `reps`, `weightKg`, `completed`, `rir` (0–5), `setType` (`working` | `warmup` | `drop`), `groupId` (same value = superset), `note`.
- Warm-up sets are excluded from tonnage, best set and e1RM.
- e1RM is Epley (`w * (1 + reps/30)`) for 1–12 reps; dates in history use the session's own timezone.

## REST (Android and web clients)
- `GET/POST /api/exercises`, `GET/PUT /api/exercises/{id}` (PUT also archives), `GET /api/exercises/{id}/history`
- `GET /api/workouts?date=&timezone=`, `POST /api/workouts` (idempotent on `idempotencyKey`; unknown exercise → 422)
- `GET/PUT/DELETE /api/workouts/{eventId}` (PUT replaces the whole set list atomically)

## MCP
`search_exercises`, `upsert_exercise`, `record_workout_session`, `get_exercise_history` expose the same fields. Tool descriptions in `src/mcp/server.ts` are the steering lever. The telegram-bot repo keeps a hand-maintained copy of the tool list and must be updated separately.

## Open decisions / not yet built
Catalog seed from the MIT `hasaneyldrm/exercises-dataset` (metadata and text only, no images), templates and prescriptions, progression rules and mesocycles, analytics, Android UI.
