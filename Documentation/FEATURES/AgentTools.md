# Agent tools (REST, MCP, WebMCP)

One place defines every agent tool: `src/lib/agent/specs.ts` (name, title, description, zod input schema, read-only / destructive hints and an optional REST mapping). Surfaces:

- **MCP** (`src/mcp/server.ts`, endpoint `/api/mcp`, bearer token): registers the workout tools through `registerSpec(server, specs.<name>, handler)`. The other (nutrition, events, products) tools are still registered inline and move to the registry gradually.
- **REST** (`src/app/api/**`, session cookie): every spec with a `rest` mapping points at its route.
- **OpenAPI**: `GET /api/openapi.json` is generated from the registry (`src/lib/agent/openapi.ts`); it only describes operations, never data.
- **WebMCP** (page tools for a browser copilot, `src/lib/webmcp/`, `src/components/studio/agent/`): the Studio pages register their tools with the browser while they are mounted; see "WebMCP in Studio" below.

Tool descriptions are the main lever for agent behaviour: edit them in `specs.ts`, not in handlers.

## Workout tools
Read: `search_exercises`, `get_exercise`, `list_exercise_filters`, `list_exercise_alternatives`, `get_exercise_history`, `list_workout_sessions` (from/to window, up to 200), `get_workout_session`, `get_muscle_volume`, `list_workout_templates`, `get_template`, `get_week_plan` (the Monday-first week: scheduled templates, logged sessions, status planned/done/missed/extra/free, unplanned days), `plan_workout_from_template`, `preview_template_volume`, `get_daily_activity`, `list_events` (type, from/to, offset).
Write: `upsert_exercise` (last resort), `record_workout_session`, `update_workout_session` (replaces the whole set list), `delete_workout_session` (destructive), `upsert_workout_template` (replaces the exercise list), `update_workout_template` (patch: name, note, archive flag, `schedule`, single exercises by index or exerciseId), `rename_workout_template`, `duplicate_workout_template`, `delete_workout_template` (destructive).

Result shapes: `search_exercises` returns compact items (`imageCount`, `hasVideo`, no technique steps; `get_exercise` has the full record with `videoUrl`). `upsert_exercise` merges into a match by id, externalRef or exact name (omitted fields keep their stored values) and answers whether the exercise was created or matched and which fields changed. `list_workout_templates` / `get_template` add `name`, `primaryMuscles`, `equipment`, `videoUrl` to each template exercise. `get_today` returns photo ids and `photoCount` instead of pre-signed URLs unless `includePhotoUrls` is true. Template `schedule` = `{ weekdays (0 = Sunday ... 6 = Saturday), startDate?, endDate? }`; omitting it on an upsert keeps the stored one, `null` clears it.

Planning loop an agent should follow: `get_muscle_volume` + `get_exercise_history` for what the user does now → `search_exercises` / `list_exercise_alternatives` for candidates → `preview_template_volume` to check balance → `upsert_workout_template`. Review loop: `list_workout_sessions` → `get_workout_session` → `plan_workout_from_template` for what comes next.

## WebMCP in Studio
WebMCP is a W3C Web Machine Learning CG draft: a page registers tools (`registerTool({ name, description, inputSchema, execute, annotations })`) that a browser agent (Chrome with the feature, a browser extension, a copilot) can call, with the human watching the same page. The entry point has moved between drafts (`navigator.modelContext` early, `document.modelContext` in the draft of October 2026), so `getModelContext()` probes both and does nothing when neither exists. Registration is withdrawn by aborting a shared `AbortSignal` (`unregisterTool` is a fallback).

Enable it: Chrome 149+ origin trial (set `NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN` to the token registered for the origin; the Studio layout renders the `origin-trial` meta tag), or locally `chrome://flags/#enable-webmcp-testing`. The Model Context Tool Inspector extension lists and runs the tools.

Tools follow the page (registered on mount, withdrawn on unmount):
- **Every Studio page:** `studio_get_context` (page, locale, theme, unsaved changes), `studio_navigate` (dashboard, templates, new template, a template; asks the human when the builder has unsaved changes) and the **REST bridge**: every spec in `src/lib/agent/specs.ts` with a `rest` mapping (search, templates, sessions, volume, history, alternatives, preview...) is registered as a tool that calls the same route with the session cookie. Destructive ones (delete template/session) ask the human first.
- **Builder:** `builder_get_draft`, `builder_set_name`, `builder_add_exercise`, `builder_create_exercise`, `builder_remove_exercise`, `builder_move_exercise`, `builder_update_exercise`, `builder_link_superset`, `builder_undo`, `builder_redo`, `builder_save`. They drive the same external store as the UI (`builder-store.ts`), so every change animates on screen, and each answer returns the draft (including sets per muscle) so the agent sees the consequence.
- **Dashboard:** `dashboard_get_view` (exactly what is shown), `dashboard_select_week`, `dashboard_select_exercise`.

