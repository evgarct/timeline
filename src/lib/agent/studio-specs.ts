import { z } from "zod";
import type { ToolSpec } from "./specs";

/**
 * Tools only the Studio web UI can offer: they drive the live page (navigation, the builder draft, the dashboard
 * view) and are registered through WebMCP. Data tools (search, templates, sessions...) come from the shared
 * registry in specs.ts through the REST bridge.
 */
const readOnly = { readOnlyHint: true } as const;
const consequential = { destructiveHint: false, idempotentHint: false } as const;

function studioSpec<Shape extends z.ZodRawShape>(definition: Omit<ToolSpec<Shape>, "annotations" | "rest"> & { annotations?: ToolSpec["annotations"] }): ToolSpec<Shape> {
  return { ...definition, annotations: definition.annotations ?? {} };
}

const itemKey = z.string().min(1).describe("The item's key from builder_get_draft (not the exercise id: the same exercise can appear twice)");
const muscle = z.string().min(1).describe("Canonical primary muscle id, e.g. chest, lats, shoulders, biceps, triceps, quads, hamstrings, glutes, abs");

export const studioSpecs = {
  studio_get_context: studioSpec({
    name: "studio_get_context",
    title: "Where am I in Studio",
    description: "Current Studio page (dashboard, body, templates list, template builder), locale, theme and whether the builder has unsaved changes. Call it first so you know which page tools are available.",
    input: z.object({}),
    annotations: readOnly
  }),
  studio_navigate: studioSpec({
    name: "studio_navigate",
    title: "Open a Studio page",
    description: "Navigate the visible Studio UI: dashboard, the Body page (InBody tests and trends), the templates list, a new template in the builder, or an existing template (pass templateId). If the builder has unsaved changes the user is asked to confirm leaving; on a refusal nothing changes.",
    input: z.object({
      to: z.enum(["dashboard", "body", "templates", "new_template", "template"]),
      templateId: z.string().uuid().optional().describe("Required when to is \"template\"")
    }),
    annotations: consequential
  }),
  builder_get_draft: studioSpec({
    name: "builder_get_draft",
    title: "Read the template being built",
    description: "The builder's live draft: name, every item with its key, exercise, sets, weightKg, repMin/repMax, targetRir, progressionKg (double progression increment), superset groupId and note, plus total sets and sets per muscle (primary 1, secondary 0.5). Only available on a builder page.",
    input: z.object({}),
    annotations: readOnly
  }),
  builder_set_name: studioSpec({
    name: "builder_set_name",
    title: "Name the template",
    description: "Set the template's name in the builder.",
    input: z.object({ name: z.string().trim().min(1).max(120) })
  }),
  builder_add_exercise: studioSpec({
    name: "builder_add_exercise",
    title: "Add an exercise to the template",
    description: "Add an exercise (by id from search_exercises / list_exercise_alternatives) to the draft; the card animates in on the canvas. index is the 0-based insert position, default end. New items start with 3 sets; set the prescription with builder_update_exercise.",
    input: z.object({ exerciseId: z.string().uuid(), index: z.number().int().min(0).optional() })
  }),
  builder_create_exercise: studioSpec({
    name: "builder_create_exercise",
    title: "Create an exercise and add it",
    description: "Last resort when search_exercises found nothing: create a personal exercise (an existing one with the same name is reused, never overwritten) and add it to the draft.",
    input: z.object({ name: z.string().trim().min(1).max(120), primaryMuscle: muscle, equipment: z.string().optional() })
  }),
  builder_remove_exercise: studioSpec({
    name: "builder_remove_exercise",
    title: "Remove an item",
    description: "Remove one item from the draft (undo with builder_undo).",
    input: z.object({ itemKey })
  }),
  builder_move_exercise: studioSpec({
    name: "builder_move_exercise",
    title: "Reorder an item",
    description: "Move an item to a 0-based position. A superset that is split by the move is dissolved.",
    input: z.object({ itemKey, toIndex: z.number().int().min(0) })
  }),
  builder_update_exercise: studioSpec({
    name: "builder_update_exercise",
    title: "Set the prescription of an item",
    description: "Change an item's prescription; only the fields you pass change, null clears an optional field. sets 1-20, weightKg planned working weight, repMin/repMax rep range (repMin <= repMax), targetRir 0-5, progressionKg = double progression increment (add this much once every top set reaches repMax), note.",
    input: z.object({
      itemKey,
      sets: z.number().int().min(1).max(20).optional(),
      weightKg: z.number().min(0).max(1000).nullable().optional(),
      repMin: z.number().int().min(1).max(100).nullable().optional(),
      repMax: z.number().int().min(1).max(100).nullable().optional(),
      targetRir: z.number().int().min(0).max(5).nullable().optional(),
      progressionKg: z.number().min(0).max(50).nullable().optional(),
      note: z.string().max(500).nullable().optional()
    })
  }),
  builder_link_superset: studioSpec({
    name: "builder_link_superset",
    title: "Link or unlink a superset",
    description: "Link an item with the NEXT item into a superset (linked: true) or break the link between them (linked: false). Unlinking one boundary of a longer superset keeps the remaining pair.",
    input: z.object({ itemKey, linked: z.boolean() })
  }),
  builder_undo: studioSpec({ name: "builder_undo", title: "Undo the last draft change", description: "Undo the last change to the draft (the user's or yours).", input: z.object({}) }),
  builder_redo: studioSpec({ name: "builder_redo", title: "Redo", description: "Redo the change that was undone.", input: z.object({}) }),
  builder_save: studioSpec({
    name: "builder_save",
    title: "Save the template",
    description: "Save the draft as a workout template (creates it, or updates the open one). Consequential: the user is asked to approve unless they enabled \"allow the agent to save\". Needs a name and at least one exercise.",
    input: z.object({}),
    annotations: consequential
  }),
  dashboard_get_view: studioSpec({
    name: "dashboard_get_view",
    title: "Read what the dashboard shows",
    description: "What the human sees on the dashboard: KPI numbers for the selected week, the selected week, sets per muscle that week, the chosen exercise with its e1RM points, and the recent sessions list. Only available on the dashboard.",
    input: z.object({}),
    annotations: readOnly
  }),
  dashboard_select_week: studioSpec({
    name: "dashboard_select_week",
    title: "Select a week on the dashboard",
    description: "Select a week (its Monday, YYYY-MM-DD, as listed by dashboard_get_view) so the KPIs and the muscle heat map show it.",
    input: z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
  }),
  dashboard_select_exercise: studioSpec({
    name: "dashboard_select_exercise",
    title: "Select an exercise for the strength chart",
    description: "Show the e1RM progress chart for an exercise id (one the user has logged).",
    input: z.object({ exerciseId: z.string().uuid() })
  }),
  body_get_view: studioSpec({
    name: "body_get_view",
    title: "Read what the Body page shows",
    description: "What the human sees on the Body page: the metric picked for the trend chart with one point per InBody test (date, value, change since the previous test), the list of tests with their headline numbers and what happened between them (diet, steps, workouts, photos). Only available on the Body page; call get_body_composition for the full data.",
    input: z.object({}),
    annotations: readOnly
  }),
  body_select_metric: studioSpec({
    name: "body_select_metric",
    title: "Select a metric on the Body page",
    description: "Show the trend chart for one metric key (for example weight, skeletal_muscle_mass, body_fat_mass, percent_body_fat, visceral_fat_level, basal_metabolic_rate); the keys on offer are listed by body_get_view.",
    input: z.object({ key: z.string().min(1) })
  })
} as const;

export type StudioToolName = keyof typeof studioSpecs;
export const allStudioSpecs: ToolSpec[] = Object.values(studioSpecs) as unknown as ToolSpec[];
