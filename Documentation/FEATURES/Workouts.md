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

## Android (Train tab)
- `ui/workout/`: `WorkoutScreen` (start + recent history + active session), `ExercisePickerSheet` (debounced catalog search, create on the fly), `WorkoutViewModel`.
- Active session: weight, reps, RIR (tap cycles –,4,3,2,1,0), set type via the set number (working, warm-up, drop, remove), superset link from the exercise menu, rest timer (90 s, ±15 s) started when a working set is marked done. Last top weight and best e1RM are prefilled from `/api/exercises/{id}/history`.
- Offline model (online + cache, no Room): the draft is written to `WorkoutDraftStore` after every edit and survives process death. Finishing first moves the session into a durable pending queue (idempotency key `android-workout:<draftId>`), then uploads; on failure `WorkoutSyncWorker` retries with backoff when a connection exists. Set indexes run across the whole session so the server keeps exercise order.
- Visual QA without a login: `WorkoutScreenshotTest` (androidTest) seeds a fixture draft and writes PNGs to the app's external files dir (`adb pull /sdcard/Android/data/com.evgarct.form/files/workout-qa`). Run it with `adb shell am instrument` — `connectedAndroidTest` uninstalls the app and deletes the files.

## Open decisions / not yet built
Production catalog seed (see below), templates and prescriptions, progression rules and mesocycles, analytics (weekly sets per muscle, muscle map), a Timeline row for workout events on Android, optional Health Connect write of finished sessions.
- Catalog seed: `node scripts/seed-exercise-catalog.mjs --file <exercises.json> --user <id> [--staging-host <host>] [--apply]` (dry run by default, idempotent; mapping in `src/domain/exercise-catalog.ts`). Source is the MIT data of hasaneyldrm/exercises-dataset; its media belongs to Gym visual and is never imported. Seeded on staging branch `staging-workouts-0011`; production seed is deliberately not run yet (dataset names are English while the owner's own catalog is Russian).
