import { createHash } from "node:crypto";
import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  listTaskSchedules,
  saveTaskSchedule,
  updateEvent
} from "@/data/repository";
import { redactMediaUrls, taskScheduleSchema, timelineEventSchema } from "@/domain/events";
import {
  deleteFoodEntry,
  getFoodEntry,
  getProduct,
  listFoodEntries,
  listProductCategories,
  mergeFoodEntries,
  recordAdHocFood,
  recordFood,
  repeatMeal,
  searchProducts,
  aggregateNutrients,
  updateFoodEntry,
  upsertProduct
} from "@/data/nutrition-repository";
import {
  canonicalMacroKeys,
  describeQuantity,
  foodQuantitySchema,
  localizedTextSchema,
  mealTypeSchema,
  nutrientSnapshotSchema,
  productInputSchema,
  selectCalculationBase,
  summarizeMacros
} from "@/domain/nutrition";
import {
  deleteWorkoutSession,
  exerciseFacets,
  getExercise,
  getExerciseHistory,
  getMuscleVolume,
  getWorkoutSession,
  listExerciseAlternatives,
  listRecentWorkoutSessions,
  previewTemplateVolume,
  recordWorkoutSession,
  replaceWorkoutSession,
  exerciseSearchItem,
  searchExercises,
  upsertExerciseDetailed
} from "@/data/exercise-repository";
import { isValidTimeZone } from "@/domain/exercises";
import { deleteTemplate, duplicateTemplate, getTemplate, listTemplates, patchTemplate, planTemplate, upsertTemplate, withExerciseDetails } from "@/data/workout-template-repository";
import { getWeekPlan } from "@/data/week-plan-repository";
import { isTaskCompleted, latestEvent } from "@/domain/timeline";
import { resolveMcpUser } from "@/data/repository";
import { listDailyActivity } from "@/data/daily-activity-repository";
import { createFeedback, listFeedback, updateFeedback } from "@/data/feedback-repository";
import type { Feedback } from "@/domain/feedback";
import { parseRange } from "@/lib/agent/range";
import { specs, type ToolSpec } from "@/lib/agent/specs";

function hashToken(token: string) {
  return createHash("sha256").update(`${process.env.MCP_TOKEN_PEPPER ?? "development"}:${token}`).digest("hex");
}

export async function authenticateMcp(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return authenticateMcpToken(header.slice(7));
}

export async function authenticateMcpToken(token: string) {
  if (!token.startsWith("ft_dev_")) return null;
  return resolveMcpUser(hashToken(token));
}

function result(
  title: string,
  summary: string,
  data: unknown,
  items: Array<{ label: string; value: string }> = [],
  opts: { id?: string; text?: string; withData?: boolean } = {}
) {
  let text = opts.text ?? (opts.id ? `${summary} (id: ${opts.id})` : summary);
  // Clients such as Claude read only the text content, never structuredContent: a bare summary
  // like "10 events" leaves the model blind (no ids, no fields). Unless a tool wrote its own
  // detailed text, append the data as compact JSON (bounded); tools that must be edited from the
  // text (templates) opt in with withData.
  if ((opts.text === undefined || opts.withData) && data !== undefined) {
    text += `\n${dataAsText(data)}`;
  }
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { title, summary, items, data, ...(opts.id ? { id: opts.id } : {}) }
  };
}

const MAX_DATA_TEXT_CHARS = 20000;

function dataAsText(data: unknown) {
  const json = JSON.stringify(data);
  if (json === undefined) return "";
  return json.length > MAX_DATA_TEXT_CHARS
    ? `${json.slice(0, MAX_DATA_TEXT_CHARS)}... (truncated, ${json.length} characters in total; ask for fewer items)`
    : json;
}

const fail = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true as const });

/** Registers a tool from the shared spec registry (name, description, schema and hints come from there). */
function registerSpec<Shape extends z.ZodRawShape>(server: McpServer, spec: ToolSpec<Shape>, handler: ToolCallback<Shape>) {
  server.registerTool(spec.name, {
    title: spec.title,
    description: spec.description,
    inputSchema: spec.input.shape,
    annotations: spec.annotations
  }, handler);
}

function itemizeText(count: number, noun: string, labels: string[], maxShown = 10) {
  if (!count) return `No ${noun}`;
  const shown = labels.slice(0, maxShown);
  const more = count - shown.length;
  return `${count} ${noun}: ${shown.join("; ")}${more > 0 ? `; +${more} more` : ""}`;
}

export interface McpRequestContext {
  /** The caller's User-Agent header; the stateless transport does not keep MCP clientInfo between requests. */
  userAgent?: string | null;
}

const SERVER_INSTRUCTIONS = "Fitness Timeline: the owner's body timeline, nutrition journal and strength training (exercises, templates, sessions, volume). "
  + "If any tool failed, was unclear or awkward, lacked something you needed, or worked especially well, call send_feedback (one short entry per point, name the tool, no secrets or raw health data): the owner reads it when improving these tools. "
  + "Before changing tools or the Studio UI, read open entries with list_feedback.";

function feedbackText(entry: Feedback) {
  return [
    `${entry.id} | ${entry.status} | ${entry.category}${entry.severity ? `/${entry.severity}` : ""} | ${entry.tool ?? "-"} | ${entry.createdAt.toISOString().slice(0, 10)} | ${entry.summary}`,
    entry.details ? `  details: ${entry.details}` : undefined,
    entry.expected ? `  expected: ${entry.expected}` : undefined,
    entry.suggestion ? `  suggestion: ${entry.suggestion}` : undefined,
    entry.toolCalls?.length ? `  calls: ${entry.toolCalls.map((call) => `${call.tool}=${call.outcome}${call.note ? ` (${call.note})` : ""}`).join(", ")}` : undefined,
    entry.client ? `  client: ${entry.client}` : undefined,
    `  source: ${entry.source}${entry.page ? ` (${entry.page})` : ""}`,
    entry.resolution ? `  resolution: ${entry.resolution}` : undefined
  ].filter(Boolean).join("\n");
}

