import { z } from "zod";
import { eventTypeSchema } from "@/domain/events";
import { feedbackCategorySchema, feedbackInputSchema, feedbackStatusSchema } from "@/domain/feedback";
import { exerciseInputSchema, movementPatterns, setInputSchema } from "@/domain/exercises";
import { templatePatchSchema, workoutTemplateInputSchema } from "@/domain/workout-templates";

/**
 * One definition per agent tool, shared by every surface: the MCP server registers from it, the WebMCP bridge
 * registers the ones with a `rest` mapping against the REST API, and /api/openapi.json is generated from it.
 * Names, descriptions and input schemas live here and nowhere else.
 */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

export interface ToolRest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path with {param} placeholders filled from input fields of the same name. */
  path: string;
  /** Input fields sent as query parameters (GET/DELETE); everything else not in the path goes in the JSON body. */
  query?: string[];
  /** The REST body is the value of this input field (MCP wraps it as { exercise: ... }), not the whole input. */
  unwrap?: string;
}

export interface ToolSpec<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject<Shape>;
  annotations: ToolAnnotations;
  rest?: ToolRest;
}

const idempotent = { idempotentHint: true } as const;
const readOnly = { readOnlyHint: true } as const;

const meta: Record<string, Pick<ToolSpec, "annotations" | "rest">> = {
  search_exercises: { annotations: readOnly, rest: { method: "GET", path: "/api/exercises", query: ["query", "muscle", "equipment", "movementPattern", "page", "pageSize"] } },
  get_exercise: { annotations: readOnly, rest: { method: "GET", path: "/api/exercises/{exerciseId}" } },
  list_exercise_filters: { annotations: readOnly, rest: { method: "GET", path: "/api/exercises/facets" } },
  upsert_exercise: { annotations: { ...idempotent }, rest: { method: "POST", path: "/api/exercises", unwrap: "exercise" } },
  record_workout_session: { annotations: {}, rest: { method: "POST", path: "/api/workouts" } },
  rename_workout_template: { annotations: { ...idempotent } },
  list_workout_sessions: { annotations: readOnly, rest: { method: "GET", path: "/api/workouts", query: ["limit", "from", "to"] } },
  get_muscle_volume: { annotations: readOnly, rest: { method: "GET", path: "/api/workouts/volume", query: ["weeks", "timezone"] } },
  list_workout_templates: { annotations: readOnly, rest: { method: "GET", path: "/api/templates", query: ["includeArchived"] } },
  upsert_workout_template: { annotations: { ...idempotent }, rest: { method: "POST", path: "/api/templates", unwrap: "template" } },
  delete_workout_template: { annotations: { destructiveHint: true }, rest: { method: "DELETE", path: "/api/templates/{id}" } },
  plan_workout_from_template: { annotations: readOnly, rest: { method: "GET", path: "/api/templates/{id}/plan" } },
  get_exercise_history: { annotations: readOnly, rest: { method: "GET", path: "/api/exercises/{exerciseId}/history", query: ["limit"] } },
  get_template: { annotations: readOnly, rest: { method: "GET", path: "/api/templates/{id}" } },
  get_workout_session: { annotations: readOnly, rest: { method: "GET", path: "/api/workouts/{eventId}" } },
  update_workout_session: { annotations: { ...idempotent }, rest: { method: "PUT", path: "/api/workouts/{eventId}" } },
  delete_workout_session: { annotations: { destructiveHint: true }, rest: { method: "DELETE", path: "/api/workouts/{eventId}" } },
  get_daily_activity: { annotations: readOnly, rest: { method: "GET", path: "/api/activity/daily", query: ["from", "to"] } },
  list_events: { annotations: readOnly, rest: { method: "GET", path: "/api/events", query: ["limit", "offset", "type", "from", "to"] } },
  duplicate_workout_template: { annotations: {}, rest: { method: "POST", path: "/api/templates/{id}/duplicate" } },
  list_exercise_alternatives: { annotations: readOnly, rest: { method: "GET", path: "/api/exercises/{exerciseId}/alternatives", query: ["equipment", "limit"] } },
  preview_template_volume: { annotations: readOnly, rest: { method: "POST", path: "/api/templates/preview-volume" } },
  update_workout_template: { annotations: { ...idempotent }, rest: { method: "PATCH", path: "/api/templates/{id}" } },
  get_week_plan: { annotations: readOnly, rest: { method: "GET", path: "/api/schedule/week", query: ["start", "timezone"] } },
  send_feedback: { annotations: {}, rest: { method: "POST", path: "/api/feedback" } },
  list_feedback: { annotations: readOnly, rest: { method: "GET", path: "/api/feedback", query: ["status", "category", "tool", "limit"] } },
  update_feedback: { annotations: { ...idempotent }, rest: { method: "PUT", path: "/api/feedback/{id}" } }
};

