import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
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
import { taskScheduleSchema, timelineEventSchema } from "@/domain/events";
import {
  deleteFoodEntry,
  getFoodEntry,
  getProduct,
  listFoodEntries,
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
  describeQuantity,
  foodQuantitySchema,
  localizedTextSchema,
  mealTypeSchema,
  nutrientSnapshotSchema,
  productInputSchema,
  selectCalculationBase,
  summarizeMacros
} from "@/domain/nutrition";
import { isTaskCompleted, latestEvent } from "@/domain/timeline";
import { resolveMcpUser } from "@/data/repository";
import { TIMELINE_WIDGET_URI, timelineWidgetHtml } from "./widget";

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
  opts: { id?: string; text?: string } = {}
) {
  const text = opts.text ?? (opts.id ? `${summary} (id: ${opts.id})` : summary);
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { title, summary, items, data, ...(opts.id ? { id: opts.id } : {}) }
  };
}

function itemizeText(count: number, noun: string, labels: string[], maxShown = 10) {
  if (!count) return `No ${noun}`;
  const shown = labels.slice(0, maxShown);
  const more = count - shown.length;
  return `${count} ${noun}: ${shown.join("; ")}${more > 0 ? `; +${more} more` : ""}`;
}

export function createTimelineMcpServer(userId: string) {
  const server = new McpServer({ name: "fitness-timeline", version: "0.1.0" });
  const appMeta = { ui: { resourceUri: TIMELINE_WIDGET_URI } };

  registerAppResource(server, "Fitness Timeline result", TIMELINE_WIDGET_URI, {}, async () => ({
    contents: [{ uri: TIMELINE_WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: timelineWidgetHtml }]
  }));

  registerAppTool(server, "get_today", {
    title: "Get Today",
    description: "Return today's tasks and current body state.",
    _meta: appMeta
  }, async () => {
    const [events, schedules] = await Promise.all([listEvents(userId), listTaskSchedules(userId)]);
    const due = schedules.filter((schedule) => schedule.enabled).map((schedule) => ({
      type: schedule.eventType,
      completed: isTaskCompleted(schedule.eventType, events)
    }));
    const current = ["progress_photo", "measurements", "inbody"].map((type) => latestEvent(events, type as never));
    return result("Today", `${due.filter((task) => task.completed).length}/${due.length} tasks completed`, { due, current });
  });

  registerAppTool(server, "list_events", {
    title: "List timeline events",
    description: "List the user's timeline events in reverse chronological order.",
    inputSchema: { limit: z.number().int().min(1).max(100).default(20) },
    _meta: appMeta
  }, async ({ limit }) => {
    const events = (await listEvents(userId)).slice(0, limit);
    return result("Timeline", `${events.length} events`, events, events.map((event) => ({
      label: event.type.replace("_", " "),
      value: event.occurredAt.toISOString().slice(0, 10)
    })));
  });

  registerAppTool(server, "get_event", {
    title: "Get event",
    description: "Read one timeline event.",
    inputSchema: { id: z.string().uuid() },
    _meta: appMeta
  }, async ({ id }) => {
    const event = await getEvent(userId, id);
    if (!event) return { content: [{ type: "text" as const, text: "Event not found" }], isError: true };
    return result("Timeline event", event.type.replace("_", " "), event);
  });

  registerAppTool(server, "create_event", {
    title: "Create event",
    description: "Create a progress photo, workout, measurements, or InBody event. For InBody, send the original file reference in source.url and all extracted metrics; do not ask the server to OCR it.",
    inputSchema: { event: z.record(z.string(), z.unknown()) },
    _meta: appMeta
  }, async ({ event }) => {
    const parsed = timelineEventSchema.safeParse(event);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    const created = await createEvent(userId, parsed.data);
    return result("Event created", created.type.replace("_", " "), created);
  });

  registerAppTool(server, "update_event", {
    title: "Update event",
    description: "Replace an existing event after reading it.",
    inputSchema: { event: z.record(z.string(), z.unknown()) },
    _meta: appMeta
  }, async ({ event }) => {
    const parsed = timelineEventSchema.safeParse(event);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    return result("Event updated", parsed.data.type.replace("_", " "), await updateEvent(userId, parsed.data));
  });

  registerAppTool(server, "delete_event", {
    title: "Delete event",
    description: "Permanently delete one timeline event.",
    inputSchema: { id: z.string().uuid() },
    annotations: { destructiveHint: true },
    _meta: appMeta
  }, async ({ id }) => {
    await deleteEvent(userId, id);
    return result("Event deleted", id, { id });
  });

  registerAppTool(server, "get_task_schedules", {
    title: "Get task schedules",
    description: "Read recurring Today task schedules.",
    _meta: appMeta
  }, async () => {
    const schedules = await listTaskSchedules(userId);
    return result("Task schedules", `${schedules.length} schedules`, schedules);
  });

  registerAppTool(server, "update_task_schedule", {
    title: "Update task schedule",
    description: "Update weekdays, weekly interval, or enabled state for one task.",
    inputSchema: { schedule: z.record(z.string(), z.unknown()) },
    _meta: appMeta
  }, async ({ schedule }) => {
    const parsed = taskScheduleSchema.safeParse(schedule);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    return result("Schedule updated", parsed.data.eventType.replace("_", " "), await saveTaskSchedule(userId, parsed.data));
  });

  registerAppTool(server, "search_products", {
    title: "Search personal products",
    description: "Search the user's complete personal product database by name, brand, barcode, or searchAliases (extra terms saved on the product via upsert_product, e.g. a Russian/Czech/English name for a product whose own name is in a different language). Matches on substrings, so \"кофе\" only finds a product if it (or one of its aliases) actually contains that substring — it does not translate or fuzzy-match across languages on its own. Results are paginated and are not limited to recent products.",
    inputSchema: {
      query: z.string().default(""),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(30)
    },
    _meta: appMeta
  }, async ({ query, page, pageSize }) => {
    const found = await searchProducts(userId, query, page, pageSize);
    const text = itemizeText(found.items.length, "products", found.items.map((product) => `${product.name} (id: ${product.id})`));
    return result("Products", `Personal product search: ${query || "all"}`, found, [], { text });
  });

  registerAppTool(server, "get_product", {
    title: "Get product with all nutrients",
    description: "Read a personal product including every stored nutrient base, original label, unit, qualifier, daily value, and stated/calculated/estimated provenance.",
    inputSchema: { id: z.string().uuid() },
    _meta: appMeta
  }, async ({ id }) => {
    const product = await getProduct(userId, id);
    return product
      ? result("Product", product.name, product)
      : { content: [{ type: "text" as const, text: "product_not_found" }], isError: true };
  });

  registerAppTool(server, "upsert_product", {
    title: "Create or update a personal product",
    description: "Save every readable row from a nutrition label, not only calories and macros. Preserve original labels, units, '<'/trace qualifiers, multiple bases such as per 100 g and per serving, and unknown nutrients. Never invent missing packaged-food values. Mark label values stated, derived values calculated, and reference fruit/vegetable values estimated. Exact barcodes are reused; ambiguous name matches return an error. When the package states a whole-container size (e.g. a 330 ml can, a 250 g cup, a 1 L bottle) AND you are not already recording it as its own nutrientBases entry (a \"per portion\" base with directly stated values), add it to servingSizes as { label: \"1 банка (330 мл)\", amount: 330, provenance: \"stated\" } so the app can offer it as a one-tap quantity; amount is always expressed in the product's own baseUnit (g or ml), never invented when the label doesn't state a container size. Do not add both a \"per portion\" nutrientBases entry and a servingSizes entry for the same container size — that duplicates the same quick-select option; prefer the nutrientBases entry when the label states per-serving values directly, and servingSizes only when you'd otherwise have to scale from the reference base. pieceSizes is a SEPARATE array from servingSizes, only for gram-based products (baseUnit \"g\"): each entry is { size: \"small\"|\"regular\"|\"medium\"|\"large\", grams, provenance } — a fixed 4-value relative sizing (not a container size or free text). Prefer servingSizes for almost everything (a banana, a capsule, a slice, a can) since its label is free text matched by record_food's unit: \"serving\"; only use pieceSizes when the product genuinely comes in those exact small/regular/medium/large variants. Both pieceSizes and servingSizes are per-product — there is no shared or built-in catalog, so record_food's unit: \"piece\"/\"serving\" only resolves against sizes/labels already saved on that specific product via upsert_product. Each servingSizes entry gets a stable id (auto-assigned if you omit it, and preserved across re-saves as long as the label stays the same) — read it back via get_product and pass it as record_food's quantity.servingSizeId for exact matching instead of relying on the label string, which breaks on whitespace/punctuation differences; quantity.label becomes optional once you have servingSizeId, but at least one of the two is required. CRITICAL: every nutrient you recognize MUST also carry its canonical `key` in addition to the original label, or the app's calorie/macro totals will silently show zero for this product. Always set key: \"energy_kcal\" for the kcal energy row (not the kJ row), \"protein\" for protein, \"fat\" for total fat, \"carbohydrates\" for total carbohydrate — these four are required whenever present on the label. Also set canonical keys when recognizable: \"saturated_fat\", \"sugars\", \"fiber\", \"salt\", \"sodium\", \"cholesterol\", and \"vitamin_*\"/mineral names (e.g. \"potassium\", \"calcium\", \"iron\"). Leave key unset only for rows you cannot confidently map (e.g. a kJ energy row when energy_kcal is already set, or a genuinely unrecognized nutrient) — never guess a key for those. If the product's own name is in one language, set searchAliases to the equivalent name/common terms in the other languages the user might search in (e.g. name \"Café au Lait\" with searchAliases [\"кофе\", \"coffee\", \"káva\"]) so search_products can find it later regardless of which language the user searches in. Always also set type (the product category, e.g. { en: \"Coffee\", ru: \"Кофе\", cs: \"Káva\" }, or { en: \"Protein powder\", ru: \"Протеин\", cs: \"Protein\" }) and genericName (the product's name with any brand stripped, e.g. { en: \"Café au Lait\", ru: \"Кофе с молоком\", cs: \"Káva s mlékem\" }) in all three languages — the app shows these so a product is recognizable even when its own name alone doesn't make the category obvious. Fill in whichever of the three languages you can produce a reasonable translation for; it's fine to leave a language empty rather than guess badly.",
    inputSchema: { product: productInputSchema },
    _meta: appMeta
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

  registerAppTool(server, "record_food", {
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
    },
    _meta: appMeta
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

  registerAppTool(server, "record_ad_hoc_food", {
    title: "Record ad hoc food",
    description: "Record a one-off meal with inline nutrients, without creating or touching a Product. Use this instead of record_food when the meal is home-cooked, eyeballed, or otherwise not worth saving as a reusable product (e.g. \"3 pancakes, about 150 g, estimated\"). Provide the nutrients for the quantity actually eaten — they are stored as-is, never scaled. Also set type (the food category in en/ru/cs, e.g. { en: \"Protein drink\", ru: \"Протеиновый напиток\", cs: \"Proteinový nápoj\" }) and genericName (the name with any brand stripped, in en/ru/cs) whenever you can produce a reasonable translation — leave a language empty rather than guess badly. Reuse the same idempotencyKey when retrying.",
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
    },
    _meta: appMeta
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

  registerAppTool(server, "repeat_meal", {
    title: "Repeat meal",
    description: "Copy every entry logged for one meal (breakfast/lunch/dinner/snack) on sourceDate into targetDate, preserving each entry's exact product, quantity, and nutrient snapshot. Always additive — entries already logged for that meal on targetDate are left untouched, never deleted or replaced. Works identically for catalog-backed and ad hoc entries. Safe to retry: repeating the same sourceDate to targetDate pair again does not duplicate already-copied entries.",
    inputSchema: {
      mealType: mealTypeSchema,
      sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Local calendar day to copy entries FROM, e.g. 2026-08-03"),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Local calendar day to copy entries INTO, e.g. 2026-08-04"),
      timezone: z.string().min(1)
    },
    _meta: appMeta
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

  registerAppTool(server, "merge_food_entries", {
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
    annotations: { destructiveHint: true },
    _meta: appMeta
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

  registerAppTool(server, "list_food_entries", {
    title: "List food journal",
    description: "List food entries for a local calendar day, most recently logged first. Optionally filter to one mealType, and page through a day with many entries via limit/offset — the returned text always lists every entry in the page (never silently truncated), and totalCount in the data reports how many entries match before paging.",
    inputSchema: {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      timezone: z.string().min(1),
      mealType: mealTypeSchema.optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0)
    },
    _meta: appMeta
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

  registerAppTool(server, "update_food_entry", {
    title: "Update food entry",
    description: "Change the quantity, meal, date, timezone, or note of one food entry. For a product-backed entry, nutrients are recalculated and snapshotted; changes.quantity accepts the same unit forms as record_food, including unit: \"serving\" with a label matching one of the product's servingSizes. For an ad hoc entry (created via record_ad_hoc_food or merge_food_entries), changes.nutrients/name/brand/type/genericName may be set directly instead, and changes.quantity (if given) must keep unit: \"as_consumed\"; passing nutrients/name/brand/type/genericName for a product-backed entry is rejected.",
    inputSchema: {
      id: z.string().uuid(),
      changes: z.record(z.string(), z.unknown())
    },
    _meta: appMeta
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

  registerAppTool(server, "delete_food_entry", {
    title: "Delete food entry",
    description: "Permanently delete one food journal entry.",
    inputSchema: { id: z.string().uuid() },
    annotations: { destructiveHint: true },
    _meta: appMeta
  }, async ({ id }) => {
    await deleteFoodEntry(userId, id);
    return result("Food entry deleted", id, { id });
  });

  registerAppTool(server, "get_nutrient_details", {
    title: "Get full nutrient details",
    description: "Return all macro- and micronutrients for exactly one product, one food entry, or an aggregated local day. Salt and sodium, sugar and carbohydrates, and individual fat types remain separate.",
    inputSchema: {
      productId: z.string().uuid().optional(),
      entryId: z.string().uuid().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      timezone: z.string().optional()
    },
    _meta: appMeta
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
      return result("Daily nutrients", date, aggregateNutrients(entries));
    }
    return { content: [{ type: "text" as const, text: "Provide productId, entryId, or date with timezone." }], isError: true };
  });

  return server;
}

