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
  recordFood,
  searchProducts,
  aggregateNutrients,
  updateFoodEntry,
  upsertProduct
} from "@/data/nutrition-repository";
import { foodQuantitySchema, mealTypeSchema, productInputSchema } from "@/domain/nutrition";
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

function result(title: string, summary: string, data: unknown, items: Array<{ label: string; value: string }> = []) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: { title, summary, items, data }
  };
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
    description: "Search the user's complete personal product database by name, brand, or barcode. Results are paginated and are not limited to recent products.",
    inputSchema: {
      query: z.string().default(""),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(30)
    },
    _meta: appMeta
  }, async ({ query, page, pageSize }) => result(
    "Products",
    `Personal product search: ${query || "all"}`,
    await searchProducts(userId, query, page, pageSize)
  ));

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
    description: "Save every readable row from a nutrition label, not only calories and macros. Preserve original labels, units, '<'/trace qualifiers, multiple bases such as per 100 g and per serving, and unknown nutrients. Never invent missing packaged-food values. Mark label values stated, derived values calculated, and reference fruit/vegetable values estimated. Exact barcodes are reused; ambiguous name matches return an error.",
    inputSchema: { product: z.record(z.string(), z.unknown()) },
    _meta: appMeta
  }, async ({ product }) => {
    const parsed = productInputSchema.safeParse(product);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    try {
      const saved = await upsertProduct(userId, parsed.data);
      return result("Product saved", saved.name, saved);
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "product_save_failed" }], isError: true };
    }
  });

  registerAppTool(server, "record_food", {
    title: "Record food",
    description: "Record food without confirmation when the user's intent is unambiguous. Use the user's current local date by default; explicit past and future dates are allowed. Provide an existing productId or a full new product with every visible nutrient. If meal is not stated and cannot be inferred, use snack. Photos are analyzed by ChatGPT and are never sent to or stored by this server. Reuse the same idempotencyKey when retrying.",
    inputSchema: {
      productId: z.string().uuid().optional(),
      product: z.record(z.string(), z.unknown()).optional(),
      mealType: mealTypeSchema,
      quantity: z.record(z.string(), z.unknown()),
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
      return result("Food recorded", entry.productSnapshot.name, entry);
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "entry_save_failed" }], isError: true };
    }
  });

  registerAppTool(server, "list_food_entries", {
    title: "List food journal",
    description: "List all food entries for a local calendar day.",
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: z.string().min(1) },
    _meta: appMeta
  }, async ({ date, timezone }) => {
    const entries = await listFoodEntries(userId, date, timezone);
    return result("Food journal", `${entries.length} entries`, entries);
  });

  registerAppTool(server, "update_food_entry", {
    title: "Update food entry",
    description: "Change the quantity, meal, date, timezone, or note of one food entry. Nutrients are recalculated and snapshotted.",
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
      note: z.string().max(2000).optional()
    }).safeParse(changes);
    if (!parsed.success) return { content: [{ type: "text" as const, text: parsed.error.message }], isError: true };
    try {
      const entry = await updateFoodEntry(userId, id, parsed.data);
      return result("Food entry updated", entry.productSnapshot.name, entry);
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