export function createTimelineMcpServer(userId: string, context: McpRequestContext = {}) {
  const server = new McpServer({ name: "fitness-timeline", version: "0.1.0" }, { instructions: SERVER_INSTRUCTIONS });

  server.registerTool("get_today", {
    title: "Get Today",
    description: "Return today's tasks and current body state. Pass timezone (an IANA name like \"Europe/Prague\") to also get the running macro totals (energy, protein, fat, carbs) logged so far for the user's local today.",
    inputSchema: {
      timezone: z.string().min(1).optional(),
      includePhotoUrls: z.boolean().default(false).describe("Include the long pre-signed photo and file URLs (default false: photos come back as ids and a count; get_event returns one event with its URLs)")
    }
  }, async ({ timezone, includePhotoUrls }) => {
    const [events, schedules] = await Promise.all([listEvents(userId), listTaskSchedules(userId)]);
    const due = schedules.filter((schedule) => schedule.enabled).map((schedule) => ({
      type: schedule.eventType,
      completed: isTaskCompleted(schedule.eventType, events)
    }));
    const latest = ["progress_photo", "measurements", "inbody"].map((type) => latestEvent(events, type as never));
    const current = includePhotoUrls ? latest : latest.map((event) => redactMediaUrls(event));
    const tasksText = `${due.filter((task) => task.completed).length}/${due.length} tasks completed`;
    let nutrition: { date: string; totals: ReturnType<typeof aggregateNutrients> } | undefined;
    if (timezone) {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
      const entries = await listFoodEntries(userId, date, timezone);
      nutrition = { date, totals: aggregateNutrients(entries) };
    }
    const text = nutrition
      ? `${tasksText} · today ${summarizeMacros(nutrition.totals)}`
      : tasksText;
    return result("Today", text, { due, current, ...(nutrition ? { nutrition } : {}) }, [], { text, withData: true });
  });

  registerSpec(server, specs.list_events, async ({ limit, offset, type, from, to }) => {
    const range = parseRange(from, to);
    if ("error" in range) return fail(range.error);
    const events = await listEvents(userId, { type, limit, offset, ...range });
    const lines = events.map((event) => {
      const parts = [event.id, event.type, event.occurredAt.toISOString().slice(0, 16)];
      if (event.type === "workout") {
        parts.push(event.muscleGroups.join("+"));
        if (event.exertion) parts.push(`difficulty ${event.exertion}/5`);
        if (event.mood) parts.push(`mood ${event.mood}`);
      }
      if (event.type === "measurements" && event.values.weightKg) parts.push(`${event.values.weightKg} kg`);
      if (event.note) parts.push(`note: ${event.note}`);
      return parts.join(" | ");
    });
    const text = events.length
      ? `${events.length} events (id | type | time | details); use get_event for the full record:\n${lines.join("\n")}`
      : "No events";
    return result("Timeline", `${events.length} events`, events, events.map((event) => ({
      label: event.type.replace("_", " "),
      value: event.occurredAt.toISOString().slice(0, 10)
    })), { text });
  });

  server.registerTool("get_event", {
    title: "Get event",
    description: "Read one timeline event.",
    inputSchema: { id: z.string().uuid() }
  }, async ({ id }) => {
    const event = await getEvent(userId, id);
    if (!event) return { content: [{ type: "text" as const, text: "Event not found" }], isError: true };
    return result("Timeline event", event.type.replace("_", " "), event);
  });

  server.registerTool("create_event", {
    title: "Create event",
    description: "Create a progress photo, workout, measurements, or InBody event. For InBody, send the original file reference in source.url and all extracted metrics; do not ask the server to OCR it.",
    inputSchema: { event: z.record(z.string(), z.unknown()) }
  }, async ({ event }) => {
    const parsed = timelineEventSchema.safeParse(event);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    const created = await createEvent(userId, parsed.data);
    return result("Event created", created.type.replace("_", " "), created);
  });

  server.registerTool("update_event", {
    title: "Update event",
    description: "Replace an existing event after reading it.",
    inputSchema: { event: z.record(z.string(), z.unknown()) }
  }, async ({ event }) => {
    const parsed = timelineEventSchema.safeParse(event);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    return result("Event updated", parsed.data.type.replace("_", " "), await updateEvent(userId, parsed.data));
  });

  server.registerTool("delete_event", {
    title: "Delete event",
    description: "Permanently delete one timeline event.",
    inputSchema: { id: z.string().uuid() },
    annotations: { destructiveHint: true }
  }, async ({ id }) => {
    await deleteEvent(userId, id);
    return result("Event deleted", id, { id });
  });

  server.registerTool("get_task_schedules", {
    title: "Get task schedules",
    description: "Read recurring Today task schedules."
  }, async () => {
    const schedules = await listTaskSchedules(userId);
    return result("Task schedules", `${schedules.length} schedules`, schedules);
  });

  server.registerTool("update_task_schedule", {
    title: "Update task schedule",
    description: "Update weekdays, weekly interval, or enabled state for one task.",
    inputSchema: { schedule: z.record(z.string(), z.unknown()) }
  }, async ({ schedule }) => {
    const parsed = taskScheduleSchema.safeParse(schedule);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    return result("Schedule updated", parsed.data.eventType.replace("_", " "), await saveTaskSchedule(userId, parsed.data));
  });

  server.registerTool("search_products", {
    title: "Search personal products",
    description: "Search the user's complete personal product database by name, brand, barcode, or searchAliases (extra terms saved on the product via upsert_product, e.g. a Russian/Czech/English name for a product whose own name is in a different language). Matches on substrings, so \"кофе\" only finds a product if it (or one of its aliases) actually contains that substring — it does not translate or fuzzy-match across languages on its own. Results are paginated and are not limited to recent products.",
    inputSchema: {
      query: z.string().default(""),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(30)
    }
  }, async ({ query, page, pageSize }) => {
    const found = await searchProducts(userId, query, page, pageSize);
    const text = itemizeText(found.items.length, "products", found.items.map((product) => `${product.name} (id: ${product.id})`));
    return result("Products", `Personal product search: ${query || "all"}`, found, [], { text });
  });

  server.registerTool("get_product", {
    title: "Get product with all nutrients",
    description: "Read a personal product including every stored nutrient base, original label, unit, qualifier, daily value, and stated/calculated/estimated provenance.",
    inputSchema: { id: z.string().uuid() }
  }, async ({ id }) => {
    const product = await getProduct(userId, id);
    return product
      ? result("Product", product.name, product)
      : { content: [{ type: "text" as const, text: "product_not_found" }], isError: true };
  });

  server.registerTool("list_product_categories", {
    title: "List existing product categories",
    description: "Returns every distinct `type` (category) already used in this user's product database, most-used first. Call this before upsert_product/record_ad_hoc_food whenever you're about to invent a category for a new product — if an existing entry already covers it, reuse that exact en/ru/cs spelling verbatim instead of writing a new variant (e.g. don't add \"Fruits\" or \"Fruit \" next to an existing \"Fruit\", and don't retranslate a category that already has a cs value). Only write a new category when nothing existing actually fits.",
    inputSchema: {}
  }, async () => {
    const categories = await listProductCategories(userId);
    const text = itemizeText(
      categories.length,
      "categories",
      categories.map((category) => category.en ?? category.ru ?? category.cs ?? "?"),
      50
    );
    return result("Product categories", `${categories.length} existing categories`, categories, [], { text });
  });

  server.registerTool("upsert_product", {
    title: "Create or update a personal product",
    description: "Save every readable row from a nutrition label, not only calories and macros. Preserve original labels, units, '<'/trace qualifiers, multiple bases such as per 100 g and per serving, and unknown nutrients. Never invent missing packaged-food values. Mark label values stated, derived values calculated, and reference fruit/vegetable values estimated. Exact barcodes are reused; ambiguous name matches return an error. When the package states a whole-container size (e.g. a 330 ml can, a 250 g cup, a 1 L bottle) AND you are not already recording it as its own nutrientBases entry (a \"per portion\" base with directly stated values), add it to servingSizes as { label: \"1 банка (330 мл)\", amount: 330, provenance: \"stated\" } so the app can offer it as a one-tap quantity; amount is always expressed in the product's own baseUnit (g or ml), never invented when the label doesn't state a container size. Do not add both a \"per portion\" nutrientBases entry and a servingSizes entry for the same container size — that duplicates the same quick-select option; prefer the nutrientBases entry when the label states per-serving values directly, and servingSizes only when you'd otherwise have to scale from the reference base. pieceSizes is a SEPARATE array from servingSizes, only for gram-based products (baseUnit \"g\"): each entry is { size: \"small\"|\"regular\"|\"medium\"|\"large\", grams, provenance } — a fixed 4-value relative sizing (not a container size or free text). Prefer servingSizes for almost everything (a banana, a capsule, a slice, a can) since its label is free text matched by record_food's unit: \"serving\"; only use pieceSizes when the product genuinely comes in those exact small/regular/medium/large variants. Both pieceSizes and servingSizes are per-product — there is no shared or built-in catalog, so record_food's unit: \"piece\"/\"serving\" only resolves against sizes/labels already saved on that specific product via upsert_product. Each servingSizes entry gets a stable id (auto-assigned if you omit it, and preserved across re-saves as long as the label stays the same) — read it back via get_product and pass it as record_food's quantity.servingSizeId for exact matching instead of relying on the label string, which breaks on whitespace/punctuation differences; quantity.label becomes optional once you have servingSizeId, but at least one of the two is required. CRITICAL: every nutrient you recognize MUST also carry its canonical `key` in addition to the original label, or the app's calorie/macro totals will silently show zero for this product. Always set key: \"energy_kcal\" for the kcal energy row (not the kJ row), \"protein\" for protein, \"fat\" for total fat, \"carbohydrates\" for total carbohydrate — these four are required whenever present on the label. Also set canonical keys when recognizable: \"saturated_fat\", \"sugars\", \"fiber\", \"salt\", \"sodium\", \"cholesterol\", and \"vitamin_*\"/mineral names (e.g. \"potassium\", \"calcium\", \"iron\"). Leave key unset only for rows you cannot confidently map (e.g. a kJ energy row when energy_kcal is already set, or a genuinely unrecognized nutrient) — never guess a key for those. If the product's own name is in one language, set searchAliases to the equivalent name/common terms in the other languages the user might search in (e.g. name \"Café au Lait\" with searchAliases [\"кофе\", \"coffee\", \"káva\"]) so search_products can find it later regardless of which language the user searches in. Always also set type (the product category, e.g. { en: \"Coffee\", ru: \"Кофе\", cs: \"Káva\" }, or { en: \"Protein powder\", ru: \"Протеин\", cs: \"Protein\" }) — there is no shared category catalog, so call list_product_categories first and reuse an existing category's exact en/ru/cs spelling verbatim if the product fits one (don't write \"Fruits\" next to an existing \"Fruit\", or a fresh translation next to an existing one); only write a new category when nothing existing fits. Also set genericName (the product's name with any brand stripped, e.g. { en: \"Café au Lait\", ru: \"Кофе с молоком\", cs: \"Káva s mlékem\" }) in all three languages — the app shows these so a product is recognizable even when its own name alone doesn't make the category obvious. Fill in whichever of the three languages you can produce a reasonable translation for; it's fine to leave a language empty rather than guess badly.",
    inputSchema: { product: productInputSchema }
  }, async ({ product }) => {
    const parsed = productInputSchema.safeParse(product);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    try {
      const saved = await upsertProduct(userId, parsed.data);
      const macros = summarizeMacros(selectCalculationBase(saved).nutrients);
      return result("Product saved", saved.name, saved, [], {
        id: saved.id,
        text: `${saved.name} (id: ${saved.id}) — ${macros}`
      });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "product_save_failed" }], isError: true };
    }
  });

  server.registerTool("record_food", {
    title: "Record food",
    description: "Record food without confirmation when the user's intent is unambiguous. Use the user's current local date by default; explicit past and future dates are allowed. Provide an existing productId or a full new product with every visible nutrient. If meal is not stated and cannot be inferred, use snack. Photos are analyzed by ChatGPT and are never sent to or stored by this server. Reuse the same idempotencyKey when retrying. quantity.unit accepts \"g\" or \"ml\" (amount in that unit), \"piece\" (amount x a product's pieceSizes entry, matched by its small/regular/medium/large size), or \"serving\" (amount x a product's servingSizes entry — call get_product first to read the available entries, then prefer matching by servingSizeId; label is accepted as a fallback but must match the stored label exactly, including whitespace/punctuation, so servingSizeId is more reliable. quantity.label is optional when servingSizeId is given — do not invent or repeat a label just to satisfy validation, omit it). pieceSizes and servingSizes only resolve against entries already saved on that exact product via upsert_product — they are per-product, not a shared or built-in catalog, so even a common item like a banana must have its own servingSizes/pieceSizes set before unit: \"piece\"/\"serving\" works for it; if the lookup fails, the error lists what is actually available on that product. Never hand-convert a known serving size into g/ml yourself; pass unit: \"serving\" with the servingSizeId (or label) instead. If the meal has no reusable product (a one-off home-cooked or eyeballed dish you will never look up again), use record_ad_hoc_food instead — it never creates a Product row.",
    inputSchema: {
      productId: z.string().uuid().optional(),
      product: productInputSchema.optional(),
      mealType: mealTypeSchema,
      quantity: foodQuantitySchema,
      occurredAt: z.string().describe("ISO 8601 date-time, e.g. 2026-07-24T12:00:00Z"),
      timezone: z.string().min(1),
      note: z.string().max(2000).optional(),
      idempotencyKey: z.string().min(1).max(200)
    }
  }, async ({ productId, product, mealType, quantity, occurredAt, timezone, note, idempotencyKey }) => {
    const parsedQuantity = foodQuantitySchema.safeParse(quantity);
    const parsedProduct = product ? productInputSchema.safeParse(product) : undefined;
    const parsedOccurredAt = new Date(occurredAt);
    if (
      !parsedQuantity.success
      || (parsedProduct && !parsedProduct.success)
      || Boolean(productId) === Boolean(product)
      || Number.isNaN(parsedOccurredAt.getTime())
    ) {
      return { content: [{ type: "text" as const, text: "Provide exactly one valid productId or product, a valid quantity, and a valid occurredAt." }], isError: true };
    }
    try {
      const entry = await recordFood(userId, {
        productId,
        product: parsedProduct?.data,
        mealType,
        quantity: parsedQuantity.data,
        occurredAt: parsedOccurredAt,
        timezone,
        note,
        idempotencyKey
      });
      const macros = summarizeMacros(entry.productSnapshot.nutrients);
      return result("Food recorded", entry.productSnapshot.name, entry, [], {
        id: entry.id,
        text: `${entry.productSnapshot.name} (id: ${entry.id}) — ${macros}`
      });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "entry_save_failed" }], isError: true };
    }
  });

  server.registerTool("record_ad_hoc_food", {
    title: "Record ad hoc food",
    description: "Record a one-off meal with inline nutrients, without creating or touching a Product. Use this instead of record_food when the meal is home-cooked, eyeballed, or otherwise not worth saving as a reusable product (e.g. \"3 pancakes, about 150 g, estimated\"). Provide the nutrients for the quantity actually eaten — they are stored as-is, never scaled. Also set type (the food category in en/ru/cs, e.g. { en: \"Protein drink\", ru: \"Протеиновый напиток\", cs: \"Proteinový nápoj\" }) — call list_product_categories first and reuse an existing category verbatim if this ad hoc meal fits one, rather than writing a fresh variant — and genericName (the name with any brand stripped, in en/ru/cs) whenever you can produce a reasonable translation — leave a language empty rather than guess badly. Reuse the same idempotencyKey when retrying.",
    inputSchema: {
      mealType: mealTypeSchema,
      name: z.string().trim().min(1).max(300),
      brand: z.string().trim().min(1).max(200).optional(),
      quantityLabel: z.string().trim().min(1).max(120).describe("Human-readable description of the quantity eaten, e.g. \"3 pancakes (~150 g, estimated)\""),
      nutrients: z.array(nutrientSnapshotSchema).min(1),
      type: localizedTextSchema.describe("Food category in en/ru/cs, e.g. { en: \"Coffee\", ru: \"Кофе\", cs: \"Káva\" }"),
      genericName: localizedTextSchema.describe("Name with the brand stripped, in en/ru/cs"),
      occurredAt: z.string().describe("ISO 8601 date-time, e.g. 2026-07-24T12:00:00Z"),
      timezone: z.string().min(1),
      note: z.string().max(2000).optional(),
      idempotencyKey: z.string().min(1).max(200)
    }
  }, async ({ mealType, name, brand, quantityLabel, nutrients, type, genericName, occurredAt, timezone, note, idempotencyKey }) => {
    const parsedOccurredAt = new Date(occurredAt);
    if (Number.isNaN(parsedOccurredAt.getTime())) {
      return { content: [{ type: "text" as const, text: "Provide a valid occurredAt." }], isError: true };
    }
    try {
      const entry = await recordAdHocFood(userId, {
        mealType, name, brand, quantityLabel, nutrients, type, genericName,
        occurredAt: parsedOccurredAt, timezone, note, idempotencyKey
      });
      const macros = summarizeMacros(entry.productSnapshot.nutrients);
      return result("Food recorded", entry.productSnapshot.name, entry, [], {
        id: entry.id,
        text: `${entry.productSnapshot.name} (id: ${entry.id}) — ${macros}`
      });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "entry_save_failed" }], isError: true };
    }
  });

  server.registerTool("repeat_meal", {
    title: "Repeat meal",
    description: "Copy every entry logged for one meal (breakfast/lunch/dinner/snack) on sourceDate into targetDate, preserving each entry's exact product, quantity, and nutrient snapshot. Always additive — entries already logged for that meal on targetDate are left untouched, never deleted or replaced. Works identically for catalog-backed and ad hoc entries. Safe to retry: repeating the same sourceDate to targetDate pair again does not duplicate already-copied entries.",
    inputSchema: {
      mealType: mealTypeSchema,
      sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Local calendar day to copy entries FROM, e.g. 2026-08-03"),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Local calendar day to copy entries INTO, e.g. 2026-08-04"),
      timezone: z.string().min(1)
    }
  }, async ({ mealType, sourceDate, targetDate, timezone }) => {
    try {
      const copied = await repeatMeal(userId, { mealType, sourceDate, targetDate, timezone });
      const text = itemizeText(
        copied.length,
        "entries copied",
        copied.map((entry) => `${entry.productSnapshot.name} (id: ${entry.id})`),
        copied.length
      );
      return result(
        "Meal repeated",
        `${copied.length} entries copied from ${sourceDate} to ${targetDate}`,
        { entries: copied },
        [],
        { text: copied.length ? text : `No ${mealType} entries found on ${sourceDate} to repeat.` }
      );
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "repeat_failed" }], isError: true };
    }
  });

  server.registerTool("merge_food_entries", {
    title: "Merge food entries",
    description: "Combine two or more food journal entries into one ad hoc entry, deleting the originals atomically. Nutrients are summed across all entries. Note: nutrient rows that only carry a qualifier (e.g. \"trace\", \"< 0.1 mg\") without a numeric value are dropped during the merge — only numeric nutrient values are summed. Reuse the same idempotencyKey when retrying.",
    inputSchema: {
      ids: z.array(z.string().uuid()).min(2).max(20),
      mealType: mealTypeSchema.optional(),
      occurredAt: z.string().optional().describe("ISO 8601 date-time; defaults to the earliest of the merged entries"),
      timezone: z.string().min(1).optional(),
      note: z.string().max(2000).optional(),
      name: z.string().trim().min(1).max(300).optional().describe("Defaults to the merged entries' distinct names joined with \" + \""),
      idempotencyKey: z.string().min(1).max(200)
    },
    annotations: { destructiveHint: true }
  }, async ({ ids, mealType, occurredAt, timezone, note, name, idempotencyKey }) => {
    const parsedOccurredAt = occurredAt !== undefined ? new Date(occurredAt) : undefined;
    if (parsedOccurredAt && Number.isNaN(parsedOccurredAt.getTime())) {
      return { content: [{ type: "text" as const, text: "Provide a valid occurredAt." }], isError: true };
    }
    try {
      const entry = await mergeFoodEntries(userId, {
        ids, mealType, occurredAt: parsedOccurredAt, timezone, note, name, idempotencyKey
      });
      const macros = summarizeMacros(entry.productSnapshot.nutrients);
      return result("Food entries merged", entry.productSnapshot.name, entry, [], {
        id: entry.id,
        text: `${entry.productSnapshot.name} (id: ${entry.id}) — ${macros}`
      });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "merge_failed" }], isError: true };
    }
  });

  server.registerTool("list_food_entries", {
    title: "List food journal",
    description: "List food entries for a local calendar day, most recently logged first. Optionally filter to one mealType, and page through a day with many entries via limit/offset — the returned text always lists every entry in the page (never silently truncated), and totalCount in the data reports how many entries match before paging.",
    inputSchema: {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      timezone: z.string().min(1),
      mealType: mealTypeSchema.optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0)
    }
  }, async ({ date, timezone, mealType, limit, offset }) => {
    const all = await listFoodEntries(userId, date, timezone, { mealType });
    const entries = all.slice(offset, offset + limit);
    const hasMore = offset + entries.length < all.length;
    const text = itemizeText(
      entries.length,
      "entries",
      entries.map((entry) => `${entry.productSnapshot.name} (id: ${entry.id})`),
      entries.length
    );
    return result(
      "Food journal",
      `${entries.length} of ${all.length} entries`,
      { entries, totalCount: all.length },
      [],
      { text: hasMore ? `${text} (${all.length} total; pass offset to see the rest)` : text }
    );
  });

  server.registerTool("update_food_entry", {
    title: "Update food entry",
    description: "Change the quantity, meal, date, timezone, or note of one food entry. For a product-backed entry, nutrients are recalculated and snapshotted; changes.quantity accepts the same unit forms as record_food, including unit: \"serving\" with a label matching one of the product's servingSizes. For an ad hoc entry (created via record_ad_hoc_food or merge_food_entries), changes.nutrients/name/brand/type/genericName may be set directly instead, and changes.quantity (if given) must keep unit: \"as_consumed\"; passing nutrients/name/brand/type/genericName for a product-backed entry is rejected.",
    inputSchema: {
      id: z.string().uuid(),
      changes: z.record(z.string(), z.unknown())
    }
  }, async ({ id, changes }) => {
    const parsed = z.object({
      mealType: mealTypeSchema.optional(),
      quantity: foodQuantitySchema.optional(),
      occurredAt: z.coerce.date().optional(),
      timezone: z.string().min(1).optional(),
      note: z.string().max(2000).optional(),
      nutrients: z.array(nutrientSnapshotSchema).optional(),
      name: z.string().trim().min(1).max(300).optional(),
      brand: z.string().trim().min(1).max(200).optional(),
      type: localizedTextSchema,
      genericName: localizedTextSchema
    }).safeParse(changes);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    const before = await getFoodEntry(userId, id);
    try {
      const entry = await updateFoodEntry(userId, id, parsed.data);
      const diffParts: string[] = [];
      if (before) {
        if (before.mealType !== entry.mealType) diffParts.push(`meal ${before.mealType}→${entry.mealType}`);
        if (JSON.stringify(before.quantity) !== JSON.stringify(entry.quantity)) {
          diffParts.push(`quantity ${describeQuantity(before.quantity)}→${describeQuantity(entry.quantity)}`);
        }
        if (before.occurredAt.getTime() !== entry.occurredAt.getTime()) {
          diffParts.push(`time ${before.occurredAt.toISOString()}→${entry.occurredAt.toISOString()}`);
        }
        const beforeMacros = summarizeMacros(before.productSnapshot.nutrients);
        const afterMacros = summarizeMacros(entry.productSnapshot.nutrients);
        if (beforeMacros !== afterMacros) diffParts.push(`${beforeMacros} → ${afterMacros}`);
      }
      const text = `${entry.productSnapshot.name} (id: ${entry.id})${diffParts.length ? `: ${diffParts.join("; ")}` : ""}`;
      return result("Food entry updated", entry.productSnapshot.name, entry, [], { id: entry.id, text });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "entry_update_failed" }], isError: true };
    }
  });

  server.registerTool("delete_food_entry", {
    title: "Delete food entry",
    description: "Permanently delete one food journal entry.",
    inputSchema: { id: z.string().uuid() },
    annotations: { destructiveHint: true }
  }, async ({ id }) => {
    await deleteFoodEntry(userId, id);
    return result("Food entry deleted", id, { id });
  });

  server.registerTool("get_nutrient_details", {
    title: "Get full nutrient details",
    description: "Return all macro- and micronutrients for exactly one product, one food entry, or an aggregated local day. Salt and sodium, sugar and carbohydrates, and individual fat types remain separate.",
    inputSchema: {
      productId: z.string().uuid().optional(),
      entryId: z.string().uuid().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      timezone: z.string().optional()
    }
  }, async ({ productId, entryId, date, timezone }) => {
    if (productId) {
      const product = await getProduct(userId, productId);
      return product
        ? result("Product nutrients", product.name, product.nutrientBases)
        : { content: [{ type: "text" as const, text: "product_not_found" }], isError: true };
    }
    if (entryId) {
      const entry = await getFoodEntry(userId, entryId);
      return entry
        ? result("Entry nutrients", entry.productSnapshot.name, entry.productSnapshot.nutrients)
        : { content: [{ type: "text" as const, text: "entry_not_found" }], isError: true };
    }
    if (date && timezone) {
      const entries = await listFoodEntries(userId, date, timezone);
      const totals = aggregateNutrients(entries);
      const macroKeys = new Set<string>(Object.values(canonicalMacroKeys));
      const others = totals
        .filter((nutrient) => !(nutrient.key && macroKeys.has(nutrient.key)))
        .map((nutrient) => `${nutrient.label} ${Math.round(nutrient.value * 10) / 10}${nutrient.unit}`);
      const text = `${date}: ${summarizeMacros(totals)} (${entries.length} ${entries.length === 1 ? "entry" : "entries"})`
        + (others.length ? ` — ${others.join(", ")}` : "");
      return result("Daily nutrients", date, totals, [], { text });
    }
    return { content: [{ type: "text" as const, text: "Provide productId, entryId, or date with timezone." }], isError: true };
  });

  registerSpec(server, specs.search_exercises, async ({ query, muscle, equipment, movementPattern, page, pageSize }) => {
    const found = await searchExercises(userId, query, page, pageSize, false, { muscle, equipment, movementPattern });
    const lines = found.items.map((exercise) => {
      const primary = (exercise.primaryMuscles ?? exercise.muscleGroups ?? []).join(", ") || "-";
      const secondary = exercise.secondaryMuscles?.length ? ` (+${exercise.secondaryMuscles.join(", ")})` : "";
      return `${exercise.name} — ${primary}${secondary} | ${exercise.equipment ?? "-"} | ${exercise.movementPattern ?? "-"} | id: ${exercise.id}${exercise.images?.length ? ` | ${exercise.images.length} photos` : ""}${exercise.videoUrl ? " | video" : ""}`;
    });
    const header = found.items.length
      ? `${found.items.length} exercises${found.hasMore ? " (more on the next page)" : ""}`
      : "No exercises matched; loosen the query or filters (list_exercise_filters shows valid values)";
    const compact = { ...found, items: found.items.map(exerciseSearchItem) };
    return result("Exercises", `Exercise search: ${query || "all"}`, compact, [], { text: [header, ...lines].join("\n") });
  });

  registerSpec(server, specs.get_exercise, async ({ exerciseId }) => {
    const exercise = await getExercise(userId, exerciseId);
    if (!exercise) return { content: [{ type: "text" as const, text: "exercise_not_found" }], isError: true };
    const steps = exercise.instructions?.length
      ? exercise.instructions.map((step, index) => `${index + 1}. ${step}`).join("\n")
      : "No technique steps stored.";
    const text = [
      `${exercise.name} (id: ${exercise.id})`,
      `Primary: ${(exercise.primaryMuscles ?? exercise.muscleGroups ?? []).join(", ") || "-"}; secondary: ${exercise.secondaryMuscles?.join(", ") || "-"}`,
      `Equipment: ${exercise.equipment ?? "-"}; pattern: ${exercise.movementPattern ?? "-"}`,
      exercise.searchAliases.length ? `Also known as: ${exercise.searchAliases.join(", ")}` : undefined,
      "Technique:",
      steps,
      exercise.images?.length ? `Photos: ${exercise.images.join(" ")}` : undefined,
      exercise.videoUrl ? `Video: ${exercise.videoUrl}` : undefined
    ].filter(Boolean).join("\n");
    return result("Exercise", exercise.name, exercise, [], { text });
  });

  registerSpec(server, specs.list_exercise_filters, async () => {
    const facets = await exerciseFacets(userId);
    const line = (label: string, values: Array<{ value: string; count: number }>) => `${label}: ${values.map((item) => `${item.value} (${item.count})`).join(", ") || "-"}`;
    const text = [`${facets.total} exercises`, line("Muscles", facets.muscles), line("Equipment", facets.equipment), line("Movement patterns", facets.movementPatterns)].join("\n");
    return result("Exercise filters", `${facets.total} exercises`, facets, [], { text });
  });

  registerSpec(server, specs.upsert_exercise, async ({ exercise }) => {
    try {
      const { exercise: saved, created, matchedBy, changedFields } = await upsertExerciseDetailed(userId, exercise);
      const text = created
        ? `Created exercise "${saved.name}" (id: ${saved.id}).`
        : `Matched the existing exercise "${saved.name}" (id: ${saved.id}) by ${matchedBy}; ${changedFields.length ? `updated: ${changedFields.join(", ")}` : "nothing changed"}. Fields you did not send keep their stored values.`;
      return result("Exercise saved", saved.name, { ...saved, created, matchedBy, changedFields }, [], { id: saved.id, text });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "exercise_save_failed" }], isError: true };
    }
  });

  registerSpec(server, specs.record_workout_session, async ({ occurredAt, timezone, muscleGroups, note, exertion, mood, sets, idempotencyKey }) => {
    const parsedOccurredAt = new Date(occurredAt);
    if (Number.isNaN(parsedOccurredAt.getTime())) {
      return { content: [{ type: "text" as const, text: "Provide a valid occurredAt." }], isError: true };
    }
    try {
      const session = await recordWorkoutSession(userId, {
        occurredAt: parsedOccurredAt, timezone, muscleGroups, note, exertion, mood, sets, idempotencyKey
      });
      const text = `Workout recorded (id: ${session.eventId}) — ${session.summary.exerciseCount} exercises, `
        + `${session.summary.setCount} sets, ${session.summary.tonnageKg}kg tonnage`;
      return result("Workout recorded", text, session, [], { id: session.eventId, text });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "workout_save_failed" }], isError: true };
    }
  });

  registerSpec(server, specs.rename_workout_template, async ({ id, name }) => {
    const template = await getTemplate(userId, id);
    if (!template) return { content: [{ type: "text" as const, text: "template_not_found" }], isError: true };
    try {
      const saved = await upsertTemplate(userId, { ...template, name });
      return result("Template renamed", saved.name, saved, [], { id: saved.id, text: `Renamed to "${saved.name}" (id: ${saved.id})` });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "template_save_failed" }], isError: true };
    }
  });

  registerSpec(server, specs.list_workout_sessions, async ({ limit, from, to }) => {
    const range = parseRange(from, to);
    if ("error" in range) return fail(range.error);
    const sessions = await listRecentWorkoutSessions(userId, limit, range);
    const lines = sessions.map((session) => {
      const head = [
        `${session.occurredAt.toISOString().slice(0, 10)} (id: ${session.eventId})`,
        session.muscleGroups.join("+"),
        session.exertion ? `difficulty ${session.exertion}/5` : undefined,
        session.mood ? `mood ${session.mood}` : undefined,
        `${session.summary.setCount} sets, ${session.summary.tonnageKg} kg tonnage`
      ].filter(Boolean).join(" | ");
      const exercises = session.exercises.map((exercise) => {
        const sets = exercise.sets.map((set) => (
          `${set.reps ?? "?"}x${set.weightKg ?? "bw"}${set.rir !== undefined ? ` RIR${set.rir}` : ""}${set.setType !== "working" ? ` (${set.setType})` : ""}`
        )).join(", ");
        return `  ${exercise.name}: ${sets}`;
      });
      return [head, session.note ? `  note: ${session.note}` : undefined, ...exercises].filter(Boolean).join("\n");
    });
    return result("Workout sessions", `${sessions.length} sessions`, { sessions }, [], {
      text: sessions.length ? lines.join("\n") : "No logged workouts yet"
    });
  });

  registerSpec(server, specs.get_muscle_volume, async ({ weeks, timezone }) => {
    if (!isValidTimeZone(timezone)) return { content: [{ type: "text" as const, text: "invalid_timezone" }], isError: true };
    const volume = await getMuscleVolume(userId, weeks, timezone);
    const text = volume.map((week) => {
      const muscles = Object.entries(week.sets).sort((a, b) => b[1] - a[1]).map(([muscle, sets]) => `${muscle} ${sets}`);
      return `${week.weekStart}: ${muscles.length ? muscles.join(", ") : "no sets"}`;
    }).join("\n");
    return result("Muscle volume", `Weekly sets per muscle (${weeks} weeks)`, { weeks: volume }, [], { text });
  });

  registerSpec(server, specs.list_workout_templates, async ({ includeArchived }) => {
    const items = await withExerciseDetails(userId, await listTemplates(userId, includeArchived));
    const text = itemizeText(items.length, "templates", items.map((template) => `${template.name} (id: ${template.id}, ${template.exercises.length} exercises)`));
    return result("Workout templates", "Workout templates", { items }, [], { text, withData: true });
  });

  registerSpec(server, specs.upsert_workout_template, async ({ template }) => {
    try {
      const saved = await upsertTemplate(userId, template);
      return result("Template saved", saved.name, saved, [], { id: saved.id, text: `${saved.name} (id: ${saved.id}, ${saved.exercises.length} exercises)`, withData: true });
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "template_save_failed" }], isError: true };
    }
  });

  registerSpec(server, specs.delete_workout_template, async ({ id }) => {
    const deleted = await deleteTemplate(userId, id);
    if (!deleted) return { content: [{ type: "text" as const, text: "template_not_found" }], isError: true };
    return result("Template deleted", id, { id }, [], { id, text: `Deleted template ${id}` });
  });

  registerSpec(server, specs.plan_workout_from_template, async ({ id }) => {
    const plan = await planTemplate(userId, id);
    if (!plan) return { content: [{ type: "text" as const, text: "template_not_found" }], isError: true };
    const lines = plan.exercises.map((exercise) => {
      const range = exercise.repMin && exercise.repMax ? `${exercise.repMin}-${exercise.repMax}` : `${exercise.repMax ?? exercise.repMin ?? "?"}`;
      const load = exercise.suggestion.weightKg !== undefined ? `${exercise.suggestion.weightKg} kg (${exercise.suggestion.reason})` : "no history";
      return `${exercise.name}: ${exercise.sets} x ${range}${exercise.targetRir !== undefined ? ` @RIR ${exercise.targetRir}` : ""}, ${load}`;
    });
    return result("Workout plan", plan.name, plan, [], { text: [plan.name, ...lines].join("\n"), withData: true });
  });

  registerSpec(server, specs.get_exercise_history, async ({ exerciseId, limit }) => {
    const exercise = await getExercise(userId, exerciseId);
    if (!exercise) return { content: [{ type: "text" as const, text: "exercise_not_found" }], isError: true };
    const history = await getExerciseHistory(userId, exerciseId, limit);
    const text = history.bestSet
      ? `${exercise.name}: best ${history.bestSet.weightKg}kg x${history.bestSet.reps} (${history.bestSet.date})`
        + `${history.bestE1rmKg ? `, e1RM ${history.bestE1rmKg}kg` : ""}, ${history.windowSessions} recent sessions`
      : `${exercise.name}: no logged sets yet`;
    return result("Exercise history", exercise.name, history, [], { text });
  });

  registerSpec(server, specs.get_template, async ({ id }) => {
    const stored = await getTemplate(userId, id);
    if (!stored) return fail("template_not_found");
    const [template] = await withExerciseDetails(userId, [stored]);
    return result("Workout template", template.name, template, [], {
      id: template.id, text: `${template.name} (id: ${template.id}, ${template.exercises.length} exercises)`, withData: true
    });
  });

  async function sessionText(eventId: string) {
    const session = await getWorkoutSession(userId, eventId);
    if (!session) return undefined;
    const names = new Map<string, string>();
    for (const exerciseId of new Set(session.sets.map((set) => set.exerciseId))) {
      names.set(exerciseId, (await getExercise(userId, exerciseId))?.name ?? "Unknown exercise");
    }
    const byExercise = new Map<string, string[]>();
    for (const set of [...session.sets].sort((a, b) => a.setIndex - b.setIndex)) {
      const line = `${set.reps ?? "?"}x${set.weightKg ?? "bw"}${set.rir !== undefined ? ` RIR${set.rir}` : ""}${set.setType !== "working" ? ` (${set.setType})` : ""}`;
      byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), line]);
    }
    const head = [
      `${session.occurredAt.toISOString().slice(0, 16)} (id: ${session.eventId})`,
      session.muscleGroups.join("+"),
      session.exertion ? `difficulty ${session.exertion}/5` : undefined,
      session.mood ? `mood ${session.mood}` : undefined,
      `${session.summary.setCount} sets, ${session.summary.tonnageKg} kg tonnage`
    ].filter(Boolean).join(" | ");
    const lines = [...byExercise.entries()].map(([exerciseId, sets]) => `  ${names.get(exerciseId)} (exerciseId: ${exerciseId}): ${sets.join(", ")}`);
    return { session, text: [head, session.note ? `  note: ${session.note}` : undefined, ...lines].filter(Boolean).join("\n") };
  }

  registerSpec(server, specs.get_workout_session, async ({ eventId }) => {
    const found = await sessionText(eventId);
    if (!found) return fail("session_not_found");
    // withData: update_workout_session replaces the whole set list, so a text-only client needs every set field
    // (groupId, note, completed, setIndex) to correct one value without erasing the rest.
    return result("Workout session", found.text.split("\n")[0], found.session, [], { id: eventId, text: found.text, withData: true });
  });

  registerSpec(server, specs.update_workout_session, async ({ eventId, occurredAt, timezone, muscleGroups, note, exertion, mood, sets }) => {
    const parsedOccurredAt = new Date(occurredAt);
    if (Number.isNaN(parsedOccurredAt.getTime())) return fail("Provide a valid occurredAt.");
    try {
      const updated = await replaceWorkoutSession(userId, eventId, { occurredAt: parsedOccurredAt, timezone, muscleGroups, note, exertion, mood, sets });
      if (!updated) return fail("session_not_found");
      const text = `Workout updated (id: ${eventId}) — ${updated.summary.exerciseCount} exercises, ${updated.summary.setCount} sets, ${updated.summary.tonnageKg}kg tonnage`;
      return result("Workout updated", text, updated, [], { id: eventId, text });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "workout_save_failed");
    }
  });

  registerSpec(server, specs.delete_workout_session, async ({ eventId }) => {
    if (!(await deleteWorkoutSession(userId, eventId))) return fail("session_not_found");
    return result("Workout deleted", eventId, { eventId }, [], { id: eventId, text: `Deleted workout session ${eventId}` });
  });

  registerSpec(server, specs.get_daily_activity, async ({ from, to }) => {
    if (from > to) return fail("invalid_date_range");
    const days = await listDailyActivity(userId, from, to);
    const text = days.length
      ? days.map((day) => `${day.activityDate}: ${day.steps} steps (goal ${day.goalSteps})${day.workoutCount ? `, ${day.workoutCount} workouts` : ""}`).join("\n")
      : "No activity recorded in that range";
    return result("Daily activity", `${days.length} days`, { days }, [], { text, withData: days.length > 0 });
  });

  registerSpec(server, specs.duplicate_workout_template, async ({ id, name }) => {
    try {
      const copy = await duplicateTemplate(userId, id, name);
      if (!copy) return fail("template_not_found");
      return result("Template duplicated", copy.name, copy, [], { id: copy.id, text: `Created "${copy.name}" (id: ${copy.id}, ${copy.exercises.length} exercises)`, withData: true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "template_save_failed");
    }
  });

  registerSpec(server, specs.list_exercise_alternatives, async ({ exerciseId, equipment, limit }) => {
    const found = await listExerciseAlternatives(userId, exerciseId, { equipment, limit });
    if (!found) return fail("exercise_not_found");
    const lines = found.items.map((exercise) => {
      const primary = (exercise.primaryMuscles ?? exercise.muscleGroups ?? []).join(", ") || "-";
      return `${exercise.name} — ${primary} | ${exercise.equipment ?? "-"} | ${exercise.movementPattern ?? "-"} | id: ${exercise.id}`;
    });
    const header = found.items.length ? `${found.items.length} alternatives for ${found.exercise.name}` : `No alternatives found for ${found.exercise.name}`;
    return result("Exercise alternatives", header, found, [], { text: [header, ...lines].join("\n") });
  });

  registerSpec(server, specs.preview_template_volume, async ({ exercises: planned }) => {
    const preview = await previewTemplateVolume(userId, planned);
    if (preview.missing.length) return fail(`unknown_exercise: ${preview.missing.join(", ")}`);
    const muscles = Object.entries(preview.byMuscle).sort((a, b) => b[1] - a[1]).map(([muscle, sets]) => `${muscle} ${sets}`);
    const text = `${preview.totalSets} sets in total; per muscle (primary 1, secondary 0.5): ${muscles.join(", ") || "none"}`;
    return result("Template volume preview", text, preview, [], { text });
  });

  registerSpec(server, specs.update_workout_template, async ({ id, ...patch }) => {
    try {
      const updated = await patchTemplate(userId, id, patch);
      if (!updated) return fail("template_not_found");
      const [view] = await withExerciseDetails(userId, [updated]);
      const schedule = updated.schedule
        ? ` Schedule: weekdays ${updated.schedule.weekdays.join(",")}${updated.schedule.startDate ? ` from ${updated.schedule.startDate}` : ""}${updated.schedule.endDate ? ` to ${updated.schedule.endDate}` : ""}.`
        : "";
      return result("Template updated", updated.name, view, [], { id: updated.id, text: `Updated "${updated.name}" (id: ${updated.id}, ${updated.exercises.length} exercises).${schedule}`, withData: true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "template_save_failed");
    }
  });

  registerSpec(server, specs.get_week_plan, async ({ start, timezone }) => {
    if (!isValidTimeZone(timezone)) return fail("invalid_timezone");
    const plan = await getWeekPlan(userId, start, timezone);
    const lines = plan.days.map((day) => {
      const planned = day.scheduled.map((entry) => entry.name).join(" + ") || "-";
      const done = day.sessions.map((session) => `${session.muscleGroups.join("+")} ${session.setCount} sets`).join("; ") || "-";
      return `${day.date} (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.weekday]}): ${day.status} | planned: ${planned} | logged: ${done}`;
    });
    const text = [`Week of ${plan.weekStart} (${plan.timezone}); today ${plan.today}`, ...lines, `Unplanned days: ${plan.summary.unplannedDays.join(", ") || "none"}`].join("\n");
    return result("Week plan", `Week of ${plan.weekStart}`, plan, [], { text });
  });

  registerSpec(server, specs.send_feedback, async (input) => {
    try {
      const { feedback, duplicate } = await createFeedback(userId, { ...input, source: "mcp", client: input.client ?? context.userAgent?.slice(0, 120) });
      const text = duplicate
        ? `Already recorded (id: ${feedback.id}); not stored twice.`
        : `Feedback recorded (id: ${feedback.id}). Thank you; tell the user briefly that you sent it.`;
      return result("Feedback recorded", text, feedback, [], { id: feedback.id, text });
    } catch (error) {
      const message = error instanceof Error ? error.message : "feedback_failed";
      return fail(message === "rate_limited" ? "rate_limited: too many feedback entries this hour; merge your points into fewer entries or try later" : message);
    }
  });

  registerSpec(server, specs.list_feedback, async ({ status, category, tool, limit }) => {
    const entries = await listFeedback(userId, { status, category, tool, limit });
    const header = entries.length ? `${entries.length} feedback entries (id | status | category/severity | tool | date | summary):` : "No feedback entries";
    return result("Feedback", header, { items: entries }, [], { text: [header, ...entries.map(feedbackText)].join("\n") });
  });

  registerSpec(server, specs.update_feedback, async ({ id, status, resolution }) => {
    if (status === undefined && resolution === undefined) return fail("Pass status and/or resolution.");
    const updated = await updateFeedback(userId, id, { status, resolution });
    if (!updated) return fail("feedback_not_found");
    return result("Feedback updated", updated.summary, updated, [], { id: updated.id, text: feedbackText(updated) });
  });

  return server;
}