Human in the loop: the Studio shell renders an "Agent" chip with the history of what the copilot did and an "agent changes data without asking" switch (off by default, stored in localStorage). While it is off, `builder_save` and every bridged tool that changes data (not reads, not `send_feedback`) open an approval dialog; destructive tools always do; the touched builder card glows. A second question while one is open is declined.

Results are plain JSON-serializable objects (the draft says `executeTool` resolves to their JSON); expected refusals come back as `{ ok: false, error, message }` (`ToolError`), results over 60,000 characters as `result_too_large`. If a browser build expects a different result envelope, change `run()` in `src/lib/webmcp/model-context.ts` only.

Calling convention in the October 2026 draft: tools are reached through `document.modelContext` (early builds: `navigator.modelContext`); a page-side caller runs `executeTool(toolObject, jsonString)` with the arguments as a JSON string. Calling the tool object's `execute` directly from page JavaScript skips the approval dialog's page context, so treat the dialog, not the call path, as the guard.

Tests: unit tests with a fake `modelContext` (both entry points, abort, errors), the bridge request mapping, builder tools against a real store, and Playwright (`e2e/studio-agent.spec.ts`) with an init script that stands in for a WebMCP browser.

## Feedback from agents
Agents report how the tools worked for them through `send_feedback` (MCP, WebMCP and `POST /api/feedback`); nothing is delivered anywhere, entries are stored in `agent_feedback` (migration 0015) and read when the tools are worked on.
- **Fields:** `category` (`bug`, `friction`, `missing_tool`, `works_well`, `suggestion`, `other`), optional `severity` (`low|medium|high`), `tool`, `summary` (≤200), `details`, `expected`, `suggestion`, `toolCalls` (`[{tool, outcome: ok|error|confusing, note}]`), `client` (self-reported agent name; for MCP the User-Agent header is used when it is omitted). `source` (`mcp|webmcp|rest`) and `page` are set by the transport, never taken from the body: MCP sets `mcp`, the WebMCP bridge sends the `x-form-source` / `x-form-page` headers from the page (`augmentHeaders`), a plain REST call is `rest`.
- **Limits:** the same summary about the same tool on the same UTC day is one entry (`duplicate`; a unique index on `(user_id, dedupe_key)` enforces it under concurrent retries); about 30 entries per hour per user (`rate_limited`, HTTP 429; a soft limit, a burst of parallel requests can overshoot slightly). `GET /api/feedback/counts` returns `{ new, total }` for the badge.
- **Privacy:** the tool description tells agents to paraphrase instead of pasting secrets, personal health data or photos.
- **Reading:** `list_feedback` (MCP/WebMCP/`GET /api/feedback`, filters `status|category|tool|limit`), the Studio inbox at `/studio/feedback` (status chips, resolution note, a badge in the navigation counts `new` entries), and `update_feedback` / `PUT /api/feedback/{id}` to triage (`new → triaged → done | wontfix` with a resolution note).
- The MCP server's `instructions` ask agents to call `send_feedback` when something failed, was unclear or worked especially well; the Hub exposes the same tools as `form_send_feedback` and friends.
- **Working rule (see AGENTS.md):** before changing MCP/REST tools, Studio or agent UX, read open entries with `list_feedback` and propose fixes for the related ones; a PR that fixes an entry marks it `done` with the PR in the resolution.

## Conventions
- Date windows: `from`/`to` accept ISO 8601 or `YYYY-MM-DD`; a bare date is a whole UTC day (`src/lib/agent/range.ts`). An unparsable or reversed window is `invalid_date_range`.
- Tool results must carry their data in the text content (clients read only text): include ids and the fields an agent needs; test with `content[0].text`.
- Destructive tools carry `destructiveHint`; the agent must confirm with the user first.
- `GET /api/workouts` returns up to 200 sessions (`limit`), `GET /api/events` up to 500 with `offset` paging.
- The Telegram bot repo keeps its own copy of the tool list; new tools there need a manual edit.