function spec<Shape extends z.ZodRawShape>(definition: Omit<ToolSpec<Shape>, "annotations" | "rest">): ToolSpec<Shape> {
  const registered = meta[definition.name];
  return { ...definition, annotations: registered?.annotations ?? {}, rest: registered?.rest };
}

const sessionFields = {
  occurredAt: z.string().describe("ISO 8601 date-time, e.g. 2026-09-19T18:00:00Z"),
  timezone: z.string().min(1),
  muscleGroups: z.array(z.string().min(1)).min(1).max(8),
  note: z.string().max(2000).optional().describe("Free-text feedback on how the session went"),
  exertion: z.number().int().min(1).max(5).optional().describe("Perceived difficulty of the whole session, 1 (very easy) to 5 (very hard)"),
  mood: z.enum(["bad", "ok", "good"]).optional().describe("How the owner felt: bad, ok or good"),
  sets: z.array(setInputSchema).min(1)
};

export const specs = {
  search_exercises: spec({
    name: "search_exercises",
    title: "Search the exercise database",
    description: "Search the ready exercise database (about 880 exercises from the open free-exercise-db, each with muscles, equipment, movement pattern, two photos and step-by-step technique) plus the user's own additions. THIS IS THE SOURCE FOR BUILDING WORKOUTS: pick exercises from here and use their ids in upsert_workout_template / record_workout_session; do not create new exercises (upsert_exercise) unless nothing fits. query is matched word by word in any order against names and aliases (English names, plus the owner's own wording such as Russian aliases), e.g. \"incline press\"; leave it empty to browse by filter. Filters (all optional, combined with AND): muscle = canonical PRIMARY muscle id, equipment, movementPattern — call list_exercise_filters for the valid values. Each result line shows primary/secondary muscles, equipment, pattern and the id. Results are compact (no technique steps or photos; imageCount and hasVideo say whether they exist): call get_exercise for the technique, photos and video link.",
    input: z.object({
    query: z.string().default(""),
    muscle: z.string().optional().describe("Primary muscle id, e.g. chest, quads, lats, shoulders, abs (see list_exercise_filters)"),
    equipment: z.string().optional().describe("e.g. barbell, dumbbell, cable, machine, body weight (see list_exercise_filters)"),
    movementPattern: z.enum(movementPatterns).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(30)
  })
  }),
  get_exercise: spec({
    name: "get_exercise",
    title: "Get one exercise with technique",
    description: "Full detail of one exercise from the database: muscles, equipment, movement pattern, numbered technique steps, photo URLs and the video link (videoUrl) when there is one. Use it to explain how to perform an exercise or to choose between candidates from search_exercises.",
    input: z.object({ exerciseId: z.string().uuid() })
  }),
  list_exercise_filters: spec({
    name: "list_exercise_filters",
    title: "List exercise database filters",
    description: "The vocabulary for search_exercises filters with counts: primary muscles, equipment types and movement patterns that exist in the exercise database. Call once before filtering so muscle/equipment values match exactly.",
    input: z.object({})
  }),
  upsert_exercise: spec({
    name: "upsert_exercise",
    title: "Create or update a personal exercise",
    description: "Last resort: only use this when search_exercises found nothing suitable in the ready exercise database (the owner does not want exercises hand-created each time). Save an exercise to the user's personal catalog, avoiding duplicates: an explicit id updates that exercise; otherwise an exact externalRef match (a stable id from a source like \"trainero\") is reused if present, else an exact normalized-name match is reused, else a new exercise is created. An ambiguous_exercise error means more than one existing exercise matched by exact name — resolve it with search_exercises and pass an explicit id instead of retrying blindly. Fill primaryMuscles/secondaryMuscles with lowercase canonical muscle names (e.g. chest, back, quads, hamstrings, glutes, shoulders, biceps, triceps, calves, abs), movementPattern (squat|hinge|push|pull|lunge|carry|core|other) and equipment when known — weekly per-muscle volume is computed from them (primary sets count 1, secondary 0.5). Set isArchived: true to hide an exercise from search instead of deleting it (history is kept). Pass images (up to 4 absolute https URLs, e.g. the two frames of an exercise photo) to show a picture of the exercise in the app. An optional videoUrl (a YouTube link) is shown with the exercise in the app and in Studio. A call that matches an existing exercise (by id, externalRef or exact name) is a MERGE: every field you do not send keeps its stored value (photos, technique, aliases, archived flag), and the result says whether the exercise was created or matched and which fields changed.",
    input: z.object({ exercise: exerciseInputSchema })
  }),
  record_workout_session: spec({
    name: "record_workout_session",
    title: "Record a workout session",
    description: "Record one completed workout: creates a \"workout\" timeline event plus its per-set detail rows (exercise, set index, reps, weight in kg) in one call. Every set's exerciseId must already exist (otherwise unknown_exercise) — call search_exercises/upsert_exercise first for each exercise. Per set you can also record rir (reps in reserve, 0-5), setType (working|warmup|drop; warm-ups are excluded from tonnage and bests), groupId (same value on sets of one superset) and a short note. Reuse the same idempotencyKey when retrying to avoid double-recording; a retry returns the originally stored session.",
    input: z.object({
    occurredAt: z.string().describe("ISO 8601 date-time, e.g. 2026-09-19T18:00:00Z"),
    timezone: z.string().min(1),
    muscleGroups: z.array(z.string().min(1)).min(1).max(8),
    note: z.string().max(2000).optional().describe("Free-text feedback on how the session went"),
    exertion: z.number().int().min(1).max(5).optional().describe("Perceived difficulty of the whole session, 1 (very easy) to 5 (very hard)"),
    mood: z.enum(["bad", "ok", "good"]).optional().describe("How the owner felt: bad, ok or good (shown as three emoji in the app)"),
    sets: z.array(setInputSchema).min(1),
    idempotencyKey: z.string().min(1).max(200).optional()
  })
  }),
  rename_workout_template: spec({
    name: "rename_workout_template",
    title: "Rename a workout template",
    description: "Change only the name of an existing workout template (everything else, including all exercises, stays as it is). Get the id from list_workout_templates. Use this for requests like \"rename my workout to Full Body\"; use upsert_workout_template when the exercises change too.",
    input: z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) })
  }),
  list_workout_sessions: spec({
    name: "list_workout_sessions",
    title: "List logged workout sessions",
    description: "List the user's logged strength sessions (newest first; optionally between from and to, up to 200): date, trained muscles, difficulty 1-5, mood (bad|ok|good), free-text notes, and per exercise the sets as reps x kg with RIR. Use it to discuss or review workouts that were already done; planned routines are in list_workout_templates.",
    input: z.object({
      limit: z.number().int().min(1).max(200).default(10),
      from: z.string().optional().describe("Only sessions at or after this date/time (ISO 8601, or YYYY-MM-DD)"),
      to: z.string().optional().describe("Only sessions at or before this date/time (ISO 8601, or YYYY-MM-DD; a bare date includes that whole day)")
    })
  }),
  get_muscle_volume: spec({
    name: "get_muscle_volume",
    title: "Get weekly sets per muscle",
    description: "Hard sets per muscle per calendar week (Monday start in the given timezone), newest week first: a primary muscle counts 1 set per completed working/drop set, a secondary muscle 0.5; warm-ups are excluded. Use it to judge training balance and plan volume — a common reference is roughly 10-20 hard sets per muscle per week, trained about twice a week, but treat it as a guide, not a target to push. Muscles come from the exercises' primaryMuscles/secondaryMuscles (see upsert_exercise); sets of exercises without muscle data are counted under \"other\".",
    input: z.object({
    weeks: z.number().int().min(1).max(12).default(4),
    timezone: z.string().min(1).default("UTC").describe("IANA timezone that defines the week boundaries, e.g. Europe/Prague")
  })
  }),
  list_workout_templates: spec({
    name: "list_workout_templates",
    title: "List workout templates",
    description: "List the user's reusable workout templates (routines) — this is where a named workout plan such as \"Mon 5.10\" or \"Full Body\" lives; logged past sessions are separate (see list_workout_sessions). The result includes every template's id and its full exercises as JSON, so a template can be edited afterwards. Each has exercises with a prescription: sets, repMin-repMax, targetRir (reps in reserve), groupId (same value = superset) and an optional progression rule. Archived templates are hidden unless includeArchived is true.",
    input: z.object({ includeArchived: z.boolean().default(false) })
  }),
  upsert_workout_template: spec({
    name: "upsert_workout_template",
    title: "Create or update a workout template",
    description: "Save a reusable workout template. An explicit id updates that template, otherwise an exact normalized-name match is updated, else a new one is created; the exercises list is replaced as a whole. Every exerciseId must already exist (unknown_exercise otherwise) — pick them from the exercise database with search_exercises (filter by muscle/equipment/movementPattern; list_exercise_filters shows the values) rather than creating new exercises. Prescription per exercise: sets, weightKg (planned working weight; it is what the app prefills for the first session, and with a progression rule the weight is advanced from history afterwards), repMin/repMax (rep range), targetRir (0-5), groupId for supersets (with an optional groupLabel shown on the superset tab in the app, e.g. \"Superset for abs\"), and progression {type: \"double\", incrementKg} = keep the weight until every top set reaches repMax, then add incrementKg. Example: 3 x 6-10 at RIR 2 with +2.5 kg. Set isArchived: true to retire a template without deleting it.",
    input: z.object({ template: workoutTemplateInputSchema })
  }),
  delete_workout_template: spec({
    name: "delete_workout_template",
    title: "Delete a workout template",
    description: "Permanently delete a workout template by id. Logged workouts are unaffected. Prefer upsert_workout_template with isArchived: true when the user may want it back.",
    input: z.object({ id: z.string().uuid() })
  }),
  plan_workout_from_template: spec({
    name: "plan_workout_from_template",
    title: "Plan the next workout from a template",
    description: "Read-only preview of the next session for a template: the prescription per exercise plus, from the last logged session, the previous sets and a suggested working weight under the progression rule (reason: increase = every top set reached repMax, hold = keep the weight, planned = the template's own weightKg, no_history = nothing logged and nothing planned). Nothing is recorded; log the real session with record_workout_session afterwards.",
    input: z.object({ id: z.string().uuid() })
  }),
  get_exercise_history: spec({
    name: "get_exercise_history",
    title: "Get exercise history",
    description: "Read recent session history for one exercise: the heaviest set ever logged, the best estimated 1RM (Epley, working sets of 1-12 reps) and the last N sessions' top weight, total reps and best e1RM. Warm-up sets are excluded.",
    input: z.object({
    exerciseId: z.string().uuid(),
    limit: z.number().int().min(1).max(50).default(8)
  })
  }),
  get_template: spec({
    name: "get_template",
    title: "Get one workout template",
    description: "Read one workout template by id with its full prescription (sets, weightKg, repMin-repMax, targetRir, groupId supersets, progression). Use plan_workout_from_template when you also need last-session sets and the suggested weight.",
    input: z.object({ id: z.string().uuid() })
  }),
  get_workout_session: spec({
    name: "get_workout_session",
    title: "Get one logged workout session",
    description: "Read one logged strength session by its event id (from list_workout_sessions): date, muscles, difficulty, mood, note and every set with reps, kg, RIR and set type.",
    input: z.object({ eventId: z.string().uuid() })
  }),
  update_workout_session: spec({
    name: "update_workout_session",
    title: "Correct a logged workout session",
    description: "Replace an already logged session (same eventId) with corrected data: the whole set list is replaced atomically, so send every set, not only the changed ones. Use it to fix a wrong weight/reps or to add the session feedback afterwards; read the current session first with get_workout_session. Unknown exercise ids are rejected (unknown_exercise).",
    input: z.object({ eventId: z.string().uuid(), ...sessionFields })
  }),
  delete_workout_session: spec({
    name: "delete_workout_session",
    title: "Delete a logged workout session",
    description: "Permanently delete one logged session and its sets. Destructive: confirm with the user first; prefer update_workout_session when only some values are wrong.",
    input: z.object({ eventId: z.string().uuid() })
  }),
  get_daily_activity: spec({
    name: "get_daily_activity",
    title: "Get daily activity (steps)",
    description: "Daily activity records between two dates (inclusive, YYYY-MM-DD): steps, step goal, distance, weekly average and the day's workout summary. Use it next to the strength history to judge overall load and recovery.",
    input: z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("First day, YYYY-MM-DD"),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Last day, YYYY-MM-DD")
    })
  }),
  list_events: spec({
    name: "list_events",
    title: "List timeline events",
    description: "List the user's timeline events in reverse chronological order. Filter by type (progress_photo, workout, measurements, inbody, nutrition_entry) and/or a from-to window (ISO 8601 or YYYY-MM-DD), and page with offset. Use get_event for a full record.",
    input: z.object({
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).optional(),
      type: eventTypeSchema.optional(),
      from: z.string().optional().describe("Only events at or after this date/time"),
      to: z.string().optional().describe("Only events at or before this date/time (a bare YYYY-MM-DD includes that whole day)")
    })
  }),
  duplicate_workout_template: spec({
    name: "duplicate_workout_template",
    title: "Duplicate a workout template",
    description: "Create a copy of a template under a free name (\"X (copy)\", or the name you pass) so it can be varied without touching the original: for example a heavier week or a different split day. Returns the new template with its id.",
    input: z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120).optional() })
  }),
  list_exercise_alternatives: spec({
    name: "list_exercise_alternatives",
    title: "Find alternatives for an exercise",
    description: "Exercises that can replace one in a plan: same primary muscle, ranked by the same movement pattern and then the same equipment. Pass equipment to constrain it (for example \"dumbbell\" when the barbell is taken). Use it for \"swap this exercise\" requests, then put the chosen id into upsert_workout_template. Entries are compact (id, name, muscles, equipment, movement pattern); call get_exercise for the technique of the one you pick.",
    input: z.object({
      exerciseId: z.string().uuid(),
      equipment: z.string().optional(),
      limit: z.number().int().min(1).max(30).default(10)
    })
  }),
  preview_template_volume: spec({
    name: "preview_template_volume",
    title: "Preview sets per muscle for a draft plan",
    description: "Read-only: given a draft list of exercises with set counts, return total sets and sets per muscle (primary 1 per set, secondary 0.5, the same counting as get_muscle_volume) without saving anything. Use it to check balance before upsert_workout_template, ideally next to get_muscle_volume for what the user already trains per week.",
    input: z.object({
      exercises: z.array(z.object({ exerciseId: z.string().uuid(), sets: z.number().int().min(1).max(20) })).min(1).max(30)
    })
  }),
  update_workout_template: spec({
    name: "update_workout_template",
    title: "Change part of a workout template",
    description: "Change part of a template without resending its exercises (upsert_workout_template replaces the whole list). Template level: name, note, isArchived, and schedule = which weekdays the template is trained (weekdays use 0 = Sunday ... 6 = Saturday, optional startDate/endDate YYYY-MM-DD for a block such as 8 weeks; schedule null removes it). Exercise level: exercises = a list of changes, each addressed by 0-based index or by exerciseId (first match), setting any of sets, weightKg, repMin, repMax, targetRir, groupId, groupLabel, progression or note (null clears an optional field). Read the template first (get_template) to know the indexes. Use upsert_workout_template to add, remove or reorder exercises.",
    input: z.object({ id: z.string().uuid(), ...templatePatchSchema.shape })
  }),
  get_week_plan: spec({
    name: "get_week_plan",
    title: "Get the training week plan",
    description: "The training week (Monday first) in the user's timezone: per day which templates are scheduled (from each template's schedule), the sessions actually logged, and a status: planned (ahead or today), done, missed (scheduled in the past, nothing logged), extra (logged on an unscheduled day) or free (nothing planned, nothing logged). summary.unplannedDays lists the days with no plan: use it to see which weekdays are not planned, then set schedules with update_workout_template. start is any date in the wanted week (default: this week).",
    input: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Any date (YYYY-MM-DD) in the wanted week; default is the current week"),
      timezone: z.string().min(1).default("UTC").describe("IANA timezone that defines the days, e.g. Europe/Prague")
    })
  }),
  send_feedback: spec({
    name: "send_feedback",
    title: "Send feedback about these tools",
    description: "Tell the owner how these tools worked for you. Call it when a tool failed, behaved unexpectedly, was awkward or slow, lacked something you needed, or worked especially well, and once at the end of a longer task if anything is worth saying. One entry per point: several short entries beat one long essay. category: bug (wrong result or an error), friction (works but is awkward or slow), missing_tool (you needed something that does not exist), works_well (say what to keep), suggestion, other. Always name the tool; say what you did (summary, details), what you expected, and what would be better (suggestion); for a failure include the error code you got. toolCalls may list the calls involved with outcome ok, error or confusing. Do not include secrets or tokens and do not paste personal health data, photos or full session logs: describe the problem instead. You do not need to ask the user first, but tell them briefly that you sent it. The same summary about the same tool is stored once per day; about 30 entries per hour at most.",
    input: feedbackInputSchema
  }),
  list_feedback: spec({
    name: "list_feedback",
    title: "Read feedback agents left",
    description: "Read the feedback agents left about these tools, newest first. Read it BEFORE changing tools, the Studio UI or agent behaviour, and propose fixes for the related open entries (status new or triaged). Filter by status, category or tool. Each entry shows id, status, category, severity, tool, summary, details, expected, suggestion, client, source (mcp, webmcp or rest) with the Studio page for WebMCP entries, and any resolution.",
    input: z.object({
      status: feedbackStatusSchema.optional(),
      category: feedbackCategorySchema.optional(),
      tool: z.string().trim().min(1).max(128).optional().describe("Only entries about this tool, e.g. list_events"),
      limit: z.number().int().min(1).max(200).default(50)
    })
  }),
  update_feedback: spec({
    name: "update_feedback",
    title: "Triage a feedback entry",
    description: "Triage one feedback entry (id from list_feedback): set status (new, triaged, done, wontfix) and/or a resolution note saying what was done (for example a PR link) or why it will not be done. Mark an entry done only after the fix has shipped.",
    input: z.object({
      id: z.string().uuid(),
      status: feedbackStatusSchema.optional(),
      resolution: z.string().trim().max(1000).optional()
    })
  })
} as const;

export type SpecName = keyof typeof specs;
export const allSpecs: ToolSpec[] = Object.values(specs) as unknown as ToolSpec[];
