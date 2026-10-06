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

## Templates and progression
- `workout_templates`: one jsonb document per routine. Each exercise carries `sets`, `repMin`/`repMax`, `targetRir` (0–5), `groupId` (same value = superset) and an optional `progression` rule. Names are unique per user (normalized); upsert by id, else by exact name; every `exerciseId` must exist (`unknown_exercise`, HTTP 422).
- Progression is double progression only: keep the weight until every set at the top weight reaches `repMax`, then add `incrementKg` (`suggestNextLoad` in `src/domain/workout-templates.ts`). It never suggests a drop and never invents a load without history; deloads stay the lifter's call.
- REST: `GET/POST /api/templates`, `GET/PUT/DELETE /api/templates/{id}`, `GET /api/templates/{id}/plan` (prescription + last session's sets + suggested load; read-only).
- MCP: `list_workout_templates`, `upsert_workout_template`, `delete_workout_template`, `plan_workout_from_template`. Building a program in chat = `search_exercises`/`upsert_exercise` → `upsert_workout_template` → `plan_workout_from_template` → `record_workout_session`.

## Talking to the AI (MCP)
Beyond the tools above: `list_workout_sessions` (recent logged sessions with sets, difficulty, mood, notes) and `rename_workout_template` (name only). A named plan such as "Mon 5.10" lives in `list_workout_templates`; logged sessions are separate. Every tool answers with readable text that includes ids and data (Claude clients ignore `structuredContent`), and a client only sees new tools after it reconnects the Form connector or starts a new chat.

## Volume analytics
- `GET /api/workouts/volume?weeks=4&timezone=` and MCP `get_muscle_volume`: hard sets per muscle per calendar week (Monday start in the given timezone), newest first. Primary muscle = 1 set, secondary = 0.5, warm-ups excluded; legacy exercises fall back to `muscleGroups`; exercises with no muscle data count under `other`.
- The Train tab shows this week's sets per muscle with a tick for last week. It is a neutral fact display (no goals, colours or streaks, per `docs/DESIGN.md`); the 10–20 sets/week reference lives only in the MCP tool description for planning.
- UI languages: Android ships `values` (en), `values-ru` and `values-cs`; new strings are written in en + ru only (Russian is enough, Czech falls back to en).

## Android (Train tab)
- Timeline: logged `workout` events appear as a row (date formatted in the event's own timezone, localized muscle names). The row carries no sets; open the Train tab for them.
- `ui/workout/`: `WorkoutScreen` (start + recent history + active session), `ExercisePickerSheet` (debounced catalog search, create on the fly), `WorkoutViewModel`.
- Active session screen (`ActiveWorkout.kt`): header (date, workout/template name, timer, ⋮ for save-as-template/discard), one card per exercise in the app's own style, pinned "Finish workout" button leading to the feedback sheet. Each card has a single tile with the exercise photo and the muscle map side by side (tap enlarges both; no muscle text), a check that completes every set of the exercise, and a table "Before (date) | kg | reps | ✓". Weight and reps are prefilled (last session's reps per set, else the bottom of the rep range; suggested weight), so a workout done as planned is just ticking. There is no "add set" button. Exercise note comes from the ⋮ menu and is stored as the note of the exercise's first recorded set. Consecutive exercises with one `groupId` sit in one container with a tab (`groupLabel`, default "Superset"). Photos are preloaded into Coil's cache when the workout starts.
- Per-set details: RIR (menu behind the set number cycles –,4,3,2,1,0, not shown on the card), set type via the set number (working, warm-up, drop, remove), superset link from the exercise menu. There is deliberately no rest timer and no rest field: the owner does not want rest tracking in the app. Last top weight and best e1RM are prefilled from `/api/exercises/{id}/history`.
- Offline model (online + cache, no Room): the draft is written to `WorkoutDraftStore` after every edit and survives process death. Finishing first moves the session into a durable pending queue (idempotency key `android-workout:<draftId>`), then uploads; on failure `WorkoutSyncWorker` retries with backoff when a connection exists. Set indexes run across the whole session so the server keeps exercise order.
- Visual QA without a login: `WorkoutScreenshotTest` (androidTest) seeds a fixture draft and writes PNGs to the app's external files dir (`adb pull /sdcard/Android/data/com.evgarct.form/files/workout-qa`). Run it with `adb shell am instrument` — `connectedAndroidTest` uninstalls the app and deletes the files.

- Templates on Android: the Train tab lists templates; tapping one loads `/api/templates/{id}/plan` and builds the draft (prescribed set count, suggested weight prefilled, last-time sets, superset groups kept). The exercise card shows the target ("3 × 6–10 · RIR 2") and the suggestion. "Save as template" turns the current draft into a template: a prescription that came from a template is kept, for ad-hoc exercises the rep range is derived from the logged sets and warm-ups are not counted. There is no in-app template editor yet — edit prescriptions and progression rules through MCP.

## Open decisions / not yet built
Production catalog seed (see below), templates and prescriptions, progression rules and mesocycles, analytics (weekly sets per muscle, muscle map), optional Health Connect write of finished sessions.
- Exercise catalog source: `yuhonas/free-exercise-db` (Unlicense / public domain; ~876 exercises with muscles, equipment and two photo frames each). Seed with `node scripts/seed-exercise-catalog.mjs --source free-exercise-db --sha <dataset commit> --file <dist/exercises.json> --user <id> [--remove-unused-source exercises-dataset] [--staging-host <host>] [--apply]` (dry run by default, idempotent, mapping in `src/domain/exercise-catalog.ts`). Photos are not copied: `exercises.images` holds jsDelivr URLs pinned to the dataset commit (production seeded 2026-10-06 at `f00c92c7…`). The earlier `hasaneyldrm/exercises-dataset` seed (MIT metadata, English names, no pictures; its media belongs to Gym visual and is never used) was replaced on staging and production by removing only its unreferenced rows. Seeded rows get `updated_at = 2000-01-01` so the owner's own exercises stay first in the picker; remove them with `delete from exercises where external_source = 'free-exercise-db'` (check `workout_sets`/templates first). The upstream photos are declared public domain by their authors; we have not independently verified their origin.
- `exercises.images` (migration 0013): up to 4 absolute https URLs, accepted by `upsert_exercise` (MCP) and the exercises API. A template's plan returns each exercise's `images`, `secondaryMuscles`, `equipment`, `lastDate` (date of the last logged session) and `lastSets`; `groupLabel` on a template exercise names its superset tab. `GET /api/exercises/{id}/history` also returns `lastSession` for exercises added by hand.
- `exercises.instructions` (migration 0014): ordered technique steps (max 20, 600 chars each), accepted by `upsert_exercise` and the exercises API and returned in a template's plan. The catalog's English steps come from free-exercise-db (`node scripts/seed-exercise-catalog.mjs --source free-exercise-db ... --apply` backfills rows whose `instructions` is still empty and never overwrites existing text); the owner's own exercises carry Russian steps written by hand. The Android sheet behind the exercise tile shows photos, the numbered steps, then the muscle map.
- Theme gotcha: `formTypography(colorScheme)` must receive the scheme explicitly — read inside `FormTheme` before `MaterialTheme` exists, `MaterialTheme.colorScheme` is the default light scheme and baked dark text into every style (invisible menu/text-field text in the dark theme). Dropdown items use `formMenuItemColors()`.
- Exercise database for agents (MCP): `search_exercises` (words in any order; filters `muscle` = primary muscle id, `equipment`, `movementPattern`; each result line shows muscles, equipment, pattern and id), `get_exercise` (numbered technique steps, aliases, photo URLs) and `list_exercise_filters` (valid filter values with counts). Agents must build templates and sessions from these ids; `upsert_exercise` is a last resort when nothing fits. The same filters exist on `GET /api/exercises?muscle=&equipment=&movementPattern=`. A connector must be reconnected (or a new chat started) before a client sees new tools.
