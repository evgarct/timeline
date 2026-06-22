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
import { isTaskCompleted, latestEvent } from "@/domain/timeline";
import { resolveMcpUser } from "@/data/repository";
import { TIMELINE_WIDGET_URI, timelineWidgetHtml } from "./widget";

function hashToken(token: string) {
  return createHash("sha256").update(`${process.env.MCP_TOKEN_PEPPER ?? "development"}:${token}`).digest("hex");
}

export async function authenticateMcp(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return resolveMcpUser(hashToken(header.slice(7)));
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

  return server;
}

