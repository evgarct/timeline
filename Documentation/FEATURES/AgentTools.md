# Agent tools (REST, MCP, WebMCP)

One place defines every agent tool: `src/lib/agent/specs.ts` (name, title, description, zod input schema, read-only / destructive hints and an optional REST mapping). Surfaces:

- **MCP** (`src/mcp/server.ts`, endpoint `/api/mcp`, bearer token): registers the workout tools through `registerSpec(server, specs.<name>, handler)`. The other (nutrition, events, products) tools are still registered inline and move to the registry gradually.
- **REST** (`src/app/api/**`, session cookie): every spec with a `rest` mapping points at its route.
- **OpenAPI**: `GET /api/openapi.json` is generated from the registry (`src/lib/agent/openapi.ts`); it only describes operations, never data.
- **WebMCP** (page tools for a browser copilot): planned next; it will register the specs that have a REST mapping against the signed-in session and add tools that drive the live Studio UI.

Tool descriptions are the main lever for agent behaviour: edit them in `specs.ts`, not in handlers.

## Workout tools
Read: `search_exercises`, `get_exercise`, `list_exercise_filters`, `list_exercise_alternatives`, `get_exercise_history`, `list_workout_sessions` (from/to window, up to 200), `get_workout_session`, `get_muscle_volume`, `list_workout_templates`, `get_template`, `plan_workout_from_template`, `preview_template_volume`, `get_daily_activity`, `list_events` (type, from/to, offset).
Write: `upsert_exercise` (last resort), `record_workout_session`, `update_workout_session` (replaces the whole set list), `delete_workout_session` (destructive), `upsert_workout_template`, `rename_workout_template`, `duplicate_workout_template`, `delete_workout_template` (destructive).

Planning loop an agent should follow: `get_muscle_volume` + `get_exercise_history` for what the user does now → `search_exercises` / `list_exercise_alternatives` for candidates → `preview_template_volume` to check balance → `upsert_workout_template`. Review loop: `list_workout_sessions` → `get_workout_session` → `plan_workout_from_template` for what comes next.

## Conventions
- Date windows: `from`/`to` accept ISO 8601 or `YYYY-MM-DD`; a bare date is a whole UTC day (`src/lib/agent/range.ts`). An unparsable or reversed window is `invalid_date_range`.
- Tool results must carry their data in the text content (clients read only text): include ids and the fields an agent needs; test with `content[0].text`.
- Destructive tools carry `destructiveHint`; the agent must confirm with the user first.
- `GET /api/workouts` returns up to 200 sessions (`limit`), `GET /api/events` up to 500 with `offset` paging.
- The Telegram bot repo keeps its own copy of the tool list; new tools there need a manual edit.
