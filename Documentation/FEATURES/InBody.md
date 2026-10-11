# InBody body composition

## Purpose

An InBody test is a Timeline event (`type: "inbody"`): the test date and time, every reading printed on the sheet, and the original file. The coach (a human or an agent) can see exactly what the sheet said, how each number moved since the previous test, and what the owner did in between: diet, steps, training, progress photos and tape measurements.

## Data model

No dedicated table: the event keeps `occurredAt` (the test date and time printed on the sheet, never the upload date), `timezone`, `note` and a `payload` jsonb (`src/domain/events.ts`).

- `source`: `{ assetId, mimeType, fileName }`, the private original in R2 (`media_assets.kind = inbody`). The original is stored byte for byte (PDF, JPEG, PNG, HEIC, HEIF); only asset ids and object keys are persisted, never signed URLs.
- `report` (optional): the printed header, `{ device, testId, heightCm, ageYears, gender }`.
- `extraction`: `{ method: mcp_agent | local_ocr | manual, reviewed }`. An agent saves `reviewed: false` until the owner confirmed the numbers.
- `metrics[]`: one entry per reading, `{ key, value, unit, label, category, referenceMin?, referenceMax?, evaluation?, segment?, frequencyKhz? }`. A reading is identified by `key` + `segment` + `frequencyKhz`; duplicates are rejected.

### Metric catalog (`src/domain/inbody-catalog.ts`)

Agents send `key` + `value` (+ range, evaluation, segment, frequency); label, unit and category are filled from the catalog when the event is parsed, so every path (REST, MCP, repository) normalizes identically. Unknown keys are kept under category `other`.

| Category | Keys |
| --- | --- |
| composition | `total_body_water`, `protein`, `minerals`, `body_fat_mass`, `weight`, `skeletal_muscle_mass` |
| obesity | `bmi`, `percent_body_fat`, `waist_hip_ratio`, `visceral_fat_level` |
| control | `target_weight`, `weight_control`, `fat_control`, `muscle_control` |
| research | `fat_free_mass`, `basal_metabolic_rate`, `obesity_degree`, `smi`, `recommended_calorie_intake` |
| segmental_lean / segmental_fat | `lean_mass_kg`, `lean_mass_pct`, `fat_mass_kg`, `fat_mass_pct`, each with `segment` (`left_arm`, `right_arm`, `trunk`, `left_leg`, `right_leg`) |
| impedance | `impedance_ohm` with `segment` and `frequencyKhz` (20 or 100) |
| exercise | `exercise_kcal_<activity>`, the 30-minute calorie table (20 activities) |
| other | `inbody_score` |

`referenceMin` / `referenceMax` are the normal range printed in brackets; `evaluation` (`under|normal|over`) is the sheet's own verdict for segmental readings, BMI and PBF. The interface shows ranges and verdicts but never colours a change as good or bad.

## Agent flow

1. `create_inbody_upload` (MCP/WebMCP, `POST /api/uploads/agent-link/inbody`) reserves an asset and returns a one-time `uploadUrl` (15 minutes, no cookies, same HMAC token as the photo upload).
2. POST the original bytes (at most 4 MB, the Vercel body limit) to `uploadUrl`. `ingestAgentUpload` sniffs the type from the magic bytes (`unsupported_file` otherwise, HTTP 415), stores the bytes untouched and records the sniffed mime type on the asset (the event validator requires `source.mimeType` to match).
3. `create_event` `{ type: "inbody", id, occurredAt, timezone, source: { assetId, mimeType, fileName }, metrics, report, extraction }`; a stable `id` makes a retry idempotent.

The write contract matches the photo upload: validation before the claim, an atomic lease on the pending asset, release on failure.

## Reading tools

- `get_body_composition` (`GET /api/body/inbody?from&to&metrics&timezone`): tests oldest first with `deltaFromPrevious` / `deltaFromFirst` per reading, and per test the interval since the previous one: days, diet (days logged, average kcal and macros per logged day, from `nutrition_entry` events), average steps (`daily_activity`), workouts (count, sets, tonnage), progress photos between the tests and up to 7 days after, and the nearest tape measurements within 14 days. `metrics` is a comma list of keys or `all`; the default is the trend set. The pure builder is `src/domain/body-composition.ts`, the loader `src/data/body-composition.ts`.
- `get_event` returns a grouped, compact text of every reading (the generic JSON repeats label, unit and category on about 150 readings); `list_events` and `get_today` carry a headline line.
- `get_inbody_original` (`GET /api/body/inbody/{eventId}/original`) returns a download link valid about an hour, never stored.

## Surfaces

- Today / Timeline row: headline numbers (score, weight, muscle, body fat).
- Event page (`/events/{id}`): key numbers with the change since the previous test, every printed section with its normal-range bar, the five-segment lean and fat grids, the impedance table, the 30-minute calorie table (folded) and the original (`/api/media/{assetId}?inline=1`).
- Studio "Body" (`/studio/body`): metric chips, a trend chart across tests, every test with headline numbers and the interval context. WebMCP tools `body_get_view` and `body_select_metric`.
- Android: the Timeline/Today InBody card shows the headline numbers with the change since the previous test; a tap opens `InBodyDetailSheet` (key numbers, a trend chart across tests, the interval context from `GET /api/body/inbody`, every printed section with ranges, segment grids, impedance, and the original, downloaded through the session cookie into the cache and opened with `FileProvider`). Readings come from the events already loaded for the timeline; strings exist in en and ru, readings without a translation keep the backend label.

## Privacy

Originals and the numbers are medical data: private R2 object keys, authenticated streaming for the owner, no real sheets in `public/`, tests or Storybook (demo data is generated by `src/data/seed-inbody.ts`).
