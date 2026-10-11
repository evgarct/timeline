# Agent tools (REST, MCP, WebMCP)

One place defines every agent tool: `src/lib/agent/specs.ts` (name, title, description, zod input schema, read-only / destructive hints and an optional REST mapping). Surfaces:

- **MCP** (`src/mcp/server.ts`, endpoint `/api/mcp`, bearer token): registers the workout tools through `registerSpec(server, specs.<name>, handler)`. The other (nutrition, events, products) tools are still registered inline and move to the registry gradually.
- **REST** (`src/app/api/**`, session cookie): every spec with a `rest` mapping points at its route.
- **OpenAPI**: `GET /api/openapi.json` is generated from the registry (`src/lib/agent/openapi.ts`); it only describes operations, never data.
- **WebMCP** (page tools for a browser copilot, `src/lib/webmcp/`, `src/components/studio/agent/`): the Studio pages register their tools with the browser while they are mounted; see "WebMCP in Studio" below.

Tool descriptions are the main lever for agent behaviour: edit them in `specs.ts`, not in handlers.

## Workout tools
Read: `search_exercises`, `get_exercise`, `list_exercise_filters`, `list_exercise_alternatives`, `get_exercise_history`, `list_workout_sessions` (from/to window, up to 200), `get_workout_session`, `get_muscle_volume`, `list_workout_templates`, `get_template`, `plan_workout_from_template`, `preview_template_volume`, `get_daily_activity`, `list_events` (type, from/to, offset).
Write: `upsert_exercise` (last resort), `record_workout_session`, `update_workout_session` (replaces the whole set list), `delete_workout_session` (destructive), `upsert_workout_template`, `rename_workout_template`, `duplicate_workout_template`, `delete_workout_template` (destructive).

Planning loop an agent should follow: `get_muscle_volume` + `get_exercise_history` for what the user does now → `search_exercises` / `list_exercise_alternatives` for candidates → `preview_template_volume` to check balance → `upsert_workout_template`. Review loop: `list_workout_sessions` → `get_workout_session` → `plan_workout_from_template` for what comes next.

## WebMCP in Studio
WebMCP is a W3C Web Machine Learning CG draft: a page registers tools (`registerTool({ name, description, inputSchema, execute, annotations })`) that a browser agent (Chrome with the feature, a browser extension, a copilot) can call, with the human watching the same page. The entry point has moved between drafts (`navigator.modelContext` early, `document.modelContext` in the draft of October 2026), so `getModelContext()` probes both and does nothing when neither exists. Registration is withdrawn by aborting a shared `AbortSignal` (`unregisterTool` is a fallback).

Enable it: Chrome 149+ origin trial (set `NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN` to the token registered for the origin; the Studio layout renders the `origin-trial` meta tag), or locally `chrome://flags/#enable-webmcp-testing`. The Model Context Tool Inspector extension lists and runs the tools.

Tools follow the page (registered on mount, withdrawn on unmount):
- **Every Studio page:** `studio_get_context` (page, locale, theme, unsaved changes), `studio_navigate` (dashboard, templates, new template, a template; asks the human when the builder has unsaved changes) and the **REST bridge**: every spec in `src/lib/agent/specs.ts` with a `rest` mapping (search, templates, sessions, volume, history, alternatives, preview...) is registered as a tool that calls the same route with the session cookie. Destructive ones (delete template/session) ask the human first.
- **Builder:** `builder_get_draft`, `builder_set_name`, `builder_add_exercise`, `builder_create_exercise`, `builder_remove_exercise`, `builder_move_exercise`, `builder_update_exercise`, `builder_link_superset`, `builder_undo`, `builder_redo`, `builder_save`. They drive the same external store as the UI (`builder-store.ts`), so every change animates on screen, and each answer returns the draft (including sets per muscle) so the agent sees the consequence.
- **Dashboard:** `dashboard_get_view` (exactly what is shown), `dashboard_select_week`, `dashboard_select_exercise`.

Human in the loop: the Studio shell renders an "Agent" chip with the history of what the copilot did and a "save without asking" switch (off by default, stored in localStorage); `builder_save` and destructive tools open an approval dialog; the touched builder card glows. A second question while one is open is declined.

Results are plain JSON-serializable objects (the draft says `executeTool` resolves to their JSON); expected refusals come back as `{ ok: false, error, message }` (`ToolError`), results over 60,000 characters as `result_too_large`. If a browser build expects a different result envelope, change `run()` in `src/lib/webmcp/model-context.ts` only.

Tests: unit tests with a fake `modelContext` (both entry points, abort, errors), the bridge request mapping, builder tools against a real store, and Playwright (`e2e/studio-agent.spec.ts`) with an init script that stands in for a WebMCP browser.

## Conventions
- Date windows: `from`/`to` accept ISO 8601 or `YYYY-MM-DD`; a bare date is a whole UTC day (`src/lib/agent/range.ts`). An unparsable or reversed window is `invalid_date_range`.
- Tool results must carry their data in the text content (clients read only text): include ids and the fields an agent needs; test with `content[0].text`.
- Destructive tools carry `destructiveHint`; the agent must confirm with the user first.
- `GET /api/workouts` returns up to 200 sessions (`limit`), `GET /api/events` up to 500 with `offset` paging.
- The Telegram bot repo keeps its own copy of the tool list; new tools there need a manual edit.
